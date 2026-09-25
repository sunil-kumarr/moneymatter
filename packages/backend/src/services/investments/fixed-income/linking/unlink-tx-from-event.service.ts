import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import FixedIncomeEventLinks from '@models/investments/fixed-income-event-links.model';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import { withTransaction } from '@services/common/with-transaction';

const unlinkTxFromEventImpl = async ({
  userId,
  fixedIncomeEventId,
  linkId,
}: {
  userId: number;
  fixedIncomeEventId: string;
  linkId: string;
}): Promise<void> => {
  const link = await findOrThrowNotFound({
    query: FixedIncomeEventLinks.findOne({
      where: { id: linkId, fixedIncomeEventId },
      include: [{ model: FixedIncomeEvents, as: 'event', attributes: [], where: { userId }, required: true }],
    }),
    message: 'Link not found',
  });

  await link.destroy();
};

export const unlinkTxFromEvent = withTransaction(unlinkTxFromEventImpl);
