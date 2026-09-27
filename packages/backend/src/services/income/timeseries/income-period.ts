import { getFinancialYear, getFinancialYearRange } from '@services/common/financial-year';
import { parseISO, startOfDay, startOfMonth, subMonths, subYears } from 'date-fns';

export interface ResolvedIncomePeriod {
  activePeriod: string;
  isFyMode: boolean;
  startDate: Date;
  endDate: Date;
  availableFinancialYears: string[];
}

/**
 * Resolves the active reporting window for the income timeseries/summary
 * endpoints. Mirrors the period model used by
 * `getPortfolioRealizedPnl` (Indian FY + rolling-window presets) so both
 * features share one mental model for the user.
 */
export function resolveIncomePeriod({
  creditDates,
  period,
  financialYear,
  from,
  to,
}: {
  creditDates: Date[];
  period?: string;
  financialYear?: string;
  from?: string;
  to?: string;
}): ResolvedIncomePeriod {
  const fySet = new Set<string>();
  for (const date of creditDates) {
    fySet.add(getFinancialYear(date));
  }
  const availableFinancialYears = Array.from(fySet).toSorted().toReversed();

  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let activePeriod = period || financialYear || (availableFinancialYears[0] ?? getFinancialYear(now));
  let isFyMode = false;

  if (from && to) {
    startDate = startOfDay(parseISO(from));
    endDate = parseISO(to);
  } else if (financialYear || activePeriod.startsWith('FY')) {
    isFyMode = true;
    const fyRange = getFinancialYearRange(activePeriod);
    if (fyRange) {
      startDate = fyRange.start;
      endDate = fyRange.end;
    } else {
      const defaultFyRange = getFinancialYearRange(getFinancialYear(now))!;
      startDate = defaultFyRange.start;
      endDate = defaultFyRange.end;
      activePeriod = getFinancialYear(now);
    }
  } else {
    switch (activePeriod) {
      case '1M':
        startDate = subMonths(now, 1);
        endDate = now;
        break;
      case '3M':
        startDate = subMonths(now, 3);
        endDate = now;
        break;
      case '6M':
        startDate = subMonths(now, 6);
        endDate = now;
        break;
      case '1Y':
        if (availableFinancialYears.length > 0) {
          isFyMode = true;
          activePeriod = availableFinancialYears[0]!;
          const fyRange = getFinancialYearRange(activePeriod)!;
          startDate = fyRange.start;
          endDate = fyRange.end;
        } else {
          startDate = subYears(now, 1);
          endDate = now;
        }
        break;
      case '3Y':
        startDate = subYears(now, 3);
        endDate = now;
        break;
      case '5Y':
        startDate = subYears(now, 5);
        endDate = now;
        break;
      case 'All':
      default: {
        if (creditDates.length > 0) {
          const earliest = creditDates.reduce((min, d) => (d < min ? d : min), creditDates[0]!);
          startDate = startOfMonth(earliest);
        } else {
          startDate = subYears(now, 1);
        }
        endDate = now;
        break;
      }
    }
  }

  return { activePeriod, isFyMode, startDate, endDate, availableFinancialYears };
}
