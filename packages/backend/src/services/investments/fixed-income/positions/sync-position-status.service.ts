import { FIXED_INCOME_EVENT_TYPE, FIXED_INCOME_POSITION_STATUS } from '@bt/shared/types/investments';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import Big from 'big.js';

import { computeAccruedInterest } from '../metrics/compute-accrued-interest';

/**
 * Recomputes a position's status from its event ledger. Called after any
 * event create/update/delete so status never drifts from what the ledger
 * actually implies.
 */
export async function syncFixedIncomePositionStatus({ positionId }: { positionId: string }): Promise<void> {
  const position = await FixedIncomePositions.findByPk(positionId, {
    include: [{ model: FixedIncomeEvents, as: 'events' }],
  });
  if (!position) return;

  const events = position.events ?? [];
  const hasWritedown = events.some((event) => event.type === FIXED_INCOME_EVENT_TYPE.writedown);
  const hasMaturity = events.some((event) => event.type === FIXED_INCOME_EVENT_TYPE.maturity);
  const hasFullRepayment = events.some((event) => event.type === FIXED_INCOME_EVENT_TYPE.full_repayment);
  const hasPartialRepayment = events.some((event) => event.type === FIXED_INCOME_EVENT_TYPE.partial_repayment);

  const { principalOutstanding } = computeAccruedInterest({
    principal: position.principal.toDecimalString(10),
    interestRatePct: position.interestRatePct,
    compoundingFrequency: position.compoundingFrequency,
    dayCountConvention: position.dayCountConvention,
    startDate: position.startDate,
    events,
    asOfDate: new Date(),
  });

  let status = FIXED_INCOME_POSITION_STATUS.active;
  if (new Big(principalOutstanding).lte(0) && (hasFullRepayment || hasWritedown)) {
    status =
      hasWritedown && !hasFullRepayment
        ? FIXED_INCOME_POSITION_STATUS.written_off
        : FIXED_INCOME_POSITION_STATUS.fully_repaid;
  } else if (hasMaturity && new Big(principalOutstanding).gt(0)) {
    status = FIXED_INCOME_POSITION_STATUS.matured;
  } else if (hasPartialRepayment && new Big(principalOutstanding).gt(0)) {
    status = FIXED_INCOME_POSITION_STATUS.partially_repaid;
  }

  if (status !== position.status) {
    await position.update({ status });
  }
}
