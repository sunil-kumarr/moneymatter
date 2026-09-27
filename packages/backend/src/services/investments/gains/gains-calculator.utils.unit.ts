import {
  COST_BASIS_METHOD,
  INVESTMENT_TRADE_TYPE,
  INVESTMENT_TRANSACTION_CATEGORY,
} from '@bt/shared/types/investments/enums';
import { describe, expect, it } from '@jest/globals';

import {
  type TransactionForGains,
  calculateAllGains,
  calculateRealizedGains,
  calculateUnrealizedGains,
} from './gains-calculator.utils';

describe('Gains Calculator Utils', () => {
  describe('calculateUnrealizedGains', () => {
    it('should calculate positive unrealized gains correctly', () => {
      const result = calculateUnrealizedGains(1200, 1000);

      expect(result.unrealizedGainValue).toBe(200);
      expect(result.unrealizedGainPercent).toBe(20);
    });

    it('should calculate negative unrealized gains correctly', () => {
      const result = calculateUnrealizedGains(800, 1000);

      expect(result.unrealizedGainValue).toBe(-200);
      expect(result.unrealizedGainPercent).toBe(-20);
    });

    it('should handle zero cost basis', () => {
      const result = calculateUnrealizedGains(1000, 0);

      expect(result.unrealizedGainValue).toBe(1000);
      expect(result.unrealizedGainPercent).toBe(0);
    });

    it('should handle zero market value', () => {
      const result = calculateUnrealizedGains(0, 1000);

      expect(result.unrealizedGainValue).toBe(-1000);
      expect(result.unrealizedGainPercent).toBe(-100);
    });
  });

  describe('calculateRealizedGains', () => {
    it('should handle empty transaction list', () => {
      const result = calculateRealizedGains([]);

      expect(result.realizedGainValue).toBe(0);
      expect(result.realizedGainPercent).toBe(0);
    });

    it('should handle only buy transactions', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 10,
          fees: 5,
        },
      ];

      const result = calculateRealizedGains(transactions);

      expect(result.realizedGainValue).toBe(0);
      expect(result.realizedGainPercent).toBe(0);
    });

    it('should calculate simple buy-sell scenario with profit', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 10,
          fees: 5, // $0.05 per share added to cost basis
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 100,
          price: 15,
          fees: 10, // $0.10 per share deducted from proceeds
        },
      ];

      const result = calculateRealizedGains(transactions);

      // Buy: 100 shares at $10.05 each (including fees) = $1,005 cost basis
      // Sell: 100 shares at $15 each = $1,500 gross proceeds
      // Less sell fees: $1,500 - $10 = $1,490 net proceeds
      // Gain: $1,490 - $1,005 = $485
      // Percentage: ($485 / $1,005) * 100 = ~48.26%
      expect(result.realizedGainValue).toBeCloseTo(485, 2);
      expect(result.realizedGainPercent).toBeCloseTo(48.26, 2);
      expect(result.totalCostBasisOfSoldShares).toBeCloseTo(1005, 2);
      expect(result.totalProceedsFromSoldShares).toBeCloseTo(1490, 2);
    });

    it('should calculate simple buy-sell scenario with loss', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 20,
          fees: 5,
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 100,
          price: 15,
          fees: 10,
        },
      ];

      const result = calculateRealizedGains(transactions);

      // Buy: 100 shares at $20.05 each = $2,005 cost basis
      // Sell: 100 shares at $15 each - $10 fees = $1,490 net proceeds
      // Loss: $1,490 - $2,005 = -$515
      // Percentage: (-$515 / $2,005) * 100 = ~-25.69%
      expect(result.realizedGainValue).toBeCloseTo(-515, 2);
      expect(result.realizedGainPercent).toBeCloseTo(-25.69, 2);
      expect(result.totalCostBasisOfSoldShares).toBeCloseTo(2005, 2);
      expect(result.totalProceedsFromSoldShares).toBeCloseTo(1490, 2);
    });

    it('should handle FIFO (First In, First Out) correctly for FIFO-method securities (mutual funds)', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 10,
          fees: 0,
        },
        {
          date: '2023-02-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 15,
          fees: 0,
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 50, // Should sell from first lot (cheapest)
          price: 20,
          fees: 0,
        },
      ];

      const result = calculateRealizedGains(transactions, COST_BASIS_METHOD.fifo);

      // Sell 50 shares from first lot (bought at $10)
      // Gain: (50 * $20) - (50 * $10) = $1,000 - $500 = $500
      // Percentage: ($500 / $500) * 100 = 100%
      expect(result.realizedGainValue).toBeCloseTo(500, 2);
      expect(result.realizedGainPercent).toBeCloseTo(100, 2);
    });

    it('should handle partial sales across multiple lots (FIFO method)', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 10,
          fees: 0,
        },
        {
          date: '2023-02-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 15,
          fees: 0,
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 150, // Sells all of first lot + 50 of second lot
          price: 20,
          fees: 0,
        },
      ];

      const result = calculateRealizedGains(transactions, COST_BASIS_METHOD.fifo);

      // Sell 100 shares from first lot at $10 + 50 shares from second lot at $15
      // First lot gain: (100 * $20) - (100 * $10) = $1,000
      // Second lot gain: (50 * $20) - (50 * $15) = $250
      // Total gain: $1,000 + $250 = $1,250
      // Total cost basis of sold shares: (100 * $10) + (50 * $15) = $1,750
      // Percentage: ($1,250 / $1,750) * 100 = ~71.43%
      expect(result.realizedGainValue).toBeCloseTo(1250, 2);
      expect(result.realizedGainPercent).toBeCloseTo(71.43, 2);
    });

    it('should default to weighted-average for multi-lot partial sales when no method is given (stocks/crypto)', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 10,
          fees: 0,
        },
        {
          date: '2023-02-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 15,
          fees: 0,
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 150,
          price: 20,
          fees: 0,
        },
      ];

      const result = calculateRealizedGains(transactions);

      // Weighted-average cost: (100*10 + 100*15) / 200 = $12.5/share
      // Cost of 150 sold shares: 150 * 12.5 = $1,875
      // Proceeds: 150 * 20 = $3,000
      // Gain: $3,000 - $1,875 = $1,125; Percentage: 1125/1875*100 = 60%
      expect(result.realizedGainValue).toBeCloseTo(1125, 2);
      expect(result.realizedGainPercent).toBeCloseTo(60, 2);
    });

    it('should handle multiple buy and sell transactions (FIFO method)', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 10,
          fees: 0,
        },
        {
          date: '2023-02-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 50,
          price: 12,
          fees: 0,
        },
        {
          date: '2023-03-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 75,
          price: 11,
          fees: 0,
        },
        {
          date: '2023-04-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 25,
          price: 15,
          fees: 0,
        },
      ];

      const result = calculateRealizedGains(transactions, COST_BASIS_METHOD.fifo);

      // First sell: 50 shares at $12, cost basis $10 = (50 * $12) - (50 * $10) = $100 gain
      // Second sell: 25 shares at $15, cost basis $10 (from remaining first lot) = (25 * $15) - (25 * $10) = $125 gain
      // Total: $100 + $125 = $225
      // Total cost basis of sold shares: (50 + 25) * $10 = $750
      // Percentage: ($225 / $750) * 100 = 30%
      expect(result.realizedGainValue).toBeCloseTo(225, 2);
      expect(result.realizedGainPercent).toBeCloseTo(30, 2);
    });

    it('should not let a same-day intraday round trip match against an older delivery lot (the core regression)', () => {
      const transactions: TransactionForGains[] = [
        // Old delivery lot bought cheap, still held.
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 10,
          fees: 0,
          tradeType: INVESTMENT_TRADE_TYPE.delivery,
        },
        // Same-day intraday round trip at a much higher price, months later.
        {
          date: '2023-06-01T09:20:00Z',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 20,
          price: 100,
          fees: 0,
          tradeType: INVESTMENT_TRADE_TYPE.intraday,
        },
        {
          date: '2023-06-01T15:20:00Z',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 20,
          price: 102,
          fees: 0,
          tradeType: INVESTMENT_TRADE_TYPE.intraday,
        },
      ];

      const result = calculateRealizedGains(transactions);

      // Intraday leg must match against its own same-day buy (20 * (102-100) = $40),
      // never against the $10 delivery lot (which would inflate this to ~$1,840).
      expect(result.realizedGainValue).toBeCloseTo(40, 2);
      expect(result.totalCostBasisOfSoldShares).toBeCloseTo(2000, 2); // 20 * $100, not 20 * $10
      // The delivery lot itself was never sold, so it contributes nothing here.
    });

    it('should sum multiple same-day intraday round trips independently of delivery holdings', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 50,
          price: 200,
          fees: 0,
          tradeType: INVESTMENT_TRADE_TYPE.delivery,
        },
        {
          date: '2023-06-01T09:20:00Z',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 1000,
          price: 16,
          fees: 0,
          tradeType: INVESTMENT_TRADE_TYPE.intraday,
        },
        {
          date: '2023-06-01T09:45:00Z',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 1000,
          price: 16.5,
          fees: 0,
          tradeType: INVESTMENT_TRADE_TYPE.intraday,
        },
        {
          date: '2023-06-01T10:00:00Z',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 500,
          price: 16.4,
          fees: 0,
          tradeType: INVESTMENT_TRADE_TYPE.intraday,
        },
        {
          date: '2023-06-01T10:15:00Z',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 500,
          price: 16.3,
          fees: 0,
          tradeType: INVESTMENT_TRADE_TYPE.intraday,
        },
      ];

      const result = calculateRealizedGains(transactions);

      // Round trip 1: 1000 * (16.5 - 16) = $500
      // Round trip 2: 500 * (16.3 - 16.4) = -$50
      // Total: $450, and the untouched delivery lot contributes nothing.
      expect(result.realizedGainValue).toBeCloseTo(450, 2);
    });

    it('should handle transactions with string values', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: '100',
          price: '10.50',
          fees: '5.00',
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: '100',
          price: '15.75',
          fees: '7.50',
        },
      ];

      const result = calculateRealizedGains(transactions);

      // Buy: 100 shares at $10.55 each (including $0.05 fees per share) = $1,055 cost basis
      // Sell: 100 shares at $15.75 each - $7.50 fees = $1,567.50 net proceeds
      // Gain: $1,567.50 - $1,055 = $512.50
      // Percentage: ($512.50 / $1,055) * 100 = ~48.58%
      expect(result.realizedGainValue).toBeCloseTo(512.5, 2);
      expect(result.realizedGainPercent).toBeCloseTo(48.58, 2);
    });

    it('should handle selling more than owned (phantom shares)', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 100,
          price: 10,
          fees: 0,
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 150, // More than owned
          price: 15,
          fees: 0,
        },
      ];

      const result = calculateRealizedGains(transactions);

      // 100 owned shares: (15-10) * 100 = $500 gain
      // 50 phantom shares: 15 * 50 = $750 gain (zero cost basis)
      // Total: $1,250 gain
      expect(result.realizedGainValue).toBeCloseTo(1250, 2);
    });

    it('should handle user example: sell 15 shares when owning 10, last 5 sold for $250', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 10,
          price: 100, // Bought 10 shares at $100 each
          fees: 0,
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 15, // Selling 15 shares (5 more than owned)
          price: 250, // At $250 each
          fees: 0,
        },
      ];

      const result = calculateRealizedGains(transactions);

      // 10 owned shares: (250-100) * 10 = $1,500 gain
      // 5 phantom shares: 250 * 5 = $1,250 gain (zero cost basis)
      // Total: $2,750 gain
      expect(result.realizedGainValue).toBeCloseTo(2750, 2);

      // Percentage based on cost basis of real shares: $2,750 / $1,000 = 275%
      expect(result.realizedGainPercent).toBeCloseTo(275, 2);
    });

    it('should handle pure phantom shares scenario', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 5, // Selling without any purchases
          price: 250,
          fees: 0,
        },
      ];

      const result = calculateRealizedGains(transactions);

      // Pure phantom shares: 250 * 5 = $1,250 gain
      expect(result.realizedGainValue).toBeCloseTo(1250, 2);

      // Pure phantom shares should return 100% (pure profit with no investment)
      expect(result.realizedGainPercent).toBe(100);
    });
  });

  describe('calculateAllGains', () => {
    it('should combine unrealized and realized gains correctly', () => {
      const transactions: TransactionForGains[] = [
        {
          date: '2023-01-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.buy,
          quantity: 200,
          price: 10,
          fees: 0,
        },
        {
          date: '2023-06-01',
          category: INVESTMENT_TRANSACTION_CATEGORY.sell,
          quantity: 100,
          price: 15,
          fees: 0,
        },
      ];

      const marketValue = 1200; // 100 remaining shares at $12 each
      const costBasis = 2000; // Original purchase of 200 shares at $10 each

      const result = calculateAllGains(marketValue, costBasis, transactions);

      expect(result.unrealizedGainValue).toBe(-800); // $1,200 - $2,000 = -$800
      expect(result.unrealizedGainPercent).toBe(-40); // (-$800 / $2,000) * 100 = -40%
      expect(result.realizedGainValue).toBe(500); // Sold 100 shares: (100 * $15) - (100 * $10) = $500
      expect(result.realizedGainPercent).toBe(50); // ($500 / $1,000) * 100 = 50%
    });
  });
});
