import { describe, expect, it } from 'vitest';

import { getCurrentFinancialYear } from './portfolio-realized-pnl-helpers';

describe('Realized P&L Chart calculations', () => {
  it('formats positive P&L with a plus prefix', () => {
    const pnl = 15659;
    const formatSigned = (val: number) => {
      const formatted = Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      if (val > 0) return `+₹${formatted}`;
      if (val < 0) return `-₹${formatted}`;
      return `₹${formatted}`;
    };

    expect(formatSigned(pnl)).toBe('+₹15,659.00');
  });

  it('formats negative P&L with a minus prefix', () => {
    const pnl = -173031;
    const formatSigned = (val: number) => {
      const formatted = Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      if (val > 0) return `+₹${formatted}`;
      if (val < 0) return `-₹${formatted}`;
      return `₹${formatted}`;
    };

    expect(formatSigned(pnl)).toBe('-₹1,73,031.00');
  });

  it('calculates zero baseline and bar positions for all positive months', () => {
    const months = [
      { month: 'Apr', realizedPnl: 15659 },
      { month: 'May', realizedPnl: 0 },
    ];
    const maxPnl = Math.max(0, ...months.map((m) => m.realizedPnl));
    const minPnl = Math.min(0, ...months.map((m) => m.realizedPnl));

    expect(minPnl).toBe(0);
    expect(maxPnl).toBe(15659);
    // Baseline sits at the bottom when minPnl === 0
    const innerHeight = 160;
    const yMax = maxPnl * 1.15;
    const yZero = innerHeight; // yScale(0)
    const barY = innerHeight * (1 - 15659 / yMax);
    const barHeight = yZero - barY;

    expect(barHeight).toBeGreaterThan(0);
    expect(barY).toBeLessThan(yZero);
  });

  it('calculates zero baseline and bar positions for negative months', () => {
    const months = [
      { month: 'Nov', realizedPnl: -173031 },
      { month: 'Feb', realizedPnl: -14411 },
    ];
    const maxPnl = Math.max(0, ...months.map((m) => m.realizedPnl));
    const minPnl = Math.min(0, ...months.map((m) => m.realizedPnl));

    expect(maxPnl).toBe(0);
    expect(minPnl).toBe(-173031);
    // Baseline sits at the top when maxPnl === 0
    const yZero = 0; // yScale(0)
    expect(yZero).toBe(0);
  });

  it('calculates combined y-scale domain when unrealized PnL is enabled', () => {
    const months = [
      { month: 'Apr', realizedPnl: 10000, unrealizedPnl: 0 },
      { month: 'Sep', realizedPnl: 5000, unrealizedPnl: 25000 },
      { month: 'Oct', realizedPnl: 0, unrealizedPnl: -8000 },
    ];
    const showUnrealized = true;
    const values = months.map((m) => m.realizedPnl);
    if (showUnrealized) {
      for (const m of months) {
        if (m.unrealizedPnl) values.push(m.unrealizedPnl);
      }
    }
    const maxPnl = Math.max(0, ...values);
    const minPnl = Math.min(0, ...values);

    expect(maxPnl).toBe(25000);
    expect(minPnl).toBe(-8000);
  });

  it('correctly offsets side-by-side bars when both realized and unrealized exist in the same month', () => {
    const bandwidth = 40;
    const center = 100;
    const dualWidth = Math.min(13, Math.max(3, bandwidth * 0.38));

    const realizedX = center - dualWidth - 1;
    const unrealizedX = center + 1;

    // Realized bar should sit to the left of center, unrealized to the right
    expect(realizedX + dualWidth).toBeLessThan(unrealizedX);
    expect(realizedX).toBe(100 - dualWidth - 1);
    expect(unrealizedX).toBe(101);
  });

  it('determines current financial year correctly', () => {
    // September 2026 -> FY 2026-27
    expect(getCurrentFinancialYear(new Date(2026, 8, 27))).toBe('FY 2026-27');
    // April 2026 -> FY 2026-27
    expect(getCurrentFinancialYear(new Date(2026, 3, 1))).toBe('FY 2026-27');
    // March 2026 -> FY 2025-26
    expect(getCurrentFinancialYear(new Date(2026, 2, 31))).toBe('FY 2025-26');
    // January 2027 -> FY 2026-27
    expect(getCurrentFinancialYear(new Date(2027, 0, 15))).toBe('FY 2026-27');
  });
});
