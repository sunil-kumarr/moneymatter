import { getFinancialYear, getFinancialYearRange } from './get-portfolio-realized-pnl.service';

describe('getFinancialYear', () => {
  it('identifies financial years accurately for Indian calendar (Apr-Mar)', () => {
    // April 2023 -> FY 2023-24
    expect(getFinancialYear(new Date('2023-04-01T00:00:00Z'))).toBe('FY 2023-24');
    // November 2023 -> FY 2023-24
    expect(getFinancialYear(new Date('2023-11-15T00:00:00Z'))).toBe('FY 2023-24');
    // December 2023 -> FY 2023-24
    expect(getFinancialYear(new Date('2023-12-31T23:59:59Z'))).toBe('FY 2023-24');
    // January 2024 -> FY 2023-24
    expect(getFinancialYear(new Date('2024-01-15T00:00:00Z'))).toBe('FY 2023-24');
    // February 2024 -> FY 2023-24
    expect(getFinancialYear(new Date('2024-02-01T00:00:00Z'))).toBe('FY 2023-24');
    // March 2024 -> FY 2023-24
    expect(getFinancialYear(new Date('2024-03-31T23:59:59Z'))).toBe('FY 2023-24');
    // April 2024 -> FY 2024-25
    expect(getFinancialYear(new Date('2024-04-01T00:00:00Z'))).toBe('FY 2024-25');
  });
});

describe('getFinancialYearRange', () => {
  it('correctly parses FY range from string', () => {
    const range = getFinancialYearRange('FY 2023-24');
    expect(range).not.toBeNull();
    expect(range!.start.toISOString()).toContain('2023-04-01');
    expect(range!.end.toISOString()).toContain('2024-03-31');
  });

  it('returns null for invalid string', () => {
    expect(getFinancialYearRange('invalid')).toBeNull();
  });
});
