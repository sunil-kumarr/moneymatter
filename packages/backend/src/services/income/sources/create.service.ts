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
import Currencies from '@models/currencies.model';
import IncomeSources from '@models/income/income-sources.model';
import Payees from '@models/payees.model';
import { withTransaction } from '@services/common/with-transaction';

interface CreateIncomeSourceParams {
  userId: number;
  name: string;
  employerName?: string | null;
  employerPayeeId?: string | null;
  jobTitle?: string | null;
  sourceType?: INCOME_SOURCE_TYPE;
  startDate: string;
  endDate?: string | null;
  currencyCode: string;
  payCadence?: PAY_CADENCE;
  expectedAnnualCtc?: Money | null;
  payoutAccountId?: string | null;
  taxRegime?: string | null;
  employerIdentifier?: string | null;
  notes?: string | null;
  color?: string | null;
  componentTemplate?: IncomeComponentTemplateItem[] | null;
}

const createIncomeSourceImpl = async (params: CreateIncomeSourceParams) => {
  const {
    userId,
    name,
    employerName = null,
    employerPayeeId = null,
    jobTitle = null,
    sourceType = INCOME_SOURCE_TYPE.salaried,
    startDate,
    endDate = null,
    currencyCode,
    payCadence = PAY_CADENCE.monthly,
    expectedAnnualCtc = null,
    payoutAccountId = null,
    taxRegime = null,
    employerIdentifier = null,
    notes = null,
    color = null,
    componentTemplate = null,
  } = params;

  await findOrThrowNotFound({
    query: Currencies.findOne({ where: { code: currencyCode } }),
    message: t({ key: 'income.currencyNotFound' }),
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

  const source = await IncomeSources.create({
    userId,
    name: name.trim(),
    employerName,
    employerPayeeId,
    jobTitle,
    sourceType,
    status: INCOME_SOURCE_STATUS.active,
    startDate,
    endDate,
    currencyCode,
    payCadence,
    expectedAnnualCtc,
    payoutAccountId,
    taxRegime,
    employerIdentifier,
    notes,
    color,
    componentTemplate,
  });

  return source.reload();
};

export const createIncomeSource = withTransaction(createIncomeSourceImpl);
