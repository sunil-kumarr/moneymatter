import { DAY_COUNT_CONVENTION } from '@bt/shared/types/investments';
import { differenceInCalendarDays } from 'date-fns';

const daysInYear = (convention: DAY_COUNT_CONVENTION): number =>
  convention === DAY_COUNT_CONVENTION.actual_365 ? 365 : 360;

/**
 * 30/360 (US/NASD, stub-month) day count: months are treated as having 30
 * days, so a day-31 endpoint collapses to 30 (and only collapses the start's
 * day-31 the same way when it's also the 30th already).
 */
const thirty360Days = (start: Date, end: Date): number => {
  let d1 = start.getUTCDate();
  let d2 = end.getUTCDate();
  const m1 = start.getUTCMonth() + 1;
  const m2 = end.getUTCMonth() + 1;
  const y1 = start.getUTCFullYear();
  const y2 = end.getUTCFullYear();

  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 === 30) d2 = 30;

  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
};

export function yearFraction({
  periodStart,
  periodEnd,
  convention,
}: {
  periodStart: Date;
  periodEnd: Date;
  convention: DAY_COUNT_CONVENTION;
}): number {
  const days =
    convention === DAY_COUNT_CONVENTION.thirty_360
      ? thirty360Days(periodStart, periodEnd)
      : differenceInCalendarDays(periodEnd, periodStart);

  return days / daysInYear(convention);
}
