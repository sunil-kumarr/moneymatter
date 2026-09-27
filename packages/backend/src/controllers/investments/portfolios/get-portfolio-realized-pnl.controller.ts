import { createController } from '@controllers/helpers/controller-factory';
import { getPortfolioRealizedPnl } from '@services/investments/portfolios/get-portfolio-realized-pnl.service';
import { z } from 'zod';

const schema = z.object({
  params: z.object({
    id: z.string(),
  }),
  query: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
      period: z.string().optional(),
      financialYear: z.string().optional(),
      portfolioIds: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .optional()
    .default({}),
});

export default createController(schema, async ({ user, params, query }) => {
  const rawPortfolioIds = query.portfolioIds;
  const portfolioIds = Array.isArray(rawPortfolioIds)
    ? rawPortfolioIds
    : typeof rawPortfolioIds === 'string'
      ? rawPortfolioIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const result = await getPortfolioRealizedPnl({
    userId: user.id,
    portfolioId: params.id,
    portfolioIds,
    from: query.from,
    to: query.to,
    period: query.period,
    financialYear: query.financialYear,
  });

  return { data: result };
});
