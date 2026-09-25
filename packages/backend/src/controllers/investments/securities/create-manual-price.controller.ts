import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import { createManualPrice } from '@services/investments/securities-price/create-manual-price.service';
import { z } from 'zod';

/**
 * POST /api/v1/investments/securities/:securityId/manual-price
 *
 * Records/upserts a single user-entered NAV point for a mutual fund holding
 * the requesting user owns. Not admin-gated (unlike the bulk-upload path) –
 * this is a regular user action for an asset class with no live price feed.
 */
export default createController(
  z.object({
    params: z.object({ securityId: recordId() }),
    body: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      price: z.number().positive().max(1e12),
    }),
  }),
  async ({ user, params, body }) => {
    const pricing = await createManualPrice({
      userId: user.id,
      securityId: params.securityId,
      date: body.date,
      price: body.price,
    });

    return { data: pricing, statusCode: 201 };
  },
);
