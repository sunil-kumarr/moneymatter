export interface PortfolioValueHistoryItem {
  date: string;
  /** Holdings market value + portfolio cash + fixed-income position value, in the user's base currency. */
  currentValue: number;
  /**
   * Cumulative net cash deposited into portfolios (deposits minus withdrawals) plus fixed-income
   * cost basis (recognized on each position's initial-investment date), in base currency.
   */
  investedValue: number;
}
