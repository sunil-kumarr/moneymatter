import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { linkTxsToEvent } from '@services/investments/fixed-income/linking/link-txs-to-event.service';
import { z } from 'zod';

export default createController(
  z.object({
    params: z.object({ id: recordId() }),
    body: z.object({ transactionIds: z.array(recordId()).min(1) }),
  }),
  async ({ user, params, body }) => {
    const links = await linkTxsToEvent({
      userId: user.id,
      fixedIncomeEventId: params.id,
      transactionIds: body.transactionIds,
    });
    return { data: links, statusCode: 201 };
  },
);
