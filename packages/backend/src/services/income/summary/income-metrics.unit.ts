import { INCOME_CREDIT_TYPE } from '@bt/shared/types/income';

import { computeIncomeMetrics, type IncomeMetricCredit } from './income-metrics';

const credit = (overrides: Partial<IncomeMetricCredit>): IncomeMetricCredit => ({
  creditDate: '2024-04-05',
  creditType: INCOME_CREDIT_TYPE.regular_salary,
  gross: 80000,
  net: 60000,
  deductions: 20000,
  employerContributions: 4800,
  ...overrides,
});

describe('computeIncomeMetrics', () => {
  it('aggregates totals and the effective deduction rate across credits', () => {
    const metrics = computeIncomeMetrics({
      credits: [credit({ creditDate: '2024-04-05' }), credit({ creditDate: '2024-05-05' })],
      now: new Date('2024-06-01T00:00:00Z'),
    });

    expect(metrics.totalGross).toBe(160000);
    expect(metrics.totalNet).toBe(120000);
    expect(metrics.effectiveDeductionRatePct).toBe(25);
    expect(metrics.monthsCounted).toBe(2);
    expect(metrics.avgMonthlyNet).toBe(60000);
    expect(metrics.latestCreditDate).toBe('2024-05-05');
  });

  it('returns null rates and zero totals with no credits', () => {
    const metrics = computeIncomeMetrics({ credits: [] });

    expect(metrics.totalGross).toBe(0);
    expect(metrics.effectiveDeductionRatePct).toBeNull();
    expect(metrics.latestCreditDate).toBeNull();
    expect(metrics.monthsCounted).toBe(0);
  });

  it('detects a raise as an increase in gross between consecutive regular_salary credits', () => {
    const metrics = computeIncomeMetrics({
      credits: [credit({ creditDate: '2024-04-05', gross: 80000 }), credit({ creditDate: '2024-05-05', gross: 88000 })],
      now: new Date('2024-06-01T00:00:00Z'),
    });

    expect(metrics.lastRaiseDate).toBe('2024-05-05');
    expect(metrics.lastRaiseAmount).toBe(8000);
    expect(metrics.lastRaisePct).toBe(10);
  });

  it('ignores bonus/arrears credits when detecting a raise', () => {
    const metrics = computeIncomeMetrics({
      credits: [
        credit({ creditDate: '2024-04-05', gross: 80000, creditType: INCOME_CREDIT_TYPE.regular_salary }),
        credit({ creditDate: '2024-04-10', gross: 200000, creditType: INCOME_CREDIT_TYPE.bonus }),
        credit({ creditDate: '2024-05-05', gross: 80000, creditType: INCOME_CREDIT_TYPE.regular_salary }),
      ],
      now: new Date('2024-06-01T00:00:00Z'),
    });

    expect(metrics.lastRaiseDate).toBeNull();
  });
});
