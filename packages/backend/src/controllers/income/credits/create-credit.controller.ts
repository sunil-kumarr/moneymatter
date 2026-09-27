import { INCOME_CASH_FLOW_MODE, INCOME_COMPONENT_KIND, INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import { decimalMoney, recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { createIncomeCredit } from '@services/income/credits/create.service';
import { z } from 'zod';

const componentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  kind: z.nativeEnum(INCOME_COMPONENT_KIND),
  amount: decimalMoney(),
  sortOrder: z.number().int().optional(),
});

export default createController(
  z.object({
    params: z.object({ sourceId: recordId() }),
    body: z.object({
      creditType: z.nativeEnum(INCOME_CREDIT_TYPE).optional(),
      creditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodStart: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      periodEnd: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      components: z.array(componentSchema).min(1),
      cashFlowMode: z.nativeEnum(INCOME_CASH_FLOW_MODE).optional(),
      notes: z.string().nullable().optional(),
    }),
  }),
  async ({ user, params, body }) => {
    const credit = await createIncomeCredit({ userId: user.id, sourceId: params.sourceId, ...body });
    return { data: credit, statusCode: 201 };
  },
);
