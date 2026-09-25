import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import { withTransaction } from '@services/common/with-transaction';

const deleteFixedIncomePositionImpl = async ({
  userId,
  positionId,
}: {
  userId: number;
  positionId: string;
}): Promise<void> => {
  const position = await findOrThrowNotFound({
    query: FixedIncomePositions.findOne({ where: { id: positionId, userId } }),
    message: 'Fixed income position not found',
  });

  await position.destroy();
};

export const deleteFixedIncomePosition = withTransaction(deleteFixedIncomePositionImpl);
