import type { TransferRow } from './types';

/**
 * Bucket external deposit/withdrawal deltas by `currency → yyyy-MM-dd`. Only
 * transfers with exactly one leg inside `portfolioIdSet` count — a transfer
 * between two of the user's own portfolios moves money within the tracked
 * set and must net to zero, or a portfolio-to-portfolio rebalance would look
 * like fresh investing.
 */
const bucketExternalDeltas = ({
  portfolioTransfers,
  portfolioIdSet,
}: {
  portfolioTransfers: TransferRow[];
  portfolioIdSet: Set<string>;
}): Map<string, Map<string, number>> => {
  const deltaByCurrencyDay = new Map<string, Map<string, number>>();

  const addDelta = ({ currency, dateStr, delta }: { currency: string; dateStr: string; delta: number }) => {
    if (delta === 0) return;
    let byDay = deltaByCurrencyDay.get(currency);
    if (!byDay) {
      byDay = new Map();
      deltaByCurrencyDay.set(currency, byDay);
    }
    byDay.set(dateStr, (byDay.get(dateStr) ?? 0) + delta);
  };

  for (const tr of portfolioTransfers) {
    const fromInSet = tr.fromPortfolioId != null && portfolioIdSet.has(tr.fromPortfolioId);
    const toInSet = tr.toPortfolioId != null && portfolioIdSet.has(tr.toPortfolioId);
    if (fromInSet === toInSet) continue; // both in (internal move) or both out: no external cash flow

    if (toInSet) {
      const isCrossCurrency = tr.toCurrencyCode != null;
      const destinationLegBroken = isCrossCurrency && (tr.toAmount == null || tr.toAmount.isZero());
      if (destinationLegBroken) continue; // already logged by `accumulateCashDeltas` for the same row

      addDelta({
        currency: isCrossCurrency ? tr.toCurrencyCode! : tr.currencyCode,
        dateStr: tr.date,
        delta: isCrossCurrency ? tr.toAmount!.toNumber() : tr.amount.toNumber(),
      });
    } else {
      addDelta({ currency: tr.currencyCode, dateStr: tr.date, delta: -tr.amount.toNumber() });
    }
  }

  return deltaByCurrencyDay;
};

/**
 * Cumulative net cash invested into the tracked portfolios (external deposits
 * minus withdrawals), replayed forward across the chart window and converted
 * to base currency via day-of FX. Unlike `computePortfolioCashByDate` there is
 * no live "invested" balance stored anywhere to anchor against — the running
 * total is a pure historical replay starting from zero at the first transfer.
 */
export const computeNetInvestedByDate = ({
  portfolioTransfers,
  portfolioIdSet,
  uniqueDates,
  getExchangeRate,
}: {
  portfolioTransfers: TransferRow[];
  portfolioIdSet: Set<string>;
  uniqueDates: string[];
  getExchangeRate: (currencyCode: string, dateStr: string) => number;
}): Map<string, number> => {
  const investedByDate = new Map<string, number>();
  if (uniqueDates.length === 0) return investedByDate;

  const deltaByCurrencyDay = bucketExternalDeltas({ portfolioTransfers, portfolioIdSet });
  const firstDate = uniqueDates[0]!;

  // Running total in base currency, keyed by date — each currency's running
  // native-currency balance is converted day-of before being folded in, so a
  // currency's historical FX swings show up on the days they happened rather
  // than being applied retroactively.
  const runningByCurrency = new Map<string, number>();
  for (const [currency, byDay] of deltaByCurrencyDay) {
    let seed = 0;
    for (const [dateStr, delta] of byDay) {
      if (dateStr < firstDate) seed += delta;
    }
    runningByCurrency.set(currency, seed);
  }

  for (const dateStr of uniqueDates) {
    let totalForDate = 0;
    for (const [currency, byDay] of deltaByCurrencyDay) {
      const delta = byDay.get(dateStr);
      if (delta) {
        runningByCurrency.set(currency, (runningByCurrency.get(currency) ?? 0) + delta);
      }
      const running = runningByCurrency.get(currency) ?? 0;
      if (running === 0) continue;
      totalForDate += running * getExchangeRate(currency, dateStr);
    }
    investedByDate.set(dateStr, totalForDate);
  }

  return investedByDate;
};
