import { FIXED_INCOME_EVENT_TYPE } from '@bt/shared/types/investments';
import { Money } from '@common/types/money';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import { withTransaction } from '@services/common/with-transaction';

import { syncFixedIncomePositionStatus } from '../positions/sync-position-status.service';

interface UpdateFixedIncomeEventParams {
  userId: number;
  eventId: string;
  eventDate?: string;
  grossAmount?: string | null;
  principalComponent?: string | null;
  interestComponent?: string | null;
  resetsAccrualClock?: boolean;
  notes?: string | null;
}

const PRINCIPAL_REDUCING_TYPES: readonly FIXED_INCOME_EVENT_TYPE[] = [
  FIXED_INCOME_EVENT_TYPE.partial_repayment,
  FIXED_INCOME_EVENT_TYPE.full_repayment,
  FIXED_INCOME_EVENT_TYPE.maturity,
];

const updateFixedIncomeEventImpl = async (params: UpdateFixedIncomeEventParams) => {
  const { userId, eventId, notes, ...rest } = params;

  const event = await findOrThrowNotFound({
    query: FixedIncomeEvents.findOne({ where: { id: eventId, userId } }),
    message: 'Fixed income event not found',
  });

  const update: Record<string, unknown> = {};
  if (rest.eventDate !== undefined) update.eventDate = rest.eventDate;
  if (rest.grossAmount !== undefined)
    update.grossAmount = rest.grossAmount !== null ? Money.fromDecimal(rest.grossAmount) : null;
  if (rest.principalComponent !== undefined) {
    update.principalComponent = rest.principalComponent !== null ? Money.fromDecimal(rest.principalComponent) : null;
    if (PRINCIPAL_REDUCING_TYPES.includes(event.type)) {
      update.principalReturnedThisEvent = rest.principalComponent;
    }
  }
  if (rest.interestComponent !== undefined) {
    update.interestComponent = rest.interestComponent !== null ? Money.fromDecimal(rest.interestComponent) : null;
  }
  if (rest.resetsAccrualClock !== undefined) update.resetsAccrualClock = rest.resetsAccrualClock;
  if (notes !== undefined) update.notes = notes;

  await event.update(update);
  await syncFixedIncomePositionStatus({ positionId: event.positionId });

  return event.reload();
};

export const updateFixedIncomeEvent = withTransaction(updateFixedIncomeEventImpl);
