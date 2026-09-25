import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { ConflictError } from '@js/errors';
import FixedIncomeEventLinks from '@models/investments/fixed-income-event-links.model';
import { findOneTransaction } from '@models/transactions-query';
import { withTransaction } from '@services/common/with-transaction';

/**
 * Links wallet transactions to a fixed-income event's cash-flow record. Each
 * transaction can back at most one link (enforced by the DB's unique index
 * on transactionId), so a transaction already reconciled to another event
 * (or this one) is rejected rather than silently re-linked.
 */
const linkTxsToEventImpl = async ({
  userId,
  fixedIncomeEventId,
  transactionIds,
}: {
  userId: number;
  fixedIncomeEventId: string;
  transactionIds: string[];
}): Promise<FixedIncomeEventLinks[]> => {
  const links: FixedIncomeEventLinks[] = [];

  for (const transactionId of transactionIds) {
    const transaction = await findOrThrowNotFound({
      query: findOneTransaction({
        planned: 'include',
        access: { creator: userId },
        balanceAdjustments: 'include',
        where: { id: transactionId },
      }),
      message: 'Transaction not found',
    });

    const existingLink = await FixedIncomeEventLinks.findOne({ where: { transactionId } });
    if (existingLink) {
      throw new ConflictError({ message: 'Transaction is already linked to a fixed income event' });
    }

    const link = await FixedIncomeEventLinks.create({
      fixedIncomeEventId,
      transactionId,
      amount: transaction.amount.abs(),
      currencyCode: transaction.currencyCode,
    });
    links.push(link);
  }

  return links;
};

export const linkTxsToEvent = withTransaction(linkTxsToEventImpl);
