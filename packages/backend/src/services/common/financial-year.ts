/**
 * Returns the Indian Financial Year string (e.g. 'FY 2023-24') for a given date.
 * Apr 1 to Mar 31 defines the financial year.
 */
export function getFinancialYear(date: Date): string {
  const month = date.getUTCMonth(); // 0 = Jan, 3 = Apr
  const year = date.getUTCFullYear();
  if (month >= 3) {
    const nextYear = (year + 1).toString().slice(-2);
    return `FY ${year}-${nextYear}`;
  }
  const prevYear = year - 1;
  const curYear = year.toString().slice(-2);
  return `FY ${prevYear}-${curYear}`;
}

/**
 * Returns { start: Date, end: Date } for an FY string like 'FY 2023-24' or 'FY2023-24'.
 */
export function getFinancialYearRange(fyStr: string): { start: Date; end: Date } | null {
  const match = fyStr.match(/(\d{4})/);
  if (!match) return null;
  const startYear = parseInt(match[1]!, 10);
  return {
    start: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)), // Apr 1
    end: new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)), // Mar 31
  };
}
