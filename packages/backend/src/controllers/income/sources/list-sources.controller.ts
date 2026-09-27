import { INCOME_SOURCE_STATUS } from '@bt/shared/types/income';
import { createController } from '@controllers/helpers/controller-factory';
import { listIncomeSources } from '@services/income/sources/list.service';
import { z } from 'zod';

export default createController(
  z.object({
    query: z.object({
      status: z.nativeEnum(INCOME_SOURCE_STATUS).optional(),
    }),
  }),
  async ({ user, query }) => {
    const sources = await listIncomeSources({ userId: user.id, status: query.status });
    return { data: sources };
  },
);
