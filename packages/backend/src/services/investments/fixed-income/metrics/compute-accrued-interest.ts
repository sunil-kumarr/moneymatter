import {
  DAY_COUNT_CONVENTION,
  FIXED_INCOME_EVENT_TYPE,
  INTEREST_COMPOUNDING_FREQUENCY,
} from '@bt/shared/types/investments';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import Big from 'big.js';

import { yearFraction } from './day-count';

const COMPOUNDING_PERIODS_PER_YEAR: Partial<Record<INTEREST_COMPOUNDING_FREQUENCY, number>> = {
  [INTEREST_COMPOUNDING_FREQUENCY.annually]: 1,
  [INTEREST_COMPOUNDING_FREQUENCY.semi_annually]: 2,
  [INTEREST_COMPOUNDING_FREQUENCY.quarterly]: 4,
  [INTEREST_COMPOUNDING_FREQUENCY.monthly]: 12,
};

const PRINCIPAL_REDUCING_TYPES: readonly FIXED_INCOME_EVENT_TYPE[] = [
  FIXED_INCOME_EVENT_TYPE.partial_repayment,
  FIXED_INCOME_EVENT_TYPE.full_repayment,
  FIXED_INCOME_EVENT_TYPE.maturity,
];

interface AccruedInterestResult {
  principalOutstanding: string;
  principalReturnedToDate: string;
  writtenDownTotal: string;
  accruedUnpaidInterest: string;
  totalInterestReceived: string;
}

function computeSegmentInterest({
  principal,
  ratePct,
  compoundingFrequency,
  dayCountConvention,
  periodStart,
  periodEnd,
}: {
  principal: Big;
  ratePct: string;
  compoundingFrequency: INTEREST_COMPOUNDING_FREQUENCY | null;
  dayCountConvention: DAY_COUNT_CONVENTION;
  periodStart: Date;
  periodEnd: Date;
}): Big {
  const years = yearFraction({ periodStart, periodEnd, convention: dayCountConvention });
  if (years <= 0 || principal.lte(0)) return new Big(0);

  const rate = new Big(ratePct).div(100);

  if (!compoundingFrequency || compoundingFrequency === INTEREST_COMPOUNDING_FREQUENCY.simple) {
    return principal.times(rate).times(years);
  }

  const periodsPerYear = COMPOUNDING_PERIODS_PER_YEAR[compoundingFrequency]!;
  // Fractional exponents (partial-year segments) aren't supported by Big.js's
  // integer-only pow, so growth is computed in floating point — acceptable
  // here since this is a live unrealized-value estimate, not a stored ledger amount.
  const growthFactor = Math.pow(1 + Number(rate) / periodsPerYear, periodsPerYear * years);
  return principal.times(growthFactor).minus(principal);
}

/**
 * Walks a fixed-income position's event ledger chronologically to derive
 * principal outstanding and interest accrued-but-unpaid as of `asOfDate`.
 * Interest is never stored — only principal-changing events and payout
 * events are — so this must be recomputed on every read.
 *
 * `interest_accrual_payout` resets the unpaid-interest clock to zero at that
 * event's date, on the assumption the payout covers everything accrued up to
 * that point (the event's own `grossAmount` is the recorded cash amount for
 * transaction-linking purposes, not re-validated against this computation).
 */
export function computeAccruedInterest({
  principal,
  interestRatePct,
  compoundingFrequency,
  dayCountConvention,
  startDate,
  events,
  asOfDate,
}: {
  principal: string;
  interestRatePct: string;
  compoundingFrequency: INTEREST_COMPOUNDING_FREQUENCY | null;
  dayCountConvention: DAY_COUNT_CONVENTION;
  startDate: string;
  events: readonly FixedIncomeEvents[];
  asOfDate: Date;
}): AccruedInterestResult {
  const sortedEvents = [...events].sort((a, b) => {
    const dateCmp = a.eventDate.localeCompare(b.eventDate);
    if (dateCmp !== 0) return dateCmp;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  let principalOutstanding = new Big(0);
  let principalReturnedToDate = new Big(0);
  let writtenDownTotal = new Big(0);
  let totalInterestReceived = new Big(0);
  let unpaidInterest = new Big(0);
  let accrualPoint = new Date(`${startDate}T00:00:00.000Z`);

  const accrueUpTo = (segmentEnd: Date) => {
    if (segmentEnd <= accrualPoint) return;
    unpaidInterest = unpaidInterest.plus(
      computeSegmentInterest({
        principal: principalOutstanding,
        ratePct: interestRatePct,
        compoundingFrequency,
        dayCountConvention,
        periodStart: accrualPoint,
        periodEnd: segmentEnd,
      }),
    );
  };

  for (const event of sortedEvents) {
    const eventDate = new Date(`${event.eventDate}T00:00:00.000Z`);

    if (event.type === FIXED_INCOME_EVENT_TYPE.initial_investment) {
      accrueUpTo(eventDate);
      principalOutstanding = principalOutstanding.plus(
        event.grossAmount?.toDecimalString(10) ?? event.principalComponent?.toDecimalString(10) ?? principal,
      );
      accrualPoint = eventDate;
      continue;
    }

    if (PRINCIPAL_REDUCING_TYPES.includes(event.type)) {
      accrueUpTo(eventDate);
      const reduction = new Big(
        event.principalReturnedThisEvent ?? event.principalComponent?.toDecimalString(10) ?? '0',
      );
      const next = principalOutstanding.minus(reduction);
      principalOutstanding = next.lt(0) ? new Big(0) : next;
      principalReturnedToDate = principalReturnedToDate.plus(reduction);
      accrualPoint = eventDate;
      continue;
    }

    if (event.type === FIXED_INCOME_EVENT_TYPE.writedown) {
      accrueUpTo(eventDate);
      const amount = new Big(event.grossAmount?.toDecimalString(10) ?? '0');
      const applied = amount.gt(principalOutstanding) ? principalOutstanding : amount;
      principalOutstanding = principalOutstanding.minus(applied);
      writtenDownTotal = writtenDownTotal.plus(applied);
      accrualPoint = eventDate;
      continue;
    }

    if (event.type === FIXED_INCOME_EVENT_TYPE.interest_accrual_payout) {
      accrueUpTo(eventDate);
      totalInterestReceived = totalInterestReceived.plus(unpaidInterest);
      unpaidInterest = new Big(0);
      accrualPoint = eventDate;
      continue;
    }
    // `fee` events are cash-flow only and don't affect principal or interest accrual.
  }

  accrueUpTo(asOfDate);

  return {
    principalOutstanding: principalOutstanding.toFixed(10),
    principalReturnedToDate: principalReturnedToDate.toFixed(10),
    writtenDownTotal: writtenDownTotal.toFixed(10),
    accruedUnpaidInterest: unpaidInterest.toFixed(10),
    totalInterestReceived: totalInterestReceived.toFixed(10),
  };
}
