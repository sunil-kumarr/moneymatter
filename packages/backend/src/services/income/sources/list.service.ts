import { INCOME_SOURCE_STATUS } from '@bt/shared/types/income';
import IncomeSources from '@models/income/income-sources.model';
import { literal } from 'sequelize';

const LATEST_CREDIT_DATE_EXPR = `(
  SELECT MAX("creditDate")
  FROM "IncomeCredits"
  WHERE "IncomeCredits"."incomeSourceId" = "IncomeSources"."id"
)`;

export async function listIncomeSources({
  userId,
  status,
}: {
  userId: number;
  status?: INCOME_SOURCE_STATUS;
}): Promise<IncomeSources[]> {
  return IncomeSources.findAll({
    where: {
      userId,
      ...(status ? { status } : {}),
    },
    attributes: {
      include: [[literal(LATEST_CREDIT_DATE_EXPR), 'latestCreditDate']],
    },
    order: [literal(`${LATEST_CREDIT_DATE_EXPR} DESC NULLS LAST`), ['startDate', 'DESC']],
  });
}
