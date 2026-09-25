import {
  DAY_COUNT_CONVENTION,
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  FIXED_INCOME_CASH_FLOW_MODE,
  FIXED_INCOME_INSTRUMENT_TYPE,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
} from '@bt/shared/types/investments';
import { currencyCode, dateString, decimalString, recordId } from '@common/lib/zod/custom-types';
import { trackMcpToolUsed } from '@js/utils/posthog';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createFixedIncomePosition } from '@services/investments/fixed-income/positions/create.service';
import { z } from 'zod';

import { getUserId, jsonContent, requireScope } from './helpers';

const inputSchema = {
  portfolioId: recordId().describe('Portfolio ID to hold this position (from list get_portfolios)'),
  instrumentType: z
    .nativeEnum(FIXED_INCOME_INSTRUMENT_TYPE)
    .describe('fixed_deposit, bond, or peer_loan. peer_loans only support simple interest'),
  name: z.string().describe('Display name, e.g. "HDFC 1-year FD"'),
  currencyCode: currencyCode().describe('ISO 4217 currency code, e.g. "USD"'),
  principal: decimalString().describe('Principal amount as a decimal string, e.g. "10000"'),
  interestRatePct: decimalString().optional().describe('Annual interest rate as a percentage, e.g. "7.5". Default: 0'),
  compoundingFrequency: z
    .nativeEnum(INTEREST_COMPOUNDING_FREQUENCY)
    .nullable()
    .optional()
    .describe('How interest compounds internally. peer_loan positions must use simple or omit this'),
  dayCountConvention: z
    .nativeEnum(DAY_COUNT_CONVENTION)
    .optional()
    .describe('Day-count basis for accrual. Default: actual_365'),
  startDate: dateString().describe('Position start date, YYYY-MM-DD'),
  expectedEndDate: dateString().nullable().optional().describe('Expected maturity date, YYYY-MM-DD'),
  counterpartyName: z.string().nullable().optional().describe('Free-text counterparty name (e.g. for a peer_loan)'),
  counterpartyPayeeId: recordId().nullable().optional().describe('Linked payee ID for the counterparty'),
  variantName: z.string().nullable().optional().describe('Product variant, e.g. "Senior Citizen Special"'),
  interestPayoutFrequency: z
    .nativeEnum(INTEREST_PAYOUT_FREQUENCY)
    .optional()
    .describe('How often accrued interest is paid out. Default: cumulative (paid with principal at maturity)'),
  maturityInstruction: z
    .nativeEnum(FIXED_DEPOSIT_MATURITY_INSTRUCTION)
    .optional()
    .describe('What happens at maturity. Default: credit_to_account'),
  payoutAccountId: recordId().nullable().optional().describe('Account credited on interest payout / maturity'),
  notes: z.string().nullable().optional().describe('Free-text notes'),
  initialInvestmentCashFlowMode: z
    .nativeEnum(FIXED_INCOME_CASH_FLOW_MODE)
    .optional()
    .describe(
      'How the initial_investment event (auto-created, amount = principal) is tracked. linked = tie to existing bank transactions; out_of_wallet = record without affecting bank balances; none (default) = not tracked as cash flow',
    ),
  initialInvestmentTransactionIds: z
    .array(recordId())
    .optional()
    .describe('Bank transaction ids to link to the initial_investment event. Required when cashFlowMode=linked'),
};

export function registerCreateFixedIncomePosition(server: McpServer) {
  server.registerTool(
    'create_fixed_income_position',
    {
      description:
        'Create a fixed-income position (fixed deposit, bond, or peer loan) in a portfolio. Automatically creates the initial_investment event seeding the principal — without it, accrued interest always computes to zero. Returns the created position with its id, which is then used with create_fixed_income_event.',
      inputSchema,
    },
    async (args, extra) => {
      const userId = getUserId({ extra });
      requireScope({ extra, scope: 'finance:write' });
      trackMcpToolUsed({ userId, tool: 'create_fixed_income_position', clientId: extra.authInfo?.clientId });

      const position = await createFixedIncomePosition({
        userId,
        portfolioId: args.portfolioId,
        instrumentType: args.instrumentType,
        name: args.name,
        currencyCode: args.currencyCode,
        principal: args.principal,
        interestRatePct: args.interestRatePct,
        compoundingFrequency: args.compoundingFrequency,
        dayCountConvention: args.dayCountConvention,
        startDate: args.startDate,
        expectedEndDate: args.expectedEndDate,
        counterpartyName: args.counterpartyName,
        counterpartyPayeeId: args.counterpartyPayeeId,
        variantName: args.variantName,
        interestPayoutFrequency: args.interestPayoutFrequency,
        maturityInstruction: args.maturityInstruction,
        payoutAccountId: args.payoutAccountId,
        notes: args.notes,
        initialInvestment: {
          cashFlowMode: args.initialInvestmentCashFlowMode ?? FIXED_INCOME_CASH_FLOW_MODE.none,
          transactionIds: args.initialInvestmentTransactionIds,
        },
      });

      return jsonContent({ data: position });
    },
  );
}
