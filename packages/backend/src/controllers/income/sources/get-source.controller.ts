import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { getIncomeSource } from '@services/income/sources/get.service';
import { z } from 'zod';

export default createController(z.object({ params: z.object({ id: recordId() }) }), async ({ user, params }) => {
  const source = await getIncomeSource({ userId: user.id, sourceId: params.id });
  return { data: source };
});
