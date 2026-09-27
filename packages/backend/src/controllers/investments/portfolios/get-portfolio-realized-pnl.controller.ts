import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { getPortfolioRealizedPnl } from '@services/investments/portfolios/get-portfolio-realized-pnl.service';
import { z } from 'zod';

const schema = z.object({
  params: z.object({
    id: recordId(),
  }),
  query: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
      period: z.string().optional(),
      financialYear: z.string().optional(),
    })
    .optional()
    .default({}),
});

export default createController(schema, async ({ user, params, query }) => {
  const result = await getPortfolioRealizedPnl({
    userId: user.id,
    portfolioId: params.id,
    from: query.from,
    to: query.to,
    period: query.period,
    financialYear: query.financialYear,
  });

  return { data: result };
});
