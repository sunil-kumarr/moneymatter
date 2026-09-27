export interface IncomeSourceSummaryModel {
  sourceId: string;
  sourceName: string;
  currencyCode: string;
  baseCurrencyCode: string;

  totalGross: string;
  totalNet: string;
  totalDeductions: string;
  totalEmployerContributions: string;
  effectiveDeductionRatePct: string | null;

  ytdGross: string;
  ytdNet: string;
  fyLabel: string;
  fyGross: string;
  fyNet: string;

  avgMonthlyNet: string;
  monthsCounted: number;
  latestCreditDate: string | null;
  latestCreditNet: string | null;

  annualRunRateNet: string;
  yoyGrowthPct: string | null;
  lastRaiseDate: string | null;
  lastRaiseAmount: string | null;
  lastRaisePct: string | null;

  expectedAnnualCtc: string | null;
  expectedVsActualPct: string | null;
  totalNetInBaseCurrency: string;
}
