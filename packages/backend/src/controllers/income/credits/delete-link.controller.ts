import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { unlinkTxFromCredit } from '@services/income/linking/unlink-tx-from-credit.service';
import { z } from 'zod';

export default createController(
  z.object({
    params: z.object({ id: recordId(), transactionId: recordId() }),
  }),
  async ({ user, params }) => {
    await unlinkTxFromCredit({ userId: user.id, incomeCreditId: params.id, transactionId: params.transactionId });
    return { statusCode: 200 };
  },
);
