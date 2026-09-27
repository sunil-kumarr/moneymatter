import { COST_BASIS_METHOD, INVESTMENT_TRANSACTION_CATEGORY } from '@bt/shared/types/investments';
import { describe, expect, it } from '@jest/globals';
import { Big } from 'big.js';

import { type CostBasisLeg, replayCostBasis } from './cost-basis-replay';

const buy = (quantity: number, amount: number): CostBasisLeg => ({
  category: INVESTMENT_TRANSACTION_CATEGORY.buy,
  quantity: new Big(quantity),
  amount: new Big(amount),
  refAmount: new Big(amount),
});

const sell = (quantity: number, proceeds: number): CostBasisLeg => ({
  category: INVESTMENT_TRANSACTION_CATEGORY.sell,
  quantity: new Big(quantity),
  amount: new Big(proceeds),
  refAmount: new Big(proceeds),
});

const gains = (legs: CostBasisLeg[], method: COST_BASIS_METHOD = COST_BASIS_METHOD.weighted_average) => {
  const result = replayCostBasis({ legs, method });
  return {
    realizedGain: result.realizedGain.toNumber(),
    realizedCostBasis: result.realizedCostBasis.toNumber(),
    costBasis: result.costBasis.toNumber(),
  };
};

describe('replayCostBasis realized-gain tracking', () => {
  it('accumulates realized gain proportionally under weighted-average', () => {
    const result = gains([buy(100, 1000), buy(100, 1500), sell(150, 3000)]);

    // Weighted-average cost: 2500/200 = 12.5/share; 150 sold shares cost 1875.
    expect(result.realizedCostBasis).toBeCloseTo(1875, 6);
    expect(result.realizedGain).toBeCloseTo(3000 - 1875, 6);
    // Remaining basis: 2500 - 1875 = 625.
    expect(result.costBasis).toBeCloseTo(625, 6);
  });

  it('accumulates realized gain per depleted lot under FIFO', () => {
    const result = gains([buy(100, 1000), buy(100, 1500), sell(150, 3000)], COST_BASIS_METHOD.fifo);

    // FIFO: 100 shares @ $10 (cost 1000) + 50 shares @ $15 (cost 750) = 1750.
    expect(result.realizedCostBasis).toBeCloseTo(1750, 6);
    expect(result.realizedGain).toBeCloseTo(3000 - 1750, 6);
  });

  it('books an oversell (phantom shares — e.g. bonus/split issue) as zero-cost gain', () => {
    const result = gains([buy(100, 1000), sell(150, 3000)]);

    // 100 real shares cost 1000; the extra 50 phantom shares cost nothing.
    expect(result.realizedCostBasis).toBeCloseTo(1000, 6);
    expect(result.realizedGain).toBeCloseTo(2000, 6); // 3000 - 1000
  });

  it('accumulates realized gain across multiple sells against a rebuy (weighted-average)', () => {
    const result = gains([buy(100, 1000), sell(50, 600), buy(75, 825), sell(25, 375)]);

    // Sell 1: cost/share 10, cost 500, proceeds 600 -> gain 100.
    // Remaining after sell 1: 50 shares, cost 500. Buy 75 @ 825 -> 125 shares, cost 1325.
    // Sell 2 (25 shares): weighted cost/share 1325/125 = 10.6, cost 265, proceeds 375 -> gain 110.
    expect(result.realizedGain).toBeCloseTo(210, 6);
    expect(result.realizedCostBasis).toBeCloseTo(765, 6);
  });
});
