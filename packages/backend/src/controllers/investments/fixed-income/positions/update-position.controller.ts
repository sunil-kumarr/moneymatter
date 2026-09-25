import {
  DAY_COUNT_CONVENTION,
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { decimalString, recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { updateFixedIncomePosition } from '@services/investments/fixed-income/positions/update.service';
import { z } from 'zod';

export default createController(
  z.object({
    params: z.object({ id: recordId() }),
    body: z.object({
      name: z.string().trim().min(1).max(255).optional(),
      interestRatePct: decimalString().optional(),
      compoundingFrequency: z.nativeEnum(INTEREST_COMPOUNDING_FREQUENCY).nullable().optional(),
      dayCountConvention: z.nativeEnum(DAY_COUNT_CONVENTION).optional(),
      expectedEndDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      counterpartyName: z.string().trim().max(255).nullable().optional(),
      counterpartyPayeeId: recordId().nullable().optional(),
      variantName: z.string().trim().max(255).nullable().optional(),
      interestPayoutFrequency: z.nativeEnum(INTEREST_PAYOUT_FREQUENCY).optional(),
      maturityInstruction: z.nativeEnum(FIXED_DEPOSIT_MATURITY_INSTRUCTION).optional(),
      payoutAccountId: recordId().nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  }),
  async ({ user, params, body }) => {
    const position = await updateFixedIncomePosition({ userId: user.id, positionId: params.id, ...body });
    return { data: position };
  },
);
