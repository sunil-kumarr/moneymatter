import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomeEventLinks from '@models/investments/fixed-income-event-links.model';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';

export async function listFixedIncomeEvents({
  userId,
  positionId,
}: {
  userId: number;
  positionId: string;
}): Promise<FixedIncomeEvents[]> {
  await findOrThrowNotFound({
    query: FixedIncomePositions.findOne({ where: { id: positionId, userId } }),
    message: 'Fixed income position not found',
  });

  return FixedIncomeEvents.findAll({
    where: { positionId },
    include: [{ model: FixedIncomeEventLinks, as: 'links' }],
    order: [
      ['eventDate', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
}
