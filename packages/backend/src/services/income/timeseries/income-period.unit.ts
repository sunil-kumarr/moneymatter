import { resolveIncomePeriod } from './income-period';

describe('resolveIncomePeriod', () => {
  it('defaults to the most recent financial year seen in the credit history', () => {
    const result = resolveIncomePeriod({
      creditDates: [new Date('2023-05-01T00:00:00Z'), new Date('2024-05-01T00:00:00Z')],
    });

    expect(result.isFyMode).toBe(true);
    expect(result.activePeriod).toBe('FY 2024-25');
    expect(result.availableFinancialYears).toEqual(['FY 2024-25', 'FY 2023-24']);
  });

  it('resolves an explicit financialYear param into its FY date range', () => {
    const result = resolveIncomePeriod({ creditDates: [], financialYear: 'FY 2023-24' });

    expect(result.isFyMode).toBe(true);
    expect(result.startDate.toISOString()).toContain('2023-04-01');
    expect(result.endDate.toISOString()).toContain('2024-03-31');
  });

  it('honors an explicit from/to range over FY mode', () => {
    const result = resolveIncomePeriod({ creditDates: [], from: '2024-01-01', to: '2024-02-01' });

    expect(result.isFyMode).toBe(false);
    expect(result.startDate.toISOString()).toContain('2024-01-01');
  });
});
