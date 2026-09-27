import {
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  FIXED_INCOME_EVENT_TYPE,
  FIXED_INCOME_POSITION_STATUS,
  FixedIncomePositionMetricsModel,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import Big from 'big.js';

import { computeAccruedInterest } from './compute-accrued-interest';
import { computeCostBasis } from './compute-cost-basis';
import { computeNextPayoutDate } from './compute-next-payout-date';

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

  const {
    principalOutstanding,
    principalReturnedToDate,
    accruedUnpaidInterest,
    totalInterestReceived,
    realizedInterestReceived,
    accrualPoint,
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

  const pnlAbsolute = new Big(currentValue)
    .plus(principalReturnedToDate)
    .plus(totalInterestReceived)
    .minus(costBasis)
    .toFixed(10);
  const pnlPct = new Big(costBasis).gt(0) ? new Big(pnlAbsolute).div(costBasis).times(100).toFixed(6) : null;

  // Realized is the portion of pnlAbsolute whose interest actually left the position for
  // cash the user controls (see compute-accrued-interest.ts); everything else — interest
  // still accruing, or moved to a new term via cashFlowMode: none — stays unrealized. This
  // keeps realizedGain + unrealizedGain === pnlAbsolute exactly.
  const realizedGain = new Big(realizedInterestReceived).toFixed(10);
  const unrealizedGain = new Big(pnlAbsolute).minus(realizedGain).toFixed(10);
  const realizedGainPct = new Big(costBasis).gt(0) ? new Big(realizedGain).div(costBasis).times(100).toFixed(6) : null;
  const unrealizedGainPct = new Big(costBasis).gt(0)
    ? new Big(unrealizedGain).div(costBasis).times(100).toFixed(6)
    : null;

  const nextPayoutDate = computeNextPayoutDate({
    accrualPoint,
    interestPayoutFrequency: position.interestPayoutFrequency,
    status: position.status,
  });

  let maturityValue: string | null = null;
  const maturityEvent = events.find((e) => e.type === FIXED_INCOME_EVENT_TYPE.maturity);

  if (maturityEvent) {
    maturityValue =
      maturityEvent.grossAmount?.toDecimalString(10) ??
      new Big(maturityEvent.principalComponent?.toDecimalString(10) ?? '0')
        .plus(maturityEvent.interestComponent?.toDecimalString(10) ?? '0')
        .toFixed(10);
  } else if (position.status === FIXED_INCOME_POSITION_STATUS.written_off) {
    maturityValue = '0';
  } else if (position.status === FIXED_INCOME_POSITION_STATUS.fully_repaid) {
    maturityValue = principalReturnedToDate;
  } else if (position.expectedEndDate) {
    const returnCashToAccount =
      position.payoutAccountId != null ||
      position.maturityInstruction === FIXED_DEPOSIT_MATURITY_INSTRUCTION.credit_to_account;

    if (position.interestPayoutFrequency === INTEREST_PAYOUT_FREQUENCY.cumulative) {
      const maturityAccrual = computeAccruedInterest({
        principal: position.principal.toDecimalString(10),
        interestRatePct: position.interestRatePct,
        compoundingFrequency: position.compoundingFrequency,
        dayCountConvention: position.dayCountConvention,
        startDate: position.startDate,
        events,
        asOfDate: new Date(`${position.expectedEndDate}T00:00:00.000Z`),
      });
      let baseMaturity = new Big(maturityAccrual.principalOutstanding).plus(maturityAccrual.accruedUnpaidInterest);
      if (returnCashToAccount && new Big(principalReturnedToDate).gt(0)) {
        baseMaturity = baseMaturity.plus(principalReturnedToDate);
      }
      maturityValue = baseMaturity.toFixed(10);
    } else {
      let baseMaturity = new Big(principalOutstanding);
      if (returnCashToAccount && new Big(principalReturnedToDate).gt(0)) {
        baseMaturity = baseMaturity.plus(principalReturnedToDate);
      }
      maturityValue = baseMaturity.toFixed(10);
    }
  }

  return {
    costBasis,
    principalOutstanding,
    accruedUnpaidInterest,
    currentValue,
    totalInterestReceived,
    totalRepaid: principalReturnedToDate,
    pnlAbsolute,
    pnlPct,
    realizedGain,
    unrealizedGain,
    realizedGainPct,
    unrealizedGainPct,
    nextPayoutDate,
    maturityValue,
  };
}
