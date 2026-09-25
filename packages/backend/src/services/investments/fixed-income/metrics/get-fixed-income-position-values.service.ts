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
  // realizedGain + unrealizedGain === currentValue + principalReturnedToDate +
  // totalInterestReceived - costBasis (the same total-gain formula getFixedIncomePositionMetrics
  // uses). realizedGain is interest that actually reached cash the user controls.
  realizedGain: string;
  unrealizedGain: string;
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

    const {
      principalOutstanding,
      principalReturnedToDate,
      accruedUnpaidInterest,
      totalInterestReceived,
      realizedInterestReceived,
    } = computeAccruedInterest({
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

    // Same total-gain formula as getFixedIncomePositionMetrics: currentValue only holds
    // principal still in the position plus interest still accruing, so interest and
    // principal already paid out (totalInterestReceived / principalReturnedToDate) must be
    // added back in here or they vanish from the portfolio-level gain entirely.
    const totalGain = new Big(currentValue)
      .plus(principalReturnedToDate)
      .plus(totalInterestReceived)
      .minus(costBasis)
      .toFixed(10);
    const realizedGain = new Big(realizedInterestReceived).toFixed(10);
    const unrealizedGain = new Big(totalGain).minus(realizedGain).toFixed(10);

    return {
      positionId: position.id,
      currencyCode: position.currencyCode,
      currentValue,
      costBasis,
      realizedGain,
      unrealizedGain,
    };
  });
};
