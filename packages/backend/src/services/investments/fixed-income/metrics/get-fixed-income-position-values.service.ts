import { FIXED_INCOME_POSITION_STATUS } from '@bt/shared/types/investments';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import Big from 'big.js';

import { computeAccruedInterest } from './compute-accrued-interest';
import { computeCostBasis } from './compute-cost-basis';

const CLOSED_STATUSES: readonly FIXED_INCOME_POSITION_STATUS[] = [
  FIXED_INCOME_POSITION_STATUS.fully_repaid,
  FIXED_INCOME_POSITION_STATUS.written_off,
];

export interface FixedIncomePositionValue {
  positionId: string;
  currencyCode: string;
  currentValue: string;
  costBasis: string;
}

export const getFixedIncomePositionValues = async ({
  portfolioId,
  userId,
  asOfDate = new Date(),
}: {
  portfolioId: string;
  userId: number;
  asOfDate?: Date;
}): Promise<FixedIncomePositionValue[]> => {
  const positions = await FixedIncomePositions.findAll({
    where: { portfolioId, userId },
    include: [{ model: FixedIncomeEvents, as: 'events' }],
  });

  return positions.map((position) => {
    const events = position.events ?? [];
    const costBasis = computeCostBasis({ position, events });

    const { principalOutstanding, accruedUnpaidInterest } = computeAccruedInterest({
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

    return {
      positionId: position.id,
      currencyCode: position.currencyCode,
      currentValue,
      costBasis,
    };
  });
};
