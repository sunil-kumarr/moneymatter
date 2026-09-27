import { INCOME_CASH_FLOW_MODE, INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import { Money } from '@common/types/money';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import IncomeCreditComponents from '@models/income/income-credit-components.model';
import IncomeCredits from '@models/income/income-credits.model';
import IncomeSources from '@models/income/income-sources.model';
import { calculateRefAmount } from '@services/calculate-ref-amount.service';
import { getUserBaseCurrencyCode } from '@services/common/transaction-linking';
import { withTransaction } from '@services/common/with-transaction';

import { reconcileCreditTotals } from './reconcile-credit-totals';

interface UpdateCreditComponentInput {
  name: string;
  kind: IncomeCreditComponents['kind'];
  amount: Money;
  sortOrder?: number;
}

interface UpdateIncomeCreditParams {
  userId: number;
  creditId: string;
  creditType?: INCOME_CREDIT_TYPE;
  creditDate?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  components?: UpdateCreditComponentInput[];
  cashFlowMode?: INCOME_CASH_FLOW_MODE;
  notes?: string | null;
}

const updateIncomeCreditImpl = async (params: UpdateIncomeCreditParams) => {
  const { userId, creditId, components, ...rest } = params;

  const credit = await findOrThrowNotFound({
    query: IncomeCredits.findOne({ where: { id: creditId, userId } }),
    message: t({ key: 'income.creditNotFound' }),
  });

  const update: Record<string, unknown> = { ...rest };
  const effectiveCreditDate = rest.creditDate ?? credit.creditDate;

  if (components) {
    const source = await findOrThrowNotFound({
      query: IncomeSources.findOne({ where: { id: credit.incomeSourceId, userId } }),
      message: t({ key: 'income.sourceNotFound' }),
    });

    const totals = reconcileCreditTotals(components);
    const refCurrencyCode = await getUserBaseCurrencyCode({ userId });

    const componentRefAmounts = await Promise.all(
      components.map((component) =>
        calculateRefAmount({
          amount: component.amount,
          baseCode: source.currencyCode,
          quoteCode: refCurrencyCode,
          userId,
          date: effectiveCreditDate,
        }),
      ),
    );

    const refTotals = reconcileCreditTotals(
      components.map((component, index) => ({ kind: component.kind, amount: componentRefAmounts[index]! })),
    );

    Object.assign(update, {
      grossAmount: totals.grossAmount,
      totalDeductions: totals.totalDeductions,
      netAmount: totals.netAmount,
      employerContributions: totals.employerContributions,
      refCurrencyCode,
      refGrossAmount: refTotals.grossAmount,
      refTotalDeductions: refTotals.totalDeductions,
      refNetAmount: refTotals.netAmount,
    });

    await credit.update(update);

    await IncomeCreditComponents.destroy({ where: { incomeCreditId: credit.id } });
    await IncomeCreditComponents.bulkCreate(
      components.map((component, index) => ({
        userId,
        incomeCreditId: credit.id,
        name: component.name,
        kind: component.kind,
        amount: component.amount,
        refAmount: componentRefAmounts[index]!,
        sortOrder: component.sortOrder ?? index,
      })),
    );
  } else {
    await credit.update(update);
  }

  return findOrThrowNotFound({
    query: IncomeCredits.findOne({
      where: { id: credit.id },
      include: [{ model: IncomeCreditComponents, as: 'components' }],
    }),
    message: t({ key: 'income.creditNotFound' }),
  });
};

export const updateIncomeCredit = withTransaction(updateIncomeCreditImpl);
