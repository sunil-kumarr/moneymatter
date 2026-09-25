import { ASSET_CLASS } from '@bt/shared/types/investments';
import { NotFoundError, ValidationError } from '@js/errors';
import Holdings from '@models/investments/holdings.model';
import Portfolios from '@models/investments/portfolios.model';
import Securities from '@models/investments/securities.model';
import SecurityPricing from '@models/investments/security-pricing.model';
import { withTransaction } from '@services/common/with-transaction';
import { startOfDay } from 'date-fns';

interface CreateManualPriceParams {
  userId: number;
  securityId: string;
  date: string;
  price: number;
}

/**
 * Records one user-entered price point for a security with no auto-sync
 * provider (currently: mutual funds only). Unlike the admin bulk-upload path
 * (`bulk-upload-prices.service.ts`, which backfills historical data for
 * currency-conversion needs system-wide), this is scoped to a single security
 * the requesting user actually holds, so a regular user can enter their own
 * NAV without admin access.
 */
const createManualPriceImpl = async ({ userId, securityId, date, price }: CreateManualPriceParams) => {
  const security = await Securities.findByPk(securityId);

  if (!security) {
    throw new NotFoundError({ message: 'Security not found.' });
  }

  if (security.assetClass !== ASSET_CLASS.mutual_fund) {
    throw new ValidationError({
      message: 'Manual price entry is only supported for mutual fund holdings.',
    });
  }

  const holding = await Holdings.findOne({
    where: { securityId },
    include: [{ model: Portfolios, as: 'portfolio', attributes: [], where: { userId }, required: true }],
  });

  if (!holding) {
    throw new NotFoundError({ message: 'You do not hold this security.' });
  }

  const [pricing] = await SecurityPricing.upsert({
    securityId,
    date: startOfDay(new Date(date)),
    priceClose: price.toString(),
    source: 'manual',
  });

  return pricing;
};

export const createManualPrice = withTransaction(createManualPriceImpl);
