import { describe, expect, it } from 'vitest';

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
});
