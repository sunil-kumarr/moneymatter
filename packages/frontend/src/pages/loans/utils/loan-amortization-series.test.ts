import { describe, expect, it } from 'vitest';

import { computeLoanAmortizationSeries, computeAggregateLoanAmortizationSeries } from './loan-amortization-series';

describe('computeLoanAmortizationSeries', () => {
  it('handles zero or negative principal gracefully', () => {
    const summary = computeLoanAmortizationSeries({
      originalPrincipal: 0,
      interestRate: 5,
      startDate: '2024-01-01',
    });
    expect(summary.totalPrincipal).toBe(0);
    expect(summary.points).toEqual([]);
  });

  it('correctly computes standard amortizing loan', () => {
    const summary = computeLoanAmortizationSeries({
      originalPrincipal: 12000,
      interestRate: 6,
      startDate: '2024-01-01',
      termMonths: 12,
    });

    expect(summary.totalPrincipal).toBe(12000);
    expect(summary.points.length).toBe(13); // month 0 to 12
    expect(summary.points[0]!.remainingPrincipal).toBe(12000);
    expect(summary.points[0]!.cumulativeInterest).toBe(0);

    const last = summary.points[summary.points.length - 1]!;
    expect(last.remainingPrincipal).toBe(0);
    expect(last.cumulativeInterest).toBeGreaterThan(0);
    expect(summary.totalInterest).toBe(last.cumulativeInterest);
    expect(summary.totalCost).toBe(12000 + summary.totalInterest);
  });

  it('identifies crossover date when monthly principal exceeds interest', () => {
    // 30-year mortgage with typical cross-over
    const summary = computeLoanAmortizationSeries({
      originalPrincipal: 200000,
      interestRate: 6,
      startDate: '2020-01-01',
      termMonths: 360,
    });

    expect(summary.paymentCrossoverDate).not.toBeNull();
    // At beginning, monthly interest is around 1000, monthly principal is around 200
    expect(summary.points[1]!.monthlyInterest).toBeGreaterThan(summary.points[1]!.monthlyPrincipal);
    // At end, monthly principal is much larger than monthly interest
    const end = summary.points[summary.points.length - 1]!;
    expect(end.monthlyPrincipal).toBeGreaterThan(end.monthlyInterest);
  });
});

describe('computeAggregateLoanAmortizationSeries', () => {
  it('returns empty summary for empty loans', () => {
    const summary = computeAggregateLoanAmortizationSeries({ loans: [] });
    expect(summary.totalPrincipal).toBe(0);
    expect(summary.points).toEqual([]);
  });

  it('aggregates multiple loans correctly', () => {
    const loan1 = {
      id: '1',
      name: 'Loan 1',
      currencyCode: 'USD',
      initialBalance: -10000,
      currentBalance: -8000,
      refCurrentBalance: -8000,
      loanDetails: {
        originalPrincipal: 10000,
        refOriginalPrincipal: 10000,
        interestRate: 5,
        startDate: '2024-01-01',
        termMonths: 12,
        plannedPayment: null,
        minPayment: null,
      },
      projection: { isPaidOff: false },
    } as any;

    const loan2 = {
      id: '2',
      name: 'Loan 2',
      currencyCode: 'USD',
      initialBalance: -20000,
      currentBalance: -20000,
      refCurrentBalance: -20000,
      loanDetails: {
        originalPrincipal: 20000,
        refOriginalPrincipal: 20000,
        interestRate: 6,
        startDate: '2024-01-01',
        termMonths: 24,
        plannedPayment: null,
        minPayment: null,
      },
      projection: { isPaidOff: false },
    } as any;

    const summary = computeAggregateLoanAmortizationSeries({
      loans: [loan1, loan2],
    });

    expect(summary.totalPrincipal).toBe(30000);
    expect(summary.points.length).toBeGreaterThan(20);
    expect(summary.points[0]!.remainingPrincipal).toBe(30000);
    const last = summary.points[summary.points.length - 1]!;
    expect(last.remainingPrincipal).toBe(0);
  });
});
