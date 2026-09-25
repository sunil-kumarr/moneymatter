import {
  BOND_TYPE,
  CREDIT_RATING,
  DAY_COUNT_CONVENTION,
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { ValidationError } from '@js/errors';
import Accounts from '@models/accounts.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import Payees from '@models/payees.model';
import { withTransaction } from '@services/common/with-transaction';

interface UpdateFixedIncomePositionParams {
  userId: number;
  positionId: string;
  name?: string;
  startDate?: string;
  interestRatePct?: string;
  compoundingFrequency?: INTEREST_COMPOUNDING_FREQUENCY | null;
  dayCountConvention?: DAY_COUNT_CONVENTION;
  expectedEndDate?: string | null;
  counterpartyName?: string | null;
  counterpartyPayeeId?: string | null;
  variantName?: string | null;
  interestPayoutFrequency?: INTEREST_PAYOUT_FREQUENCY;
  maturityInstruction?: FIXED_DEPOSIT_MATURITY_INSTRUCTION;
  payoutAccountId?: string | null;
  bondType?: BOND_TYPE | null;
  creditRating?: CREDIT_RATING | null;
  ytmPct?: string | null;
  notes?: string | null;
}

const updateFixedIncomePositionImpl = async (params: UpdateFixedIncomePositionParams) => {
  const { userId, positionId, counterpartyPayeeId, payoutAccountId, ...rest } = params;

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

  if (payoutAccountId) {
    await findOrThrowNotFound({
      query: Accounts.findOne({ where: { id: payoutAccountId, userId } }),
      message: 'Payout account not found',
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
  if (payoutAccountId !== undefined) update.payoutAccountId = payoutAccountId;
  if (rest.name !== undefined) update.name = rest.name.trim();

  await position.update(update);

  return position.reload();
};

export const updateFixedIncomePosition = withTransaction(updateFixedIncomePositionImpl);
