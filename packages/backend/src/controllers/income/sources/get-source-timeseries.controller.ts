import { createController } from '@controllers/helpers/controller-factory';
import { getIncomeTimeseries } from '@services/income/timeseries/get-income-timeseries.service';
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
      from: z.string().optional(),
      to: z.string().optional(),
      period: z.string().optional(),
      financialYear: z.string().optional(),
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

  const result = await getIncomeTimeseries({
    userId: user.id,
    sourceId: params.id,
    sourceIds,
    from: query.from,
    to: query.to,
    period: query.period,
    financialYear: query.financialYear,
  });

  return { data: result };
});
