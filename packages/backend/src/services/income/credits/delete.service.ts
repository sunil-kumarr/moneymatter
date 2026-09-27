import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import IncomeCredits from '@models/income/income-credits.model';
import { withTransaction } from '@services/common/with-transaction';

const deleteIncomeCreditImpl = async ({ userId, creditId }: { userId: number; creditId: string }): Promise<void> => {
  const credit = await findOrThrowNotFound({
    query: IncomeCredits.findOne({ where: { id: creditId, userId } }),
    message: t({ key: 'income.creditNotFound' }),
  });

  await credit.destroy();
};

export const deleteIncomeCredit = withTransaction(deleteIncomeCreditImpl);
