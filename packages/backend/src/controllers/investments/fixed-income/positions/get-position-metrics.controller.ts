import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { getFixedIncomePositionMetrics } from '@services/investments/fixed-income/metrics/get-position-metrics.service';
import { z } from 'zod';

export default createController(z.object({ params: z.object({ id: recordId() }) }), async ({ user, params }) => {
  const metrics = await getFixedIncomePositionMetrics({ userId: user.id, positionId: params.id });
  return { data: metrics };
});
