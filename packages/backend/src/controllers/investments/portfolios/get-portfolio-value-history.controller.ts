import { dateRange, recordId, withDateOrder } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { serializePortfolioValueHistory } from '@root/serializers/stats.serializer';
import { getPortfolioValueHistory } from '@services/stats/get-combined-balance-history';
import { z } from 'zod';

const schema = z.object({
  params: z
    .object({
      id: recordId().optional(),
    })
    .optional()
    .default({}),
  query: withDateOrder(
    z.object({
      ...dateRange(),
      portfolioId: recordId().optional(),
    }),
  ),
});

export default createController(schema, async ({ user, params, query }) => {
  const { from, to } = query;
  const portfolioId = params.id || query.portfolioId;

  const data = await getPortfolioValueHistory({ userId: user.id, from, to, portfolioId });

  return { data: serializePortfolioValueHistory(data) };
});
