import { FIXED_INCOME_INSTRUMENT_TYPE } from '@bt/shared/types/investments';
import { recordId } from '@common/lib/zod/custom-types';
import { trackMcpToolUsed } from '@js/utils/posthog';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listFixedIncomePositions } from '@services/investments/fixed-income/positions/list.service';
import { z } from 'zod';

import { getUserId, jsonContent } from './helpers';

const inputSchema = {
  portfolioId: recordId().optional().describe('Filter to a specific portfolio (from get_portfolios)'),
  instrumentType: z
    .nativeEnum(FIXED_INCOME_INSTRUMENT_TYPE)
    .optional()
    .describe('Filter by instrument type: fixed_deposit, bond, or peer_loan'),
};

export function registerGetFixedIncomePositions(server: McpServer) {
  server.registerTool(
    'get_fixed_income_positions',
    {
      description:
        "List fixed-income positions (fixed deposits, bonds, peer loans), optionally filtered by portfolio or instrument type. Returns each position's id, name, principal, interest rate, dates, payout settings, and status — use the id with get_fixed_income_events, get_fixed_income_position_metrics, and create_fixed_income_event.",
      inputSchema,
    },
    async (args, extra) => {
      const userId = getUserId({ extra });
      trackMcpToolUsed({ userId, tool: 'get_fixed_income_positions', clientId: extra.authInfo?.clientId });

      const positions = await listFixedIncomePositions({
        userId,
        portfolioId: args.portfolioId,
        instrumentType: args.instrumentType,
      });

      return jsonContent({ data: positions });
    },
  );
}
