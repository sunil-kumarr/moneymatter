import { FIXED_INCOME_INSTRUMENT_TYPE } from '@bt/shared/types/investments';
import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { listFixedIncomePositions } from '@services/investments/fixed-income/positions/list.service';
import { z } from 'zod';

export default createController(
  z.object({
    query: z.object({
      portfolioId: recordId().optional(),
      instrumentType: z.nativeEnum(FIXED_INCOME_INSTRUMENT_TYPE).optional(),
    }),
  }),
  async ({ user, query }) => {
    const positions = await listFixedIncomePositions({
      userId: user.id,
      portfolioId: query.portfolioId,
      instrumentType: query.instrumentType,
    });
    return { data: positions };
  },
);
