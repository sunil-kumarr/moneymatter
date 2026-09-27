/**
 * Single-transaction cost-basis fold step, shared by every place that replays
 * a holding's buy/sell history into a running (quantity, cost basis) state:
 * `holding-totals.ts` (the stored `Holdings.costBasis`), `holdings-replay.ts`
 * (net-worth balance history), and `get-portfolios-annualized-returns.service.ts`
 * (XIRR). Duplicating this fold used to risk the three drifting out of sync;
 * now there is exactly one implementation of each method.
 *
 * Two methods:
 * - `weighted_average`: a SELL reduces cost basis proportionally to the
 *   fraction of shares remaining. The app's long-standing default.
 * - `fifo`: a SELL depletes the oldest purchase lots first, so the remaining
 *   basis reflects the newest lots' cost. This is the method Indian mutual
 *   fund platforms (Groww, CAMS/KFintech) use, and the one Indian tax law
 *   requires for MF capital gains — see `COST_BASIS_METHOD`.
 *
 * Both methods share the same short/zero-crossing guards as the original
 * `computeHoldingTotals`: while the running quantity is ≤ 0 there is no long
 * position, so basis is zero; a BUY crossing from short/zero into long counts
 * only the portion above zero.
 */
import { COST_BASIS_METHOD, INVESTMENT_TRANSACTION_CATEGORY } from '@bt/shared/types/investments';
import { Big } from 'big.js';

export interface CostBasisLeg {
  category: INVESTMENT_TRANSACTION_CATEGORY;
  /** Always positive; direction comes from `category`. */
  quantity: Big;
  /** Total cost of the leg in the holding's own currency (price × quantity + fees). */
  amount: Big;
  /** Same as `amount`, expressed in the user's base currency. */
  refAmount: Big;
}

interface FifoLot {
  quantity: Big;
  costPerUnit: Big;
  refCostPerUnit: Big;
}

export interface CostBasisState {
  quantity: Big;
  costBasis: Big;
  refCostBasis: Big;
  /** Only populated/consumed when `method === 'fifo'`. Empty and unused otherwise. */
  fifoLots: FifoLot[];
  /**
   * Running realized gain: sum over every SELL leg of (proceeds − cost of the
   * shares that leg actually depleted), using the same cost-per-unit the leg
   * used to reduce `costBasis`/`fifoLots` above. Selling more than currently
   * held (phantom shares — bonus/split issues with no corresponding buy order)
   * costs nothing for the unmatched portion, so it books as pure gain; this is
   * intentional, not a bug — see class-level docs.
   */
  realizedGain: Big;
  refRealizedGain: Big;
  /** Running total of the cost basis actually consumed by every SELL leg so far (i.e. the denominator for a realized-gain %). */
  realizedCostBasis: Big;
  refRealizedCostBasis: Big;
}

export const createInitialCostBasisState = (): CostBasisState => ({
  quantity: new Big(0),
  costBasis: new Big(0),
  refCostBasis: new Big(0),
  fifoLots: [],
  realizedGain: new Big(0),
  refRealizedGain: new Big(0),
  realizedCostBasis: new Big(0),
  refRealizedCostBasis: new Big(0),
});

const applyWeightedAverageLeg = ({ state, leg }: { state: CostBasisState; leg: CostBasisLeg }): void => {
  const { category, quantity, amount, refAmount } = leg;

  if (category === INVESTMENT_TRANSACTION_CATEGORY.buy) {
    const newQuantity = state.quantity.plus(quantity);
    if (newQuantity.lte(0)) {
      state.costBasis = new Big(0);
      state.refCostBasis = new Big(0);
    } else if (state.quantity.lte(0)) {
      const longProportion = newQuantity.div(quantity);
      state.costBasis = amount.times(longProportion);
      state.refCostBasis = refAmount.times(longProportion);
    } else {
      state.costBasis = state.costBasis.plus(amount);
      state.refCostBasis = state.refCostBasis.plus(refAmount);
    }
    state.quantity = newQuantity;
    return;
  }

  if (category === INVESTMENT_TRANSACTION_CATEGORY.sell) {
    let costConsumed = new Big(0);
    let refCostConsumed = new Big(0);
    if (state.quantity.gt(0)) {
      const newQuantity = state.quantity.minus(quantity);
      if (newQuantity.lte(0)) {
        costConsumed = state.costBasis;
        refCostConsumed = state.refCostBasis;
        state.costBasis = new Big(0);
        state.refCostBasis = new Big(0);
      } else {
        const remainingProportion = newQuantity.div(state.quantity);
        const newCostBasis = state.costBasis.times(remainingProportion);
        const newRefCostBasis = state.refCostBasis.times(remainingProportion);
        costConsumed = state.costBasis.minus(newCostBasis);
        refCostConsumed = state.refCostBasis.minus(newRefCostBasis);
        state.costBasis = newCostBasis;
        state.refCostBasis = newRefCostBasis;
      }
    }
    state.quantity = state.quantity.minus(quantity);
    state.realizedGain = state.realizedGain.plus(amount.minus(costConsumed));
    state.refRealizedGain = state.refRealizedGain.plus(refAmount.minus(refCostConsumed));
    state.realizedCostBasis = state.realizedCostBasis.plus(costConsumed);
    state.refRealizedCostBasis = state.refRealizedCostBasis.plus(refCostConsumed);
  }
};

