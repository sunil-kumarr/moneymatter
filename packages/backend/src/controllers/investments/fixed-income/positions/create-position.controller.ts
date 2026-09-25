import {
  BOND_TYPE,
  CREDIT_RATING,
  DAY_COUNT_CONVENTION,
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  FIXED_INCOME_CASH_FLOW_MODE,
  FIXED_INCOME_INSTRUMENT_TYPE,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { decimalString, recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { createFixedIncomePosition } from '@services/investments/fixed-income/positions/create.service';
import { z } from 'zod';

export default createController(
  z.object({
    body: z.object({
      portfolioId: recordId(),
      instrumentType: z.nativeEnum(FIXED_INCOME_INSTRUMENT_TYPE),
      name: z.string().trim().min(1).max(255),
      currencyCode: z.string().length(3),
      principal: decimalString(),
      interestRatePct: decimalString().optional(),
      compoundingFrequency: z.nativeEnum(INTEREST_COMPOUNDING_FREQUENCY).nullable().optional(),
      dayCountConvention: z.nativeEnum(DAY_COUNT_CONVENTION).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
      bondType: z.nativeEnum(BOND_TYPE).nullable().optional(),
      creditRating: z.nativeEnum(CREDIT_RATING).nullable().optional(),
      ytmPct: decimalString().nullable().optional(),
      notes: z.string().nullable().optional(),
      initialInvestment: z
        .object({
          cashFlowMode: z.nativeEnum(FIXED_INCOME_CASH_FLOW_MODE),
          transactionIds: z.array(recordId()).optional(),
        })
        .optional(),
    }),
  }),
  async ({ user, body }) => {
    const position = await createFixedIncomePosition({ userId: user.id, ...body });
    return { data: position, statusCode: 201 };
  },
);
