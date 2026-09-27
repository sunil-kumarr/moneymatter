import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { deleteIncomeSource } from '@services/income/sources/delete.service';
import { z } from 'zod';

export default createController(z.object({ params: z.object({ id: recordId() }) }), async ({ user, params }) => {
  await deleteIncomeSource({ userId: user.id, sourceId: params.id });
  return { statusCode: 200 };
});
