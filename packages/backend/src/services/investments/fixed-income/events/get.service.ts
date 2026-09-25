import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomeEventLinks from '@models/investments/fixed-income-event-links.model';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';

export async function getFixedIncomeEvent({
  userId,
  eventId,
}: {
  userId: number;
  eventId: string;
}): Promise<FixedIncomeEvents> {
  return findOrThrowNotFound({
    query: FixedIncomeEvents.findOne({
      where: { id: eventId, userId },
      include: [{ model: FixedIncomeEventLinks, as: 'links' }],
    }),
    message: 'Fixed income event not found',
  });
}
