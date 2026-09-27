import { INCOME_CREDIT_TYPE } from './enums';

export interface MonthlyIncomeItem {
  /** Short month label, e.g. 'Apr', 'May', 'Nov' */
  month: string;
  /** Full calendar year for this month, e.g. 2026 */
  year: number;
  /** 'YYYY-MM' key for matching and sorting, e.g. '2026-04' */
  dateKey: string;
  gross: number;
  net: number;
  deductions: number;
  employerContributions: number;
  /** Cumulative net income within the active period, accumulated in month order */
  cumulativeNet: number;
  creditCount: number;
  /** Net amount per credit type this month, for stacked-bar rendering */
  byType: Partial<Record<INCOME_CREDIT_TYPE, number>>;
  isCurrent?: boolean;
  isFuture?: boolean;
}

export interface IncomeTimeseriesResponse {
  sourceId: string;
  sourceName: string;
  currencyCode: string;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  /** Active period identifier, e.g. 'FY 2026-27' or '1Y' */
  period: string;
  availableFinancialYears: string[];
  months: MonthlyIncomeItem[];
}
