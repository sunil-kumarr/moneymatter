import { INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import IncomeCreditComponents from '@models/income/income-credit-components.model';
import IncomeCreditLinks from '@models/income/income-credit-links.model';
import IncomeCredits from '@models/income/income-credits.model';
import Transactions from '@models/transactions.model';
import { Op } from 'sequelize';

export async function listIncomeCredits({
  userId,
  sourceId,
  creditType,
  from,
  to,
}: {
  userId: number;
  sourceId: string;
  creditType?: INCOME_CREDIT_TYPE;
  from?: string;
  to?: string;
}): Promise<IncomeCredits[]> {
  return IncomeCredits.findAll({
    where: {
      userId,
      incomeSourceId: sourceId,
      ...(creditType ? { creditType } : {}),
      ...(from || to
        ? {
            creditDate: {
              ...(from ? { [Op.gte]: from } : {}),
              ...(to ? { [Op.lte]: to } : {}),
            },
          }
        : {}),
    },
    include: [
      { model: IncomeCreditComponents, as: 'components' },
      { model: IncomeCreditLinks, as: 'links', include: [{ model: Transactions, as: 'transaction' }] },
    ],
    order: [['creditDate', 'DESC']],
  });
}
