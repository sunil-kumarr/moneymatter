import { INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { listIncomeCredits } from '@services/income/credits/list.service';
import { z } from 'zod';

export default createController(
  z.object({
    params: z.object({ sourceId: recordId() }),
    query: z.object({
      creditType: z.nativeEnum(INCOME_CREDIT_TYPE).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  }),
  async ({ user, params, query }) => {
    const credits = await listIncomeCredits({
      userId: user.id,
      sourceId: params.sourceId,
      creditType: query.creditType,
      from: query.from,
      to: query.to,
    });
    return { data: credits };
  },
);
