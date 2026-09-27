export interface MonthlyRealizedPnlItem {
  /** Short month label, e.g. 'Apr', 'May', 'Nov' */
  month: string;
  /** Full calendar year for this month, e.g. 2023 */
  year: number;
  /** 'YYYY-MM' key for matching and sorting, e.g. '2023-11' */
  dateKey: string;
  /** Realized profit/loss for this month (can be positive, negative, or zero) */
  realizedPnl: number;
  /** Total charges/fees paid in this month */
  charges: number;
  /** Net realized P&L = realizedPnl - charges */
  netRealizedPnl: number;
  /** Number of trade/sell events in this month */
  tradeCount: number;
  /** Unrealized profit/loss for this month (e.g. current open positions in current month, or future projected maturities/interest) */
  unrealizedPnl?: number;
  /** Whether this month is in the future relative to today */
  isFuture?: boolean;
  /** Whether this month is the current month relative to today */
  isCurrent?: boolean;
}

export interface PortfolioRealizedPnlResponse {
  portfolioId: string;
  portfolioName: string;
  currencyCode: string;
  /** Total gross realized P&L for the selected period */
  totalRealizedPnl: number;
  /** Total charges for the selected period */
  totalCharges: number;
  /** Net realized P&L (totalRealizedPnl - totalCharges) */
  netRealizedPnl: number;
  /** Total unrealized P&L for active period (current month + future months in period) */
  totalUnrealizedPnl?: number;
  /** Active period identifier, e.g. 'FY 2023-24' or '1Y' */
  period: string;
  /** List of financial years available in this portfolio's transaction history */
  availableFinancialYears: string[];
  /** Monthly data points for the selected period */
  months: MonthlyRealizedPnlItem[];
}
