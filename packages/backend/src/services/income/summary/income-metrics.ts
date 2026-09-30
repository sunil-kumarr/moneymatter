import { INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import { getFinancialYear, getFinancialYearRange } from '@services/common/financial-year';
import { addDays, differenceInCalendarDays } from 'date-fns';

export interface IncomeMetricCredit {
  creditDate: string;
  creditType: INCOME_CREDIT_TYPE;
  gross: number;
  net: number;
  deductions: number;
  employerContributions: number;
}

export interface ComputedIncomeMetrics {
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  totalEmployerContributions: number;
  effectiveDeductionRatePct: number | null;
  ytdGross: number;
  ytdNet: number;
  fyLabel: string;
  fyGross: number;
  fyNet: number;
  avgMonthlyNet: number;
  monthsCounted: number;
  latestCreditDate: string | null;
  latestCreditNet: number | null;
  annualRunRateNet: number;
  yoyGrowthPct: number | null;
  lastRaiseDate: string | null;
  lastRaiseAmount: number | null;
  lastRaisePct: number | null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Pure aggregation of a source's full credit history into the summary-panel
 * KPIs. Takes plain numbers (already converted to the display currency) so
 * it stays unit-testable without touching the DB or Money.
 */
export function computeIncomeMetrics({
  credits,
  now = new Date(),
}: {
  credits: IncomeMetricCredit[];
  now?: Date;
}): ComputedIncomeMetrics {
  const sorted = credits.toSorted((a, b) => a.creditDate.localeCompare(b.creditDate));

  const totalGross = round2(sorted.reduce((acc, c) => acc + c.gross, 0));
  const totalNet = round2(sorted.reduce((acc, c) => acc + c.net, 0));
  const totalDeductions = round2(sorted.reduce((acc, c) => acc + c.deductions, 0));
  const totalEmployerContributions = round2(sorted.reduce((acc, c) => acc + c.employerContributions, 0));
  const effectiveDeductionRatePct = totalGross > 0 ? round2((totalDeductions / totalGross) * 100) : null;

  const fyLabel = getFinancialYear(now);
  const fyCredits = sorted.filter((c) => getFinancialYear(new Date(`${c.creditDate}T00:00:00.000Z`)) === fyLabel);
  const fyGross = round2(fyCredits.reduce((acc, c) => acc + c.gross, 0));
  const fyNet = round2(fyCredits.reduce((acc, c) => acc + c.net, 0));

  // YTD is defined relative to the active financial year, consistent with fyLabel/fyGross/fyNet.
  const ytdGross = fyGross;
  const ytdNet = fyNet;

  const monthKeys = new Set(sorted.map((c) => c.creditDate.slice(0, 7)));
  const monthsCounted = monthKeys.size;
  const avgMonthlyNet = monthsCounted > 0 ? round2(totalNet / monthsCounted) : 0;

  const latest = sorted.at(-1) ?? null;
  const latestCreditDate = latest?.creditDate ?? null;
  const latestCreditNet = latest ? round2(latest.net) : null;

  const regularCredits = sorted.filter((c) => c.creditType === INCOME_CREDIT_TYPE.regular_salary);
  const latestRegular = regularCredits.at(-1);
  const annualRunRateNet = round2((latestRegular?.net ?? avgMonthlyNet) * 12);

  // Compare net income so far this FY against the SAME elapsed portion of the previous FY
  // (not the previous FY's full 12 months) — otherwise a partial current year always looks
  // like a decline against a complete prior year.
  const fyRange = getFinancialYearRange(fyLabel);
  const prevFyLabel = getFinancialYear(new Date(now.getFullYear() - 1, now.getMonth(), 1));
  const prevFyRange = getFinancialYearRange(prevFyLabel);

  let yoyGrowthPct: number | null = null;
  if (fyRange && prevFyRange) {
    const daysElapsedInFy = differenceInCalendarDays(now, fyRange.start);
    const prevFyToDateEnd = addDays(prevFyRange.start, daysElapsedInFy);
    const prevFyToDateNet = round2(
      sorted
        .filter((c) => {
          const creditDate = new Date(`${c.creditDate}T00:00:00.000Z`);
          return creditDate >= prevFyRange.start && creditDate <= prevFyToDateEnd;
        })
        .reduce((acc, c) => acc + c.net, 0),
    );
    yoyGrowthPct = prevFyToDateNet > 0 ? round2(((fyNet - prevFyToDateNet) / prevFyToDateNet) * 100) : null;
  }

  let lastRaiseDate: string | null = null;
  let lastRaiseAmount: number | null = null;
  let lastRaisePct: number | null = null;
  for (let i = 1; i < regularCredits.length; i++) {
    const prev = regularCredits[i - 1]!;
    const curr = regularCredits[i]!;
    if (curr.gross > prev.gross) {
      lastRaiseDate = curr.creditDate;
      lastRaiseAmount = round2(curr.gross - prev.gross);
      lastRaisePct = prev.gross > 0 ? round2(((curr.gross - prev.gross) / prev.gross) * 100) : null;
    }
  }

  return {
    totalGross,
    totalNet,
    totalDeductions,
    totalEmployerContributions,
    effectiveDeductionRatePct,
    ytdGross,
    ytdNet,
    fyLabel,
    fyGross,
    fyNet,
    avgMonthlyNet,
    monthsCounted,
    latestCreditDate,
    latestCreditNet,
    annualRunRateNet,
    yoyGrowthPct,
    lastRaiseDate,
    lastRaiseAmount,
    lastRaisePct,
  };
}
