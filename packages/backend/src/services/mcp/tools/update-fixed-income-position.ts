import {
  BOND_TYPE,
  CREDIT_RATING,
  DAY_COUNT_CONVENTION,
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { dateString, decimalString, recordId } from '@common/lib/zod/custom-types';
import { trackMcpToolUsed } from '@js/utils/posthog';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { updateFixedIncomePosition } from '@services/investments/fixed-income/positions/update.service';
import { z } from 'zod';

import { getUserId, jsonContent, requireScope } from './helpers';

const inputSchema = {
  positionId: recordId().describe('Fixed income position ID (from get_fixed_income_positions)'),
  name: z.string().optional().describe('Display name, e.g. "HDFC 1-year FD"'),
  startDate: dateString().optional().describe('Position start date, YYYY-MM-DD'),
  interestRatePct: decimalString().optional().describe('Annual interest rate as a percentage, e.g. "7.5"'),
  compoundingFrequency: z
    .nativeEnum(INTEREST_COMPOUNDING_FREQUENCY)
    .nullable()
    .optional()
    .describe('How interest compounds internally. peer_loan positions must use simple or omit this'),
  dayCountConvention: z.nativeEnum(DAY_COUNT_CONVENTION).optional().describe('Day-count basis for accrual'),
  expectedEndDate: dateString().nullable().optional().describe('Expected maturity date, YYYY-MM-DD'),
  counterpartyName: z.string().nullable().optional().describe('Free-text counterparty name (e.g. for a peer_loan)'),
  counterpartyPayeeId: recordId().nullable().optional().describe('Linked payee ID for the counterparty'),
  variantName: z.string().nullable().optional().describe('Product variant, e.g. "Senior Citizen Special"'),
  interestPayoutFrequency: z
    .nativeEnum(INTEREST_PAYOUT_FREQUENCY)
    .optional()
    .describe('How often accrued interest is paid out'),
  maturityInstruction: z.nativeEnum(FIXED_DEPOSIT_MATURITY_INSTRUCTION).optional().describe('What happens at maturity'),
  payoutAccountId: recordId().nullable().optional().describe('Account credited on interest payout / maturity'),
  bondType: z.nativeEnum(BOND_TYPE).nullable().optional().describe('Bond-only attribute'),
  creditRating: z.nativeEnum(CREDIT_RATING).nullable().optional().describe('Bond-only attribute'),
  ytmPct: decimalString().nullable().optional().describe('Yield to maturity as a percentage, bond-only attribute'),
  notes: z.string().nullable().optional().describe('Free-text notes'),
};

export function registerUpdateFixedIncomePosition(server: McpServer) {
  server.registerTool(
    'update_fixed_income_position',
    {
      description:
        "Update an existing fixed-income position's terms, payout settings, or metadata — e.g. linking a payoutAccountId, correcting interestRatePct, or recording bond credit rating (requires finance:write scope). Only provided fields are changed.",
      inputSchema,
    },
    async (args, extra) => {
      const userId = getUserId({ extra });
      requireScope({ extra, scope: 'finance:write' });
      trackMcpToolUsed({ userId, tool: 'update_fixed_income_position', clientId: extra.authInfo?.clientId });

      const { positionId, ...rest } = args;
      const position = await updateFixedIncomePosition({ userId, positionId, ...rest });

      return jsonContent({ data: position });
    },
  );
}
