import { createController } from '@controllers/helpers/controller-factory';
import { getIncomeSourceSummary } from '@services/income/summary/get-income-source-summary.service';
import { z } from 'zod';

const schema = z.object({
  params: z
    .object({
      id: z.string().optional(),
    })
    .optional()
    .default({}),
  query: z
    .object({
      sourceIds: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .optional()
    .default({}),
});

export default createController(schema, async ({ user, params, query }) => {
  const rawSourceIds = query.sourceIds;
  const sourceIds = Array.isArray(rawSourceIds)
    ? rawSourceIds
    : typeof rawSourceIds === 'string'
      ? rawSourceIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const summary = await getIncomeSourceSummary({ userId: user.id, sourceId: params.id, sourceIds });
  return { data: summary };
});
