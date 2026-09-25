import { FIXED_INCOME_CASH_FLOW_MODE, FIXED_INCOME_EVENT_TYPE } from '@bt/shared/types/investments';
import { decimalString, recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { createFixedIncomeEvent } from '@services/investments/fixed-income/events/create.service';
import { z } from 'zod';

export default createController(
  z.object({
    params: z.object({ positionId: recordId() }),
    body: z.object({
      type: z.nativeEnum(FIXED_INCOME_EVENT_TYPE),
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      grossAmount: decimalString().nullable().optional(),
      principalComponent: decimalString().nullable().optional(),
      interestComponent: decimalString().nullable().optional(),
      currencyCode: z.string().length(3),
      cashFlowMode: z.nativeEnum(FIXED_INCOME_CASH_FLOW_MODE).optional(),
      transactionIds: z.array(recordId()).optional(),
      notes: z.string().nullable().optional(),
    }),
  }),
  async ({ user, params, body }) => {
    const event = await createFixedIncomeEvent({ userId: user.id, positionId: params.positionId, ...body });
    return { data: event, statusCode: 201 };
  },
);
