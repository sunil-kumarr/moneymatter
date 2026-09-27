export interface PortfolioValueHistoryItem {
  date: string;
  /** Holdings market value + portfolio cash + fixed-income position value, in the user's base currency. Null for future dates. */
  currentValue: number | null;
  /**
   * Cumulative net cash deposited into portfolios (deposits minus withdrawals) plus fixed-income
   * cost basis (recognized on each position's initial-investment date), in base currency.
   */
  investedValue: number;
  /**
   * Projected accrued value and expected maturity amount over future dates,
   * accounting for early repayments for fixed income with return cash to account set.
   */
  projectedValue?: number | null;
}
