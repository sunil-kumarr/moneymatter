import {
  COST_BASIS_METHOD,
  INVESTMENT_TRADE_TYPE,
  INVESTMENT_TRANSACTION_CATEGORY,
} from '@bt/shared/types/investments';
import Big from 'big.js';

import { replayCostBasis, type CostBasisLeg } from '../holdings/cost-basis-replay';

export interface TransactionForGains {
  date: string | Date;
  category: INVESTMENT_TRANSACTION_CATEGORY;
  quantity: string | number;
  price: string | number;
  fees?: string | number;
  /**
   * Whether this leg was an intraday (same-day) square-off or a delivery
   * trade. Sourced from broker data, never inferred from timestamps alone.
   * `undefined`/null legs are treated as delivery, matching legacy behavior
   * for accounts without this data.
   */
  tradeType?: INVESTMENT_TRADE_TYPE | null;
}

interface UnrealizedGainsResult {
  unrealizedGainValue: number;
  unrealizedGainPercent: number;
}

export interface RealizedGainsResult {
  realizedGainValue: number;
  realizedGainPercent: number;
  totalCostBasisOfSoldShares: number;
  totalProceedsFromSoldShares: number;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** IST calendar-day key (YYYY-MM-DD), since Indian same-day/intraday square-off is defined by the IST trading day, not raw UTC. */
function getIstDateKey(date: string | Date): string {
  const istMs = new Date(date).getTime() + IST_OFFSET_MS;
  return new Date(istMs).toISOString().slice(0, 10);
}

/**
 * Calculate unrealized gains/losses for a holding
 * @param marketValue Current market value of the holding
 * @param costBasis Total cost basis (original purchase cost)
 * @returns Unrealized gains in dollars and percentage
 */
export function calculateUnrealizedGains(marketValue: number, costBasis: number): UnrealizedGainsResult {
  const unrealizedGainValue = marketValue - costBasis;
  const unrealizedGainPercent = costBasis > 0 ? (unrealizedGainValue / costBasis) * 100 : 0;

  return {
    unrealizedGainValue,
    unrealizedGainPercent,
  };
}

/**
 * Nets a single IST day's intraday legs directly (sum of sell proceeds minus
 * sum of buy cost), rather than FIFO-matching individual legs against each
 * other.
 *
 * Every intraday-tagged buy leg has an equal-quantity intraday-tagged sell
 * leg from the same broker-reported lot (see the backfill script), so a
 * day's intraday legs always net to zero quantity — a closed system whose
 * total gain is the plain proceeds-minus-cost sum, independent of match
 * order. FIFO-matching by timestamp broke on real Groww data: intraday
 * square-offs can be sell-first-then-buy-to-cover (a same-day short), so a
 * sell can appear before any buy is queued. That drove the sell into the
 * "no matching buy" branch, which books it as 100% profit — silently
 * inflating gains despite the position squaring off exactly. Netting the
 * whole day sidesteps ordering entirely.
 */
function calculateIntradayGainForDay(dayTransactions: TransactionForGains[]): { gain: number; costBasis: number } {
  let buyCost = 0;
  let sellProceeds = 0;

  for (const transaction of dayTransactions) {
    const quantity = Number(transaction.quantity);
    const price = Number(transaction.price);
    const fees = Number(transaction.fees || 0);
    const amount = quantity * price;

    if (transaction.category === INVESTMENT_TRANSACTION_CATEGORY.buy) {
      buyCost += amount + fees;
    } else if (transaction.category === INVESTMENT_TRANSACTION_CATEGORY.sell) {
      sellProceeds += amount - fees;
    }
  }

  return { gain: sellProceeds - buyCost, costBasis: buyCost };
}

/**
 * Calculate realized gains/losses for a security's full transaction history.
 *
 * Intraday round-trips (same IST day, `tradeType === intraday`) are matched
 * FIFO among themselves only, since they never touch the holding's actual
 * cost basis. Everything else (delivery trades, and legacy/non-Groww
 * transactions with no `tradeType`) is replayed through the holding's real
 * cost-basis method (`cost-basis-replay.ts` — weighted-average or FIFO),
 * the same fold `Holdings.costBasis` is built from, so realized and
 * unrealized gains can never diverge from each other or from the stored
 * holding.
 *
 * @param transactions Array of buy/sell transactions for one security
 * @param method The security's cost-basis method (weighted-average for
 *   stocks/crypto, FIFO for mutual funds — see `COST_BASIS_METHOD`)
 */
export function calculateRealizedGains(
  transactions: TransactionForGains[],
  method: COST_BASIS_METHOD = COST_BASIS_METHOD.weighted_average,
): RealizedGainsResult {
  const sortedTransactions = transactions.toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const intradayLegsByDay = new Map<string, TransactionForGains[]>();
  const deliveryLegs: TransactionForGains[] = [];

  for (const transaction of sortedTransactions) {
    if (transaction.tradeType === INVESTMENT_TRADE_TYPE.intraday) {
      const dayKey = getIstDateKey(transaction.date);
      const dayLegs = intradayLegsByDay.get(dayKey) ?? [];
      dayLegs.push(transaction);
      intradayLegsByDay.set(dayKey, dayLegs);
    } else {
      deliveryLegs.push(transaction);
    }
  }

  let intradayGain = 0;
  let intradayCostBasis = 0;
  for (const dayLegs of intradayLegsByDay.values()) {
    const dayResult = calculateIntradayGainForDay(dayLegs);
    intradayGain += dayResult.gain;
    intradayCostBasis += dayResult.costBasis;
  }

  const deliveryCostBasisLegs: CostBasisLeg[] = deliveryLegs.map((transaction) => {
    const quantity = new Big(String(transaction.quantity));
    const price = new Big(String(transaction.price));
    const fees = new Big(String(transaction.fees ?? 0));
    const amount = quantity.times(price).plus(fees);
    return { category: transaction.category, quantity, amount, refAmount: amount };
  });

  const deliveryReplay = replayCostBasis({ legs: deliveryCostBasisLegs, method });
  const deliveryGain = deliveryReplay.realizedGain.toNumber();
  const deliveryCostBasis = deliveryReplay.realizedCostBasis.toNumber();

  const totalRealizedGain = intradayGain + deliveryGain;
  const totalCostBasisOfSoldShares = intradayCostBasis + deliveryCostBasis;

  // - Real cost basis present: standard percentage.
  // - Pure phantom shares (zero cost basis, positive gain): 100% gain, since
  //   it's pure profit with no investment — see `CostBasisState.realizedGain`.
  let realizedGainPercent = 0;
  if (totalCostBasisOfSoldShares > 0) {
    realizedGainPercent = (totalRealizedGain / totalCostBasisOfSoldShares) * 100;
  } else if (totalRealizedGain > 0) {
    realizedGainPercent = 100;
  }

  return {
    realizedGainValue: totalRealizedGain,
    realizedGainPercent,
    totalCostBasisOfSoldShares,
    totalProceedsFromSoldShares: totalCostBasisOfSoldShares + totalRealizedGain,
  };
}

/**
 * Calculate combined gains/losses for a holding
 * @param marketValue Current market value
 * @param costBasis Total cost basis
 * @param transactions All transactions for this holding
 * @param method The security's cost-basis method
 * @returns Combined unrealized and realized gains
 */
export function calculateAllGains(
  marketValue: number,
  costBasis: number,
  transactions: TransactionForGains[],
  method: COST_BASIS_METHOD = COST_BASIS_METHOD.weighted_average,
) {
  const unrealizedGains = calculateUnrealizedGains(marketValue, costBasis);
  const realizedGains = calculateRealizedGains(transactions, method);

  return {
    ...unrealizedGains,
    ...realizedGains,
  };
}
