import { ASSET_CLASS, COST_BASIS_METHOD, INVESTMENT_TRANSACTION_CATEGORY } from '@bt/shared/types';
import { toUtcDateString } from '@common/utils/date';

import type { HoldingState, SecurityRow, TransactionRow } from './types';

/**
 * Replay buy/sell transactions to derive per-portfolio holdings on each
 * snapshot date, value them via `findPriceForDate` → `getExchangeRate`, and
 * sum the result across all portfolios per date.
 *
 * Cost-basis/quantity tracking mirrors `computeHoldingTotals`
 * (`services/investments/holdings/holding-totals.ts`) — keep in sync, or an
 * oversell mid-history (allowed for crypto drift) drops the holding and the
 * next buy reinflates it, ballooning market value. FIFO lot depletion (used
 * only for mutual_fund holdings in a `fifo`-flagged portfolio) mirrors
 * `cost-basis-replay.ts`'s `applyFifoLeg` for the same reason.
 *
 * Transactions within each portfolio MUST be sorted ascending by date — the
 * inner loop breaks at the first transaction past the snapshot.
 *
 * Invokes `onMissingPrice({ securityId, dateStr })` whenever a held security has
 * no price for a snapshot day and is valued at cost basis instead, so callers
 * that report valuation quality can name the affected securities.
 */