const recomputeFifoTotals = (state: CostBasisState): void => {
  let costBasis = new Big(0);
  let refCostBasis = new Big(0);
  for (const lot of state.fifoLots) {
    costBasis = costBasis.plus(lot.quantity.times(lot.costPerUnit));
    refCostBasis = refCostBasis.plus(lot.quantity.times(lot.refCostPerUnit));
  }
  state.costBasis = costBasis;
  state.refCostBasis = refCostBasis;
};

const applyFifoLeg = ({ state, leg }: { state: CostBasisState; leg: CostBasisLeg }): void => {
  const { category, quantity, amount, refAmount } = leg;

  if (category === INVESTMENT_TRANSACTION_CATEGORY.buy) {
    const newQuantity = state.quantity.plus(quantity);
    if (newQuantity.lte(0)) {
      state.fifoLots = [];
    } else if (state.quantity.lte(0)) {
      // Crosses from short/zero into long — only the long portion becomes a lot.
      const longProportion = newQuantity.div(quantity);
      state.fifoLots = [
        {
          quantity: newQuantity,
          costPerUnit: amount.times(longProportion).div(newQuantity),
          refCostPerUnit: refAmount.times(longProportion).div(newQuantity),
        },
      ];
    } else {
      state.fifoLots.push({
        quantity,
        costPerUnit: amount.div(quantity),
        refCostPerUnit: refAmount.div(quantity),
      });
    }
    state.quantity = newQuantity;
    recomputeFifoTotals(state);
    return;
  }

  if (category === INVESTMENT_TRANSACTION_CATEGORY.sell) {
    let costConsumed = new Big(0);
    let refCostConsumed = new Big(0);
    if (state.quantity.gt(0)) {
      let remainingToSell = quantity;
      const remainingLots: FifoLot[] = [];
      for (const lot of state.fifoLots) {
        if (remainingToSell.lte(0)) {
          remainingLots.push(lot);
          continue;
        }
        if (lot.quantity.lte(remainingToSell)) {
          costConsumed = costConsumed.plus(lot.quantity.times(lot.costPerUnit));
          refCostConsumed = refCostConsumed.plus(lot.quantity.times(lot.refCostPerUnit));
          remainingToSell = remainingToSell.minus(lot.quantity);
          continue;
        }
        costConsumed = costConsumed.plus(remainingToSell.times(lot.costPerUnit));
        refCostConsumed = refCostConsumed.plus(remainingToSell.times(lot.refCostPerUnit));
        remainingLots.push({ ...lot, quantity: lot.quantity.minus(remainingToSell) });
        remainingToSell = new Big(0);
      }
      state.fifoLots = remainingLots;
    }
    // Selling from a zero/short position leaves the lots (and basis) untouched,
    // matching weighted-average's "no long position to reduce" behaviour.
    // Selling more than the available lots cover (phantom shares — see
    // `CostBasisState.realizedGain` docs) leaves the unmatched portion at zero
    // cost, so it books as pure gain below.
    state.quantity = state.quantity.minus(quantity);
    recomputeFifoTotals(state);
    state.realizedGain = state.realizedGain.plus(amount.minus(costConsumed));
    state.refRealizedGain = state.refRealizedGain.plus(refAmount.minus(refCostConsumed));
    state.realizedCostBasis = state.realizedCostBasis.plus(costConsumed);
    state.refRealizedCostBasis = state.refRealizedCostBasis.plus(refCostConsumed);
  }
};

/** Mutates and returns `state` after folding in one transaction leg. */
export const applyCostBasisLeg = ({
  state,
  leg,
  method,
}: {
  state: CostBasisState;
  leg: CostBasisLeg;
  method: COST_BASIS_METHOD;
}): CostBasisState => {
  if (method === COST_BASIS_METHOD.fifo) {
    applyFifoLeg({ state, leg });
  } else {
    applyWeightedAverageLeg({ state, leg });
  }
  return state;
};

/**
 * Replays a full chronologically-sorted transaction list from scratch.
 * Cost basis floors at zero, matching the pre-fold guards above — this
 * clamp only matters as a defensive final step since the replay itself
 * never yields a negative basis.
 */
export const replayCostBasis = ({
  legs,
  method,
}: {
  legs: CostBasisLeg[];
  method: COST_BASIS_METHOD;
}): {
  quantity: Big;
  costBasis: Big;
  refCostBasis: Big;
  realizedGain: Big;
  refRealizedGain: Big;
  realizedCostBasis: Big;
  refRealizedCostBasis: Big;
} => {
  const state = createInitialCostBasisState();
  for (const leg of legs) {
    applyCostBasisLeg({ state, leg, method });
  }
  return {
    quantity: state.quantity,
    costBasis: state.costBasis.lt(0) ? new Big(0) : state.costBasis,
    refCostBasis: state.refCostBasis.lt(0) ? new Big(0) : state.refCostBasis,
    realizedGain: state.realizedGain,
    refRealizedGain: state.refRealizedGain,
    realizedCostBasis: state.realizedCostBasis,
    refRealizedCostBasis: state.refRealizedCostBasis,
  };
};
