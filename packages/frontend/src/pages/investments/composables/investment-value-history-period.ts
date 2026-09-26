import { format, subMonths, subYears } from 'date-fns';

export const INVESTMENT_HISTORY_PERIODS = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'All'] as const;
export type InvestmentHistoryPeriod = (typeof INVESTMENT_HISTORY_PERIODS)[number];

const DATE_FORMAT = 'yyyy-MM-dd';

/**
 * Resolves a preset period into the `{ from, to }` bounds the value-history
 * endpoint accepts. `to` is always today; `'All'` omits `from` so the backend
 * resolves it to the user's oldest recorded event.
 */
export const resolvePeriodRange = ({
  period,
  now = new Date(),
}: {
  period: InvestmentHistoryPeriod;
  now?: Date;
}): { from?: string; to: string } => {
  const to = format(now, DATE_FORMAT);

  if (period === 'All') return { to };

  const fromDate = (() => {
    switch (period) {
      case '1M':
        return subMonths(now, 1);
      case '3M':
        return subMonths(now, 3);
      case '6M':
        return subMonths(now, 6);
      case '1Y':
        return subYears(now, 1);
      case '3Y':
        return subYears(now, 3);
      case '5Y':
        return subYears(now, 5);
    }
  })();

  return { from: format(fromDate, DATE_FORMAT), to };
};
