import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { getFixedIncomePosition } from '@services/investments/fixed-income/positions/get.service';
import { z } from 'zod';

export default createController(z.object({ params: z.object({ id: recordId() }) }), async ({ user, params }) => {
  const position = await getFixedIncomePosition({ userId: user.id, positionId: params.id });
  return { data: position };
});
