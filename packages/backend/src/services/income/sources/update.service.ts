import {
  INCOME_SOURCE_STATUS,
  INCOME_SOURCE_TYPE,
  IncomeComponentTemplateItem,
  PAY_CADENCE,
} from '@bt/shared/types/income';
import { Money } from '@common/types/money';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import Accounts from '@models/accounts.model';
import IncomeSources from '@models/income/income-sources.model';
import Payees from '@models/payees.model';
import { withTransaction } from '@services/common/with-transaction';

interface UpdateIncomeSourceParams {
  userId: number;
  sourceId: string;
  name?: string;
  employerName?: string | null;
  employerPayeeId?: string | null;
  jobTitle?: string | null;
  sourceType?: INCOME_SOURCE_TYPE;
  status?: INCOME_SOURCE_STATUS;
  startDate?: string;
  endDate?: string | null;
  payCadence?: PAY_CADENCE;
  expectedAnnualCtc?: Money | null;
  payoutAccountId?: string | null;
  taxRegime?: string | null;
  employerIdentifier?: string | null;
  notes?: string | null;
  color?: string | null;
  componentTemplate?: IncomeComponentTemplateItem[] | null;
  isEnabled?: boolean;
}

const updateIncomeSourceImpl = async (params: UpdateIncomeSourceParams) => {
  const { userId, sourceId, employerPayeeId, payoutAccountId, ...rest } = params;

  const source = await findOrThrowNotFound({
    query: IncomeSources.findOne({ where: { id: sourceId, userId } }),
    message: t({ key: 'income.sourceNotFound' }),
  });

  if (employerPayeeId) {
    await findOrThrowNotFound({
      query: Payees.findOne({ where: { id: employerPayeeId, userId } }),
      message: t({ key: 'income.payeeNotFound' }),
    });
  }

  if (payoutAccountId) {
    await findOrThrowNotFound({
      query: Accounts.findOne({ where: { id: payoutAccountId, userId } }),
      message: t({ key: 'income.accountNotFound' }),
    });
  }

  const update: Record<string, unknown> = { ...rest };
  if (employerPayeeId !== undefined) update.employerPayeeId = employerPayeeId;
  if (payoutAccountId !== undefined) update.payoutAccountId = payoutAccountId;
  if (rest.name !== undefined) update.name = rest.name.trim();

  await source.update(update);

  return source.reload();
};

export const updateIncomeSource = withTransaction(updateIncomeSourceImpl);
