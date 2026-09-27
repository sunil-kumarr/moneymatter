import '../bootstrap';

import { TRANSACTION_TYPES } from '@bt/shared/types';
import { INVESTMENT_TRADE_TYPE, INVESTMENT_TRANSACTION_CATEGORY } from '@bt/shared/types/investments';
import { logger } from '@js/utils';
import Holdings from '@models/investments/holdings.model';
import InvestmentTransactionReconciliation from '@models/investments/investment-transaction-reconciliations.model';
import InvestmentTransaction from '@models/investments/investment-transaction.model';
import Securities from '@models/investments/securities.model';
import { recalculateHolding } from '@services/investments/holdings/recalculation.service';
import { parse } from 'csv-parse/sync';
import fs from 'node:fs';
import { Op } from 'sequelize';

import { connection } from '../models';

/**
 * One-off backfill: (re)builds a Groww portfolio's stock transactions and
 * holdings directly from `data-files/combined_stocks_gains_source.csv` — a
 * join of Groww's own PnL reports (which lot-match every realized trade and
 * tag it via a `Remark` column: blank/delivery, "Intraday trade", or bonus)
 * against the order-history export.
 *
 * This does NOT try to match/tag pre-existing `InvestmentTransaction` rows —
 * the DB has no stable identifier linking a row back to a Groww order (no
 * `exchangeOrderId` existed before this feature), so matching old rows by
 * (isin, date, price) is a heuristic that collides on high-frequency
 * intraday days (confirmed: a same-day Vodafone Idea price collision while
 * building the reference CSV). Silently mistagging a live row as intraday vs
 * delivery is worse than not tagging it. Instead, run this against a
 * portfolio whose stock transactions/holdings have already been cleared (its
 * mutual fund data is untouched), so every stock row this script creates
 * carries a real `exchangeOrderId` from day one.
 *
 * Cash/portfolio-balance effects are intentionally NOT touched here — the
 * portfolio's `PortfolioBalances` history already reflects these trades from
 * whenever they were originally imported, so redoing that math here would
 * double-count it. This script only recreates `InvestmentTransaction` /
 * `Holdings` rows and lets `recalculateHolding` (the same replay used
 * everywhere else) derive quantity/cost basis from them.
 *
 * Usage: npm run backfill:groww-trade-type -- --portfolioId=<uuid> --userId=<id> [--csv=path] [--dry-run]
 */

interface CombinedCsvRow {
  status: string;
  isin: string;
  stockName: string;
  symbol: string;
  quantity: string;
  buyDate: string;
  buyTime: string;
  buyPrice: string;
  buyExchangeOrderId: string;
  sellDate: string;
  sellTime: string;
  sellPrice: string;
  sellExchangeOrderId: string;
  tradeType: string;
  remark: string;
  growwRealisedPnl: string;
  growwRealisedPnlPercent: string;
  sourcePeriod: string;
}

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(/^--/, '').split('=');
      return [key, value ?? true];
    }),
  );
  return {
    portfolioId: args.portfolioId as string | undefined,
    userId: args.userId ? Number(args.userId) : undefined,
    csvPath: (args.csv as string | undefined) ?? '../../data-files/combined_stocks_gains_source.csv',
    dryRun: Boolean(args['dry-run']),
  };
}

/**
 * Groww's execution timestamp format is `dd-mm-yyyy hh:mm AM/PM` in IST
 * (UTC+5:30). Falls back to UTC midnight on `isoDate` when no time is
 * available (e.g. the bonus-share lot's buy leg, which has no order at all).
 */
