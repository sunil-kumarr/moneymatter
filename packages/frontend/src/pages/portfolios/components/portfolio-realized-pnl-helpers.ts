export function getCurrentFinancialYear(date = new Date()): string {
  const month = date.getMonth(); // 0 = Jan, 3 = Apr
  const year = date.getFullYear();
  if (month >= 3) {
    const nextYear = (year + 1).toString().slice(-2);
    return `FY ${year}-${nextYear}`;
  }
  const prevYear = year - 1;
  const curYear = year.toString().slice(-2);
  return `FY ${prevYear}-${curYear}`;
}
