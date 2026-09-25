import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { deleteFixedIncomeEvent } from '@services/investments/fixed-income/events/delete.service';
import { z } from 'zod';

export default createController(z.object({ params: z.object({ id: recordId() }) }), async ({ user, params }) => {
  await deleteFixedIncomeEvent({ userId: user.id, eventId: params.id });
  return { statusCode: 200 };
});
