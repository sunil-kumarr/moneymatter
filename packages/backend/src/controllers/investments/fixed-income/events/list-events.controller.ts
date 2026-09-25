import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { listFixedIncomeEvents } from '@services/investments/fixed-income/events/list.service';
import { z } from 'zod';

export default createController(
  z.object({ params: z.object({ positionId: recordId() }) }),
  async ({ user, params }) => {
    const events = await listFixedIncomeEvents({ userId: user.id, positionId: params.positionId });
    return { data: events };
  },
);
