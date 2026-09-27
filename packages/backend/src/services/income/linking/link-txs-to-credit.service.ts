import { TRANSACTION_TYPES } from '@bt/shared/types';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import { ConflictError, ValidationError } from '@js/errors';
import IncomeCreditLinks from '@models/income/income-credit-links.model';
import IncomeCredits from '@models/income/income-credits.model';
import { findOneTransaction } from '@models/transactions-query';
import { withTransaction } from '@services/common/with-transaction';

/**
 * Links wallet transactions to a salary credit's cash-flow record. Unlike the
 * venture/portfolio flavour, this never touches `transaction.transferNature` —
 * re-stamping a salary transaction as a transfer would silently remove it
 * from cash-flow / savings / net-worth-driver stats, which is exactly wrong
 * for income. Only a link row is created, mirroring FixedIncomeEventLinks.
 *
 * Each transaction can back at most one link (enforced by the DB's unique
 * index on transactionId), so an already-linked transaction is rejected
 * rather than silently re-linked.
 */
const linkTxsToCreditImpl = async ({
  userId,
  incomeCreditId,
  transactionIds,
}: {
  userId: number;
  incomeCreditId: string;
  transactionIds: string[];
}): Promise<IncomeCreditLinks[]> => {
  const credit = await findOrThrowNotFound({
    query: IncomeCredits.findOne({ where: { id: incomeCreditId, userId } }),
    message: t({ key: 'income.creditNotFound' }),
  });

  const links: IncomeCreditLinks[] = [];

  for (const transactionId of transactionIds) {
    const transaction = await findOrThrowNotFound({
      query: findOneTransaction({
        planned: 'include',
        access: { creator: userId },
        balanceAdjustments: 'include',
        where: { id: transactionId },
      }),
      message: t({ key: 'income.transactionNotFound' }),
    });

    if (transaction.transactionType !== TRANSACTION_TYPES.income) {
      throw new ValidationError({ message: t({ key: 'income.transactionMustBeIncome' }) });
    }

    if (transaction.currencyCode !== credit.currencyCode) {
      throw new ValidationError({ message: t({ key: 'income.currencyMismatch' }) });
    }

    const existingLink = await IncomeCreditLinks.findOne({ where: { transactionId } });
    if (existingLink) {
      throw new ConflictError({ message: t({ key: 'income.transactionAlreadyLinked' }) });
    }

    const link = await IncomeCreditLinks.create({
      userId,
      incomeCreditId,
      transactionId,
      amount: transaction.amount.abs(),
      currencyCode: transaction.currencyCode,
    });
    links.push(link);
  }

  return links;
};

export const linkTxsToCredit = withTransaction(linkTxsToCreditImpl);
