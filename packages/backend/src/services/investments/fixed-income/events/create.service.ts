import { FIXED_INCOME_CASH_FLOW_MODE, FIXED_INCOME_EVENT_TYPE } from '@bt/shared/types/investments';
import { Money } from '@common/types/money';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { ValidationError } from '@js/errors';
import Currencies from '@models/currencies.model';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import { withTransaction } from '@services/common/with-transaction';

import { linkTxsToEvent } from '../linking/link-txs-to-event.service';
import { syncFixedIncomePositionStatus } from '../positions/sync-position-status.service';

interface CreateFixedIncomeEventParams {
  userId: number;
  positionId: string;
  type: FIXED_INCOME_EVENT_TYPE;
  eventDate: string;
  grossAmount?: string | null;
  principalComponent?: string | null;
  interestComponent?: string | null;
  currencyCode: string;
  cashFlowMode?: FIXED_INCOME_CASH_FLOW_MODE;
  transactionIds?: string[];
  notes?: string | null;
}

const createFixedIncomeEventImpl = async (params: CreateFixedIncomeEventParams) => {
  const {
    userId,
    positionId,
    type,
    eventDate,
    grossAmount = null,
    principalComponent = null,
    interestComponent = null,
    currencyCode,
    cashFlowMode = FIXED_INCOME_CASH_FLOW_MODE.none,
    transactionIds = [],
    notes = null,
  } = params;

  const position = await findOrThrowNotFound({
    query: FixedIncomePositions.findOne({ where: { id: positionId, userId } }),
    message: 'Fixed income position not found',
  });

  await findOrThrowNotFound({
    query: Currencies.findOne({ where: { code: currencyCode } }),
    message: 'Currency not found',
  });

  if (type === FIXED_INCOME_EVENT_TYPE.initial_investment) {
    const existing = await FixedIncomeEvents.findOne({
      where: { positionId, type: FIXED_INCOME_EVENT_TYPE.initial_investment },
    });
    if (existing) {
      throw new ValidationError({ message: 'Position already has an initial_investment event' });
    }
  }

  if (type === FIXED_INCOME_EVENT_TYPE.writedown && cashFlowMode !== FIXED_INCOME_CASH_FLOW_MODE.none) {
    throw new ValidationError({ message: 'writedown events cannot have a cash flow' });
  }

  const principalReturnedThisEvent =
    type === FIXED_INCOME_EVENT_TYPE.partial_repayment ||
    type === FIXED_INCOME_EVENT_TYPE.full_repayment ||
    type === FIXED_INCOME_EVENT_TYPE.maturity
      ? (principalComponent ?? grossAmount)
      : null;

  const event = await FixedIncomeEvents.create({
    userId,
    positionId: position.id,
    type,
    eventDate,
    grossAmount: grossAmount !== null ? Money.fromDecimal(grossAmount) : null,
    principalComponent: principalComponent !== null ? Money.fromDecimal(principalComponent) : null,
    interestComponent: interestComponent !== null ? Money.fromDecimal(interestComponent) : null,
    principalReturnedThisEvent,
    currencyCode,
    cashFlowMode,
    notes,
  });

  if (cashFlowMode === FIXED_INCOME_CASH_FLOW_MODE.linked && transactionIds.length > 0) {
    await linkTxsToEvent({ userId, fixedIncomeEventId: event.id, transactionIds });
  }

  await syncFixedIncomePositionStatus({ positionId: position.id });

  return event.reload();
};

export const createFixedIncomeEvent = withTransaction(createFixedIncomeEventImpl);
