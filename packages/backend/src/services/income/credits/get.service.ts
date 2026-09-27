import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import IncomeCreditComponents from '@models/income/income-credit-components.model';
import IncomeCreditLinks from '@models/income/income-credit-links.model';
import IncomeCredits from '@models/income/income-credits.model';
import Transactions from '@models/transactions.model';

export async function getIncomeCredit({
  userId,
  creditId,
}: {
  userId: number;
  creditId: string;
}): Promise<IncomeCredits> {
  return findOrThrowNotFound({
    query: IncomeCredits.findOne({
      where: { id: creditId, userId },
      include: [
        { model: IncomeCreditComponents, as: 'components' },
        { model: IncomeCreditLinks, as: 'links', include: [{ model: Transactions, as: 'transaction' }] },
      ],
    }),
    message: t({ key: 'income.creditNotFound' }),
  });
}
