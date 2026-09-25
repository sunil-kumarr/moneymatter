import { recordId } from '@common/lib/zod/custom-types';
import { trackMcpToolUsed } from '@js/utils/posthog';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listFixedIncomeEvents } from '@services/investments/fixed-income/events/list.service';

import { getUserId, jsonContent } from './helpers';

const inputSchema = {
  positionId: recordId().describe('Fixed income position ID (from get_fixed_income_positions)'),
};

export function registerGetFixedIncomeEvents(server: McpServer) {
  server.registerTool(
    'get_fixed_income_events',
    {
      description:
        'List all events (initial_investment, interest_accrual_payout, partial/full_repayment, maturity, writedown, fee) recorded on a fixed-income position, oldest first. Each event includes eventDate, grossAmount, principalComponent, interestComponent, taxWithheld, cashFlowMode, and any linked bank transactions.',
      inputSchema,
    },
    async (args, extra) => {
      const userId = getUserId({ extra });
      trackMcpToolUsed({ userId, tool: 'get_fixed_income_events', clientId: extra.authInfo?.clientId });

      const events = await listFixedIncomeEvents({ userId, positionId: args.positionId });

      return jsonContent({ data: events });
    },
  );
}
