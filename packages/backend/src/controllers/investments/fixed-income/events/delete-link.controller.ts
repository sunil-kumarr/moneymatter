import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { unlinkTxFromEvent } from '@services/investments/fixed-income/linking/unlink-tx-from-event.service';
import { z } from 'zod';

export default createController(
  z.object({
    params: z.object({ id: recordId(), linkId: recordId() }),
  }),
  async ({ user, params }) => {
    await unlinkTxFromEvent({ userId: user.id, fixedIncomeEventId: params.id, linkId: params.linkId });
    return { statusCode: 200 };
  },
);
