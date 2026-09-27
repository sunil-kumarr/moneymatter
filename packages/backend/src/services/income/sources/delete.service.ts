import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import IncomeSources from '@models/income/income-sources.model';
import { withTransaction } from '@services/common/with-transaction';

const deleteIncomeSourceImpl = async ({ userId, sourceId }: { userId: number; sourceId: string }): Promise<void> => {
  const source = await findOrThrowNotFound({
    query: IncomeSources.findOne({ where: { id: sourceId, userId } }),
    message: t({ key: 'income.sourceNotFound' }),
  });

  await source.destroy();
};

export const deleteIncomeSource = withTransaction(deleteIncomeSourceImpl);
