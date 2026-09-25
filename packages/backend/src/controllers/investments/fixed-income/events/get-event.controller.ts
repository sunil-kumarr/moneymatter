import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { getFixedIncomeEvent } from '@services/investments/fixed-income/events/get.service';
import { z } from 'zod';

export default createController(z.object({ params: z.object({ id: recordId() }) }), async ({ user, params }) => {
  const event = await getFixedIncomeEvent({ userId: user.id, eventId: params.id });
  return { data: event };
});
