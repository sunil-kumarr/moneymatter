import { currencyCode } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { createManualSecurity } from '@services/investments/securities/create-manual-security.service';
import { z } from 'zod';

/**
 * POST /api/v1/investments/securities/manual
 *
 * Creates a user-tracked mutual fund security with no market-data provider
 * (e.g. NPS scheme funds not indexed by Yahoo/FMP search). NAV is then
 * recorded per date via POST /securities/:securityId/manual-price.
 */
export default createController(
  z.object({
    body: z.object({
      symbol: z.string().trim().min(1).max(50),
      name: z.string().trim().min(1).max(255),
      currencyCode: currencyCode(),
    }),
  }),
  async ({ body }) => {
    const security = await createManualSecurity({
      symbol: body.symbol,
      name: body.name,
      currencyCode: body.currencyCode,
    });

    return { data: security, statusCode: 201 };
  },
);
