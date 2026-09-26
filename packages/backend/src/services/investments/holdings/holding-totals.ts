import { COST_BASIS_METHOD, INVESTMENT_TRANSACTION_CATEGORY } from '@bt/shared/types/investments';
import { Big } from 'big.js';

import { replayCostBasis } from './cost-basis-replay';

export interface HoldingTotalsLeg {
  category: INVESTMENT_TRANSACTION_CATEGORY;
  /** Signed share count for the leg (always positive in this model; direction comes from `category`). */
  quantity: Big;
  /** Total cost of the leg in the holding's own currency (price × quantity + fees). */
  amount: Big;
  /** Same as `amount`, expressed in the user's base currency. */
  refAmount: Big;
}

interface HoldingTotals {
  quantity: Big;
  costBasis: Big;
  refCostBasis: Big;
}

/**
 * Replays a holding's transactions into its current quantity and cost basis.
 *
 * The actual per-transaction fold (weighted-average or FIFO) lives in
 * `cost-basis-replay.ts`, shared with the balance-history replay and the
 * annualized-returns/XIRR replay so all three agree on a holding's cost basis.
 *
 * DIVIDEND and FEE legs intentionally affect neither quantity nor basis here;
 * they are accounted for elsewhere.
 *
 * The replay is order-sensitive: `transactions` MUST be supplied in
 * chronological (date, then insertion) order. A rebuy seen before the sell that
 * liquidated the previous lots would blend their cost into the basis instead of
 * resetting it (weighted-average) or attribute it to the wrong lot (FIFO).
 */
export const computeHoldingTotals = ({
  transactions,
  method = COST_BASIS_METHOD.weighted_average,
}: {
  transactions: HoldingTotalsLeg[];
  method?: COST_BASIS_METHOD;
}): HoldingTotals => replayCostBasis({ legs: transactions, method });
