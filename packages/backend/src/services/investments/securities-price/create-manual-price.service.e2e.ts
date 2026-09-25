import { ASSET_CLASS, SECURITY_PROVIDER } from '@bt/shared/types/investments';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import Securities from '@models/investments/securities.model';
import * as helpers from '@tests/helpers';

async function createMutualFundHolding() {
  const portfolio = await helpers.createPortfolio({ raw: true });
  const security = await Securities.create({
    symbol: 'MFTEST',
    providerSymbol: 'MFTEST',
    currencyCode: 'USD',
    providerName: SECURITY_PROVIDER.yahoo,
    assetClass: ASSET_CLASS.mutual_fund,
    name: 'Test Mutual Fund',
  });

  await helpers.createHolding({ payload: { portfolioId: portfolio.id, securityId: security.id }, raw: true });

  return { portfolio, security };
}

describe('POST /investments/securities/:securityId/manual-price', () => {
  it('creates a manual price for a held mutual fund', async () => {
    const { security } = await createMutualFundHolding();

    const pricing = await helpers.createManualPrice({
      securityId: security.id,
      payload: { date: '2026-01-10', price: 42.5 },
      raw: true,
    });

    expect(pricing).toMatchObject({ securityId: security.id, priceClose: 42.5, source: 'manual' });
  });

  it('upserts (updates, not duplicates) the price for the same date', async () => {
    const { security } = await createMutualFundHolding();

    await helpers.createManualPrice({
      securityId: security.id,
      payload: { date: '2026-01-10', price: 42.5 },
      raw: true,
    });

    const updated = await helpers.createManualPrice({
      securityId: security.id,
      payload: { date: '2026-01-10', price: 45 },
      raw: true,
    });

    expect(updated).toMatchObject({ securityId: security.id, priceClose: 45, source: 'manual' });

    const prices = await helpers.getSecuritiesPricesByDate({
      params: { securityId: security.id },
      raw: true,
    });
    expect(prices).toHaveLength(1);
  });

  it('rejects a security the user does not hold', async () => {
    const security = await Securities.create({
      symbol: 'MFUNHELD',
      providerSymbol: 'MFUNHELD',
      currencyCode: 'USD',
      providerName: SECURITY_PROVIDER.yahoo,
      assetClass: ASSET_CLASS.mutual_fund,
      name: 'Unheld Mutual Fund',
    });

    const result = await helpers.createManualPrice({
      securityId: security.id,
      payload: { date: '2026-01-10', price: 42.5 },
    });

    expect(result.statusCode).toEqual(ERROR_CODES.NotFoundError);
  });

  it('rejects a non-mutual-fund security', async () => {
    const portfolio = await helpers.createPortfolio({ raw: true });
    const security = await Securities.create({
      symbol: 'STKTEST',
      providerSymbol: 'STKTEST',
      currencyCode: 'USD',
      providerName: SECURITY_PROVIDER.fmp,
      assetClass: ASSET_CLASS.stocks,
      name: 'Test Stock',
    });
    await helpers.createHolding({ payload: { portfolioId: portfolio.id, securityId: security.id }, raw: true });

    const result = await helpers.createManualPrice({
      securityId: security.id,
      payload: { date: '2026-01-10', price: 42.5 },
    });

    expect(result.statusCode).toEqual(ERROR_CODES.ValidationError);
  });

  it('returns not found for a nonexistent security', async () => {
    const result = await helpers.createManualPrice({
      securityId: '00000000-0000-0000-0000-000000000000',
      payload: { date: '2026-01-10', price: 42.5 },
    });

    expect(result.statusCode).toEqual(ERROR_CODES.NotFoundError);
  });
});
