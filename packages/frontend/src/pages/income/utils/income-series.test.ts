import { INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import { describe, expect, it } from 'vitest';

import { computeIncomeYDomain, getIncomeChartSeries } from './income-series';

const month = (overrides: Partial<Parameters<typeof getIncomeChartSeries>[0]['months'][number]>) => ({
  month: 'Apr',
  year: 2024,
  dateKey: '2024-04',
  gross: 80000,
  net: 60000,
  deductions: 20000,
  employerContributions: 4800,
  cumulativeNet: 60000,
  creditCount: 1,
  byType: { [INCOME_CREDIT_TYPE.regular_salary]: 60000 },
  ...overrides,
});

describe('getIncomeChartSeries', () => {
  it('maps to net values for the monthly view', () => {
    const series = getIncomeChartSeries({
      months: [
        month({ net: 60000, cumulativeNet: 60000 }),
        month({ dateKey: '2024-05', net: 55000, cumulativeNet: 115000 }),
      ],
      viewMode: 'monthly',
    });

    expect(series.map((p) => p.value)).toEqual([60000, 55000]);
  });

  it('maps to cumulativeNet values for the cumulative view', () => {
    const series = getIncomeChartSeries({
      months: [
        month({ net: 60000, cumulativeNet: 60000 }),
        month({ dateKey: '2024-05', net: 55000, cumulativeNet: 115000 }),
      ],
      viewMode: 'cumulative',
    });

    expect(series.map((p) => p.value)).toEqual([60000, 115000]);
  });
});

describe('computeIncomeYDomain', () => {
  it('pads a positive-only range while anchoring at zero', () => {
    const [min, max] = computeIncomeYDomain([0, 100]);
    expect(min).toBe(0);
    expect(max).toBeCloseTo(115);
  });

  it('returns a default domain for an all-zero series', () => {
    expect(computeIncomeYDomain([0, 0])).toEqual([0, 100]);
  });

  it('pads both sides for a mixed-sign range', () => {
    const [min, max] = computeIncomeYDomain([-50, 100]);
    expect(min).toBeCloseTo(-57.5);
    expect(max).toBeCloseTo(115);
  });
});
