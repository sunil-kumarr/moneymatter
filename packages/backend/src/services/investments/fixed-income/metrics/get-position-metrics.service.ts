import { FIXED_INCOME_POSITION_STATUS, FixedIncomePositionMetricsModel } from '@bt/shared/types/investments';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import Big from 'big.js';

import { computeAccruedInterest } from './compute-accrued-interest';
import { computeCostBasis } from './compute-cost-basis';

const CLOSED_STATUSES: readonly FIXED_INCOME_POSITION_STATUS[] = [
  FIXED_INCOME_POSITION_STATUS.fully_repaid,
  FIXED_INCOME_POSITION_STATUS.written_off,
];

export async function getFixedIncomePositionMetrics({
  userId,
  positionId,
  asOfDate = new Date(),
}: {
  userId: number;
  positionId: string;
  asOfDate?: Date;
}): Promise<FixedIncomePositionMetricsModel> {
  const position = await findOrThrowNotFound({
    query: FixedIncomePositions.findOne({
      where: { id: positionId, userId },
      include: [{ model: FixedIncomeEvents, as: 'events' }],
    }),
    message: 'Fixed income position not found',
  });

  const events = position.events ?? [];
  const costBasis = computeCostBasis({ position, events });

  const { principalOutstanding, principalReturnedToDate, accruedUnpaidInterest, totalInterestReceived } =
    computeAccruedInterest({
      principal: position.principal.toDecimalString(10),
      interestRatePct: position.interestRatePct,
      compoundingFrequency: position.compoundingFrequency,
      dayCountConvention: position.dayCountConvention,
      startDate: position.startDate,
      events,
      asOfDate,
    });

  const currentValue = CLOSED_STATUSES.includes(position.status)
    ? '0'
    : new Big(principalOutstanding).plus(accruedUnpaidInterest).toFixed(10);

  const pnlAbsolute = new Big(currentValue)
    .plus(principalReturnedToDate)
    .plus(totalInterestReceived)
    .minus(costBasis)
    .toFixed(10);
  const pnlPct = new Big(costBasis).gt(0) ? new Big(pnlAbsolute).div(costBasis).times(100).toFixed(6) : null;

  return {
    costBasis,
    principalOutstanding,
    accruedUnpaidInterest,
    currentValue,
    totalInterestReceived,
    totalRepaid: principalReturnedToDate,
    pnlAbsolute,
    pnlPct,
  };
}
