import { decimalString, recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { updateFixedIncomeEvent } from '@services/investments/fixed-income/events/update.service';
import { z } from 'zod';

export default createController(
  z.object({
    params: z.object({ id: recordId() }),
    body: z.object({
      eventDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      grossAmount: decimalString().nullable().optional(),
      principalComponent: decimalString().nullable().optional(),
      interestComponent: decimalString().nullable().optional(),
      resetsAccrualClock: z.boolean().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),
  async ({ user, params, body }) => {
    const event = await updateFixedIncomeEvent({ userId: user.id, eventId: params.id, ...body });
    return { data: event };
  },
);
