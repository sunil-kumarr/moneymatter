import { dateString, recordId } from '@common/lib/zod/custom-types';
import { trackMcpToolUsed } from '@js/utils/posthog';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getFixedIncomePositionMetrics } from '@services/investments/fixed-income/metrics/get-position-metrics.service';

import { getUserId, jsonContent } from './helpers';

const inputSchema = {
  positionId: recordId().describe('Fixed income position ID (from get_fixed_income_positions)'),
  asOfDate: dateString().optional().describe('Compute metrics as of this date (ISO 8601). Default: today'),
};

export function registerGetFixedIncomePositionMetrics(server: McpServer) {
  server.registerTool(
    'get_fixed_income_position_metrics',
    {
      description:
        'Computed metrics for a single fixed-income position: cost basis, principal outstanding, accrued unpaid interest, current value, total interest received, total repaid, realized/unrealized gain (value and percent), and the projected nextPayoutDate. nextPayoutDate is a projection from the payout frequency and the last accrual reset — the actual date of a recorded interest_accrual_payout event can differ (e.g. issuer pays a few days late) and always wins once recorded via create_fixed_income_event.',
      inputSchema,
    },
    async (args, extra) => {
      const userId = getUserId({ extra });
      trackMcpToolUsed({ userId, tool: 'get_fixed_income_position_metrics', clientId: extra.authInfo?.clientId });

      const metrics = await getFixedIncomePositionMetrics({
        userId,
        positionId: args.positionId,
        asOfDate: args.asOfDate ? new Date(args.asOfDate) : undefined,
      });

      return jsonContent({ data: metrics });
    },
  );
}
