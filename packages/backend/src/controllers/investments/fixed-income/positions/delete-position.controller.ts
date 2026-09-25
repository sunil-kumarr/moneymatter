import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { deleteFixedIncomePosition } from '@services/investments/fixed-income/positions/delete.service';
import { z } from 'zod';

export default createController(z.object({ params: z.object({ id: recordId() }) }), async ({ user, params }) => {
  await deleteFixedIncomePosition({ userId: user.id, positionId: params.id });
  return { statusCode: 200 };
});
