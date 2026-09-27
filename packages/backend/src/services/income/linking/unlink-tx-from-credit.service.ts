import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import IncomeCreditLinks from '@models/income/income-credit-links.model';
import IncomeCredits from '@models/income/income-credits.model';
import { withTransaction } from '@services/common/with-transaction';

const unlinkTxFromCreditImpl = async ({
  userId,
  incomeCreditId,
  transactionId,
}: {
  userId: number;
  incomeCreditId: string;
  transactionId: string;
}): Promise<void> => {
  const link = await findOrThrowNotFound({
    query: IncomeCreditLinks.findOne({
      where: { incomeCreditId, transactionId },
      include: [{ model: IncomeCredits, as: 'credit', attributes: [], where: { userId }, required: true }],
    }),
    message: t({ key: 'income.linkNotFound' }),
  });

  await link.destroy();
};

export const unlinkTxFromCredit = withTransaction(unlinkTxFromCreditImpl);
