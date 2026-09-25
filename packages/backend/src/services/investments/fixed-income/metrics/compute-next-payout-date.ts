import { FIXED_INCOME_POSITION_STATUS, INTEREST_PAYOUT_FREQUENCY } from '@bt/shared/types/investments';

const PAYOUT_INTERVAL_MONTHS: Partial<Record<INTEREST_PAYOUT_FREQUENCY, number>> = {
  [INTEREST_PAYOUT_FREQUENCY.monthly]: 1,
  [INTEREST_PAYOUT_FREQUENCY.quarterly]: 3,
  [INTEREST_PAYOUT_FREQUENCY.semi_annually]: 6,
  [INTEREST_PAYOUT_FREQUENCY.annually]: 12,
};

const CLOSED_STATUSES: readonly FIXED_INCOME_POSITION_STATUS[] = [
  FIXED_INCOME_POSITION_STATUS.fully_repaid,
  FIXED_INCOME_POSITION_STATUS.written_off,
];

/**
 * Projects the next interest payout date from the accrual clock's last reset point
 * (see `computeAccruedInterest`'s `accrualPoint`). Returns null when interest is
 * cumulative (nothing is paid out until maturity) or the position is closed.
 */
export function computeNextPayoutDate({
  accrualPoint,
  interestPayoutFrequency,
  status,
}: {
  accrualPoint: string;
  interestPayoutFrequency: INTEREST_PAYOUT_FREQUENCY;
  status: FIXED_INCOME_POSITION_STATUS;
}): string | null {
  if (CLOSED_STATUSES.includes(status)) return null;

  const intervalMonths = PAYOUT_INTERVAL_MONTHS[interestPayoutFrequency];
  if (!intervalMonths) return null;

  const next = new Date(`${accrualPoint}T00:00:00.000Z`);
  next.setUTCMonth(next.getUTCMonth() + intervalMonths);

  return next.toISOString().slice(0, 10);
}
