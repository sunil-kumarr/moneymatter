import { FIXED_INCOME_INSTRUMENT_TYPE } from '@bt/shared/types/investments';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';

export async function listFixedIncomePositions({
  userId,
  portfolioId,
  instrumentType,
}: {
  userId: number;
  portfolioId?: string;
  instrumentType?: FIXED_INCOME_INSTRUMENT_TYPE;
}): Promise<FixedIncomePositions[]> {
  return FixedIncomePositions.findAll({
    where: {
      userId,
      ...(portfolioId ? { portfolioId } : {}),
      ...(instrumentType ? { instrumentType } : {}),
    },
    order: [['startDate', 'DESC']],
  });
}
