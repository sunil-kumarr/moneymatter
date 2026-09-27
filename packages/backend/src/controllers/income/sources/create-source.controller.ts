import { INCOME_COMPONENT_KIND, INCOME_SOURCE_TYPE, PAY_CADENCE } from '@bt/shared/types/income';
import { decimalMoney, recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { createIncomeSource } from '@services/income/sources/create.service';
import { z } from 'zod';

const componentTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  kind: z.nativeEnum(INCOME_COMPONENT_KIND),
  defaultAmount: z.string().nullable(),
  sortOrder: z.number().int(),
});

export default createController(
  z.object({
    body: z.object({
      name: z.string().trim().min(1).max(255),
      employerName: z.string().trim().max(255).nullable().optional(),
      employerPayeeId: recordId().nullable().optional(),
      jobTitle: z.string().trim().max(255).nullable().optional(),
      sourceType: z.nativeEnum(INCOME_SOURCE_TYPE).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      currencyCode: z.string().length(3),
      payCadence: z.nativeEnum(PAY_CADENCE).optional(),
      expectedAnnualCtc: decimalMoney().nullable().optional(),
      payoutAccountId: recordId().nullable().optional(),
      taxRegime: z.string().trim().max(64).nullable().optional(),
      employerIdentifier: z.string().trim().max(128).nullable().optional(),
      notes: z.string().nullable().optional(),
      color: z.string().trim().max(32).nullable().optional(),
      componentTemplate: z.array(componentTemplateSchema).nullable().optional(),
    }),
  }),
  async ({ user, body }) => {
    const source = await createIncomeSource({ userId: user.id, ...body });
    return { data: source, statusCode: 201 };
  },
);
