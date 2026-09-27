import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { deleteIncomeCredit } from '@services/income/credits/delete.service';
import { z } from 'zod';

export default createController(z.object({ params: z.object({ id: recordId() }) }), async ({ user, params }) => {
  await deleteIncomeCredit({ userId: user.id, creditId: params.id });
  return { statusCode: 200 };
});
