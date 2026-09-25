import { FIXED_INCOME_CASH_FLOW_MODE, FIXED_INCOME_EVENT_TYPE } from '@bt/shared/types/investments';
import { currencyCode, dateString, decimalString, recordId } from '@common/lib/zod/custom-types';
import { trackMcpToolUsed } from '@js/utils/posthog';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createFixedIncomeEvent } from '@services/investments/fixed-income/events/create.service';
import { z } from 'zod';

import { getUserId, jsonContent, requireScope } from './helpers';

const inputSchema = {
  positionId: recordId().describe(
    'Fixed income position ID (from create_fixed_income_position or get_portfolio_holdings)',
  ),
  type: z
    .nativeEnum(FIXED_INCOME_EVENT_TYPE)
    .describe(
      'Event type. initial_investment is auto-created by create_fixed_income_position — do not create another one for the same position. writedown cannot have a cash flow (cashFlowMode must be none)',
    ),
  eventDate: dateString().describe('Event date, YYYY-MM-DD'),
  grossAmount: decimalString().nullable().optional().describe('Gross amount for this event, as a decimal string'),
  principalComponent: decimalString()
    .nullable()
    .optional()
    .describe('Portion of grossAmount that is principal. Defaults to grossAmount for repayment/maturity events'),
  interestComponent: decimalString().nullable().optional().describe('Portion of grossAmount that is interest'),
  taxWithheld: decimalString()
    .nullable()
    .optional()
    .describe("Tax deducted at source on this event's interest, if any (e.g. TDS on a bond coupon)"),
  currencyCode: currencyCode().describe('ISO 4217 currency code, matching the position currency'),
  cashFlowMode: z
    .nativeEnum(FIXED_INCOME_CASH_FLOW_MODE)
    .optional()
    .describe(
      'linked = tie to existing bank transactions; out_of_wallet = record without affecting bank balances; none (default) = not tracked as cash flow. writedown events must use none',
    ),
  resetsAccrualClock: z
    .boolean()
    .optional()
    .describe(
      'Whether an interest_accrual_payout event flushes accrued interest and resets the compounding clock at its date (default true). Set false for a recorded interest credit that did not verifiably reach cash the user controls (e.g. an internal bank sweep to an unrelated account) — it stays in the ledger for history without interrupting continuous compounding.',
    ),
  transactionIds: z
    .array(recordId())
    .optional()
    .describe('Bank transaction ids to link. Only used when cashFlowMode=linked'),
  notes: z.string().nullable().optional().describe('Free-text notes'),
};

export function registerCreateFixedIncomeEvent(server: McpServer) {
  server.registerTool(
    'create_fixed_income_event',
    {
      description:
        'Record an event on a fixed-income position (interest payout, partial/full repayment, maturity, writedown, or fee). Recomputes the position status after the event is created. Use create_fixed_income_position to create the initial_investment event instead — this tool rejects a second one for the same position.',
      inputSchema,
    },
    async (args, extra) => {
      const userId = getUserId({ extra });
      requireScope({ extra, scope: 'finance:write' });
      trackMcpToolUsed({ userId, tool: 'create_fixed_income_event', clientId: extra.authInfo?.clientId });

      const event = await createFixedIncomeEvent({
        userId,
        positionId: args.positionId,
        type: args.type,
        eventDate: args.eventDate,
        grossAmount: args.grossAmount,
        principalComponent: args.principalComponent,
        interestComponent: args.interestComponent,
        taxWithheld: args.taxWithheld,
        currencyCode: args.currencyCode,
        cashFlowMode: args.cashFlowMode,
        resetsAccrualClock: args.resetsAccrualClock,
        transactionIds: args.transactionIds,
        notes: args.notes,
      });

      return jsonContent({ data: event });
    },
  );
}