function parseGrowwDateTime(isoDate: string, rawDateTime: string): Date {
  const match = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(rawDateTime.trim());
  if (!match) {
    return new Date(`${isoDate}T00:00:00.000Z`);
  }
  const [, , , , hourStr, minuteStr, meridiem] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  let hour = Number(hourStr) % 12;
  if (meridiem.toUpperCase() === 'PM') hour += 12;
  const istWallClockUtc = new Date(`${isoDate}T${String(hour).padStart(2, '0')}:${minuteStr}:00.000Z`);
  // Subtract the IST offset to get the true UTC instant for that IST wall-clock time.
  return new Date(istWallClockUtc.getTime() - 5.5 * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  const { portfolioId, userId, csvPath, dryRun } = parseArgs();
  if (!portfolioId || !userId) {
    throw new Error('Usage: backfill-groww-trade-type --portfolioId=<uuid> --userId=<id> [--csv=path] [--dry-run]');
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows: CombinedCsvRow[] = parse(csvContent, { columns: true, skip_empty_lines: true });
  const realisedRows = rows.filter((row) => row.status === 'realised');

  // This DB's stock Securities were seeded from the .NS Yahoo symbol
  // (`BPCL.NS`) with `isin` left blank, not from ISIN — so the join back to
  // the CSV's Groww symbol (`BPCL`) has to go through the symbol, not the
  // ISIN the CSV otherwise uses as its own join key.
  const symbols = [...new Set(realisedRows.map((row) => `${row.symbol}.NS`))];
  const securities = await Securities.findAll({ where: { symbol: { [Op.in]: symbols } } });
  const securityBySymbol = new Map(securities.map((s) => [s.symbol as string, s]));

  const missingSymbols = symbols.filter((symbol) => !securityBySymbol.has(symbol));
  if (missingSymbols.length > 0) {
    throw new Error(
      `No Security row found for symbols: ${missingSymbols.join(', ')} — create the security before running this.`,
    );
  }

  logger.info('[Backfill Groww Trade Type] starting', { portfolioId, userId, dryRun, lots: realisedRows.length });

  let transactionsCreated = 0;
  let reconciliationsCreated = 0;
  let bonusLotsWithoutBuyLeg = 0;
  const touchedSecurityIds = new Set<string>();

  for (const row of realisedRows) {
    const security = securityBySymbol.get(`${row.symbol}.NS`)!;
    touchedSecurityIds.add(security.id);

    const tradeType = row.tradeType === 'intraday' ? INVESTMENT_TRADE_TYPE.intraday : INVESTMENT_TRADE_TYPE.delivery;
    const hasBuyLeg = Boolean(row.buyExchangeOrderId) || Number(row.buyPrice) > 0;

    if (!hasBuyLeg) {
      // Bonus/split-issued shares (e.g. BPCL) have no purchase order — only a
      // sell leg exists. This is expected, not an error; the phantom-share
      // handling in `cost-basis-replay.ts` covers it at gains-calc time.
      bonusLotsWithoutBuyLeg++;
    }

    if (dryRun) continue;

    if (hasBuyLeg) {
      const buyAmount = (Number(row.quantity) * Number(row.buyPrice)).toFixed(10);
      await InvestmentTransaction.create({
        securityId: security.id,
        portfolioId,
        transactionType: TRANSACTION_TYPES.expense,
        date: parseGrowwDateTime(row.buyDate, row.buyTime),
        name: `Groww backfill: ${row.stockName} buy`,
        amount: buyAmount,
        refAmount: buyAmount,
        fees: '0',
        refFees: '0',
        quantity: row.quantity,
        price: row.buyPrice,
        refPrice: row.buyPrice,
        currencyCode: security.currencyCode,
        settlementCurrencyCode: security.currencyCode,
        settlementAmount: buyAmount,
        settlementFees: '0',
        settlementRate: '1',
        category: INVESTMENT_TRANSACTION_CATEGORY.buy,
        tradeType,
        exchangeOrderId: row.buyExchangeOrderId || null,
      });
      transactionsCreated++;
    }

    const sellAmount = (Number(row.quantity) * Number(row.sellPrice)).toFixed(10);
    const sellTx = await InvestmentTransaction.create({
      securityId: security.id,
      portfolioId,
      transactionType: TRANSACTION_TYPES.income,
      date: parseGrowwDateTime(row.sellDate, row.sellTime),
      name: `Groww backfill: ${row.stockName} sell`,
      amount: sellAmount,
      refAmount: sellAmount,
      fees: '0',
      refFees: '0',
      quantity: row.quantity,
      price: row.sellPrice,
      refPrice: row.sellPrice,
      currencyCode: security.currencyCode,
      settlementCurrencyCode: security.currencyCode,
      settlementAmount: sellAmount,
      settlementFees: '0',
      settlementRate: '1',
      category: INVESTMENT_TRANSACTION_CATEGORY.sell,
      tradeType,
      exchangeOrderId: row.sellExchangeOrderId || null,
    });
    transactionsCreated++;

    await InvestmentTransactionReconciliation.create({
      transactionId: sellTx.id,
      growwRealisedPnl: row.growwRealisedPnl,
      growwRealisedPnlPercent: row.growwRealisedPnlPercent || null,
      sourcePeriod: row.sourcePeriod,
      sourceFile: csvPath,
    });
    reconciliationsCreated++;
  }

  if (!dryRun) {
    for (const securityId of touchedSecurityIds) {
      const existingHolding = await Holdings.findOne({ where: { portfolioId, securityId } });
      if (!existingHolding) {
        const security = securities.find((s) => s.id === securityId)!;
        await Holdings.create({
          portfolioId,
          securityId,
          currencyCode: security.currencyCode,
          quantity: '0',
          costBasis: '0',
          refCostBasis: '0',
          value: '0',
          refValue: '0',
        });
      }
      await recalculateHolding({ portfolioId, securityId });
    }
  }

  logger.info('[Backfill Groww Trade Type] complete', {
    portfolioId,
    dryRun,
    totalLots: realisedRows.length,
    transactionsCreated,
    reconciliationsCreated,
    bonusLotsWithoutBuyLeg,
    securitiesTouched: touchedSecurityIds.size,
  });
}

main()
  .then(async () => {
    await connection.sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ message: '[Backfill Groww Trade Type] failed', error });
    try {
      await connection.sequelize.close();
    } catch {
      // best-effort cleanup
    }
    process.exit(1);
  });
