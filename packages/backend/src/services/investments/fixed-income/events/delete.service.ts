import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import { withTransaction } from '@services/common/with-transaction';

import { syncFixedIncomePositionStatus } from '../positions/sync-position-status.service';

const deleteFixedIncomeEventImpl = async ({ userId, eventId }: { userId: number; eventId: string }): Promise<void> => {
  const event = await findOrThrowNotFound({
    query: FixedIncomeEvents.findOne({ where: { id: eventId, userId } }),
    message: 'Fixed income event not found',
  });

  const { positionId } = event;
  await event.destroy();
  await syncFixedIncomePositionStatus({ positionId });
};

export const deleteFixedIncomeEvent = withTransaction(deleteFixedIncomeEventImpl);
