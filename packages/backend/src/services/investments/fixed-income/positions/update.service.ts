import { DAY_COUNT_CONVENTION, INTEREST_COMPOUNDING_FREQUENCY } from '@bt/shared/types/investments';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { ValidationError } from '@js/errors';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import Payees from '@models/payees.model';
import { withTransaction } from '@services/common/with-transaction';

interface UpdateFixedIncomePositionParams {
  userId: number;
  positionId: string;
  name?: string;
  interestRatePct?: string;
  compoundingFrequency?: INTEREST_COMPOUNDING_FREQUENCY | null;
  dayCountConvention?: DAY_COUNT_CONVENTION;
  expectedEndDate?: string | null;
  counterpartyName?: string | null;
  counterpartyPayeeId?: string | null;
  notes?: string | null;
}

const updateFixedIncomePositionImpl = async (params: UpdateFixedIncomePositionParams) => {
  const { userId, positionId, counterpartyPayeeId, ...rest } = params;

  const position = await findOrThrowNotFound({
    query: FixedIncomePositions.findOne({ where: { id: positionId, userId } }),
    message: 'Fixed income position not found',
  });

  if (counterpartyPayeeId) {
    await findOrThrowNotFound({
      query: Payees.findOne({ where: { id: counterpartyPayeeId, userId } }),
      message: 'Payee not found',
    });
  }

  if (
    rest.compoundingFrequency &&
    rest.compoundingFrequency !== INTEREST_COMPOUNDING_FREQUENCY.simple &&
    position.instrumentType === 'peer_loan'
  ) {
    throw new ValidationError({ message: 'Peer loans only support simple interest' });
  }

  const update: Record<string, unknown> = { ...rest };
  if (counterpartyPayeeId !== undefined) update.counterpartyPayeeId = counterpartyPayeeId;
  if (rest.name !== undefined) update.name = rest.name.trim();

  await position.update(update);

  return position.reload();
};

export const updateFixedIncomePosition = withTransaction(updateFixedIncomePositionImpl);