export const computeHoldingsValueByDate = ({
  uniqueDates,
  portfolioIds,
  transactionsByPortfolio,
  securitiesById,
  findPriceForDate,
  getExchangeRate,
  onMissingPrice,
  costBasisMethodByPortfolioId,
}: {
  uniqueDates: string[];
  portfolioIds: string[];
  transactionsByPortfolio: Map<string, TransactionRow[]>;
  securitiesById: Map<string, SecurityRow>;
  findPriceForDate: (securityId: string, targetDate: string) => number | null;
  getExchangeRate: (currencyCode: string, dateStr: string) => number;
  onMissingPrice?: ({ securityId, dateStr }: { securityId: string; dateStr: string }) => void;
  /** Defaults every portfolio to weighted-average when omitted. */
  costBasisMethodByPortfolioId?: Map<string, COST_BASIS_METHOD>;
}): Map<string, number> => {
  const holdingsValueByDate = new Map<string, number>();

  // Running holdings + a forward-only cursor per portfolio: dates and txs are
  // both ascending, so each tx is folded in once and every date values the
  // holdings accumulated so far.
  const holdingsByPortfolio = new Map<string, Map<string, HoldingState>>();
  const cursorByPortfolio = new Map<string, number>();
  for (const portfolioId of portfolioIds) {
    holdingsByPortfolio.set(portfolioId, new Map<string, HoldingState>());
    cursorByPortfolio.set(portfolioId, 0);
  }

  for (const dateStr of uniqueDates) {
    let totalValueForDate = 0;

    for (const portfolioId of portfolioIds) {
      const portfolioTxs = transactionsByPortfolio.get(portfolioId) ?? [];
      const holdings = holdingsByPortfolio.get(portfolioId)!;
      let cursor = cursorByPortfolio.get(portfolioId)!;

      // Fold in every transaction that settled on or before this snapshot day.
      while (cursor < portfolioTxs.length) {
        const tx = portfolioTxs[cursor]!;
        // `tx.date` is TIMESTAMPTZ; bucket to its UTC calendar day so the
        // comparison against the `yyyy-MM-dd` snapshot key is lexicographic.
        if (toUtcDateString(tx.date) > dateStr) break;

        const securityId = tx.securityId;
        // Raw rows carry DECIMALs as strings (see `TransactionRow`); this replay
        // runs on floats anyway, so plain Number() conversion loses nothing.
        const quantity = Number(tx.quantity);
        // `refAmount` is the leg's full cost in base currency — quantity × price
        // *including* fees, as `resolveSettlement` composes it. That is exactly
        // what `computeHoldingTotals` folds into the basis, so `refFees` must not
        // be added on top of it: the fee is already in there and would count twice.
        const totalAmount = Number(tx.refAmount);

        if (!holdings.has(securityId)) {
          const security = securitiesById.get(securityId);
          holdings.set(securityId, {
            quantity: 0,
            costBasis: 0,
            currencyCode: security?.currencyCode ?? tx.currencyCode,
            assetClass: security?.assetClass ?? ASSET_CLASS.other,
            fifoLots: [],
          });
        }

        const holding = holdings.get(securityId)!;
        const useFifo =
          holding.assetClass === ASSET_CLASS.mutual_fund &&
          costBasisMethodByPortfolioId?.get(portfolioId) === COST_BASIS_METHOD.fifo;

        if (tx.category === INVESTMENT_TRANSACTION_CATEGORY.buy) {
          const newQuantity = holding.quantity + quantity;
          if (useFifo) {
            if (newQuantity <= 0) {
              holding.fifoLots = [];
            } else if (holding.quantity <= 0) {
              const longProportion = newQuantity / quantity;
              holding.fifoLots = [{ quantity: newQuantity, costPerUnit: (totalAmount * longProportion) / newQuantity }];
            } else {
              holding.fifoLots.push({ quantity, costPerUnit: totalAmount / quantity });
            }
            holding.costBasis = holding.fifoLots.reduce((sum, lot) => sum + lot.quantity * lot.costPerUnit, 0);
          } else if (newQuantity <= 0) {
            holding.costBasis = 0;
          } else if (holding.quantity <= 0) {
            // Buy crosses from short/zero into long — only the long portion is new basis.
            const longProportion = newQuantity / quantity;
            holding.costBasis = totalAmount * longProportion;
          } else {
            holding.costBasis += totalAmount;
          }
          holding.quantity = newQuantity;
        } else if (tx.category === INVESTMENT_TRANSACTION_CATEGORY.sell) {
          if (useFifo) {
            if (holding.quantity > 0) {
              let remainingToSell = quantity;
              const remainingLots: typeof holding.fifoLots = [];
              for (const lot of holding.fifoLots) {
                if (remainingToSell <= 0) {
                  remainingLots.push(lot);
                } else if (lot.quantity <= remainingToSell) {
                  remainingToSell -= lot.quantity;
                } else {
                  remainingLots.push({ ...lot, quantity: lot.quantity - remainingToSell });
                  remainingToSell = 0;
                }
              }
              holding.fifoLots = remainingLots;
            }
            holding.costBasis = holding.fifoLots.reduce((sum, lot) => sum + lot.quantity * lot.costPerUnit, 0);
          } else if (holding.quantity > 0) {
            const newQuantity = holding.quantity - quantity;
            if (newQuantity <= 0) {
              holding.costBasis = 0;
            } else {
              const remainingProportion = newQuantity / holding.quantity;
              holding.costBasis *= remainingProportion;
            }
          }
          holding.quantity -= quantity;
        }

        cursor += 1;
      }
      cursorByPortfolio.set(portfolioId, cursor);

      for (const [securityId, holding] of holdings) {
        // Stocks cap at zero; crypto can legitimately drift negative until reconciled.
        const allowNegative = holding.assetClass === ASSET_CLASS.crypto;
        const effectiveQuantity = !allowNegative && holding.quantity < 0 ? 0 : holding.quantity;
        if (effectiveQuantity === 0) continue;

        const currentPrice = findPriceForDate(securityId, dateStr);

        if (currentPrice !== null) {
          const marketValueInSecurityCurrency = effectiveQuantity * currentPrice;
          const exchangeRate = getExchangeRate(holding.currencyCode, dateStr);
          const marketValueInBaseCurrency = Math.floor(marketValueInSecurityCurrency * exchangeRate);
          totalValueForDate += marketValueInBaseCurrency;
        } else {
          // No price for this day — value the holding at cost basis so the line
          // stays continuous instead of collapsing to zero. It is only an
          // approximation: it carries the purchase cost forward and shows none of
          // the gain/loss since, so callers presenting the number are told via
          // `onMissingPrice` and can disclose that the day is partly unpriced.
          onMissingPrice?.({ securityId, dateStr });
          totalValueForDate += holding.costBasis;
        }
      }
    }

    holdingsValueByDate.set(dateStr, totalValueForDate);
  }

  return holdingsValueByDate;
};
