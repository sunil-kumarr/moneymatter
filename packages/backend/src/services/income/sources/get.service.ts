import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import IncomeSources from '@models/income/income-sources.model';

export async function getIncomeSource({
  userId,
  sourceId,
}: {
  userId: number;
  sourceId: string;
}): Promise<IncomeSources> {
  return findOrThrowNotFound({
    query: IncomeSources.findOne({ where: { id: sourceId, userId } }),
    message: t({ key: 'income.sourceNotFound' }),
  });
}
