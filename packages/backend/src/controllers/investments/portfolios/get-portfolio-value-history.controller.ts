import { dateRange, withDateOrder } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { serializePortfolioValueHistory } from '@root/serializers/stats.serializer';
import { getPortfolioValueHistory } from '@services/stats/get-combined-balance-history';
import { z } from 'zod';

const schema = z.object({
  query: withDateOrder(z.object({ ...dateRange() })),
});

export default createController(schema, async ({ user, query }) => {
  const { from, to } = query;

  const data = await getPortfolioValueHistory({ userId: user.id, from, to });

  return { data: serializePortfolioValueHistory(data) };
});
