import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';

export async function getFixedIncomePosition({
  userId,
  positionId,
}: {
  userId: number;
  positionId: string;
}): Promise<FixedIncomePositions> {
  return findOrThrowNotFound({
    query: FixedIncomePositions.findOne({
      where: { id: positionId, userId },
      include: [{ model: FixedIncomeEvents, as: 'events' }],
    }),
    message: 'Fixed income position not found',
  });
}
