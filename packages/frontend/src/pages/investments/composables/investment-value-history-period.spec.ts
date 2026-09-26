import { describe, expect, it } from 'vitest';

import { resolvePeriodRange } from './investment-value-history-period';

const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('resolvePeriodRange', () => {
  it('resolves 1M to one month back from now', () => {
    expect(resolvePeriodRange({ period: '1M', now: NOW })).toEqual({ from: '2026-08-26', to: '2026-09-26' });
  });

  it('resolves 1Y to one year back from now', () => {
    expect(resolvePeriodRange({ period: '1Y', now: NOW })).toEqual({ from: '2025-09-26', to: '2026-09-26' });
  });

  it('resolves 5Y to five years back from now', () => {
    expect(resolvePeriodRange({ period: '5Y', now: NOW })).toEqual({ from: '2021-09-26', to: '2026-09-26' });
  });

  it('omits `from` for All so the backend resolves the oldest event date', () => {
    expect(resolvePeriodRange({ period: 'All', now: NOW })).toEqual({ to: '2026-09-26' });
  });
});
