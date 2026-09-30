import { ASSET_CLASS, SECURITY_PROVIDER } from '@bt/shared/types/investments';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import * as helpers from '@tests/helpers';

describe('POST /investments/securities/manual', () => {
  it('creates a manual mutual fund security', async () => {
    const security = await helpers.createManualSecurity({
      payload: { symbol: 'NPSICICIE', name: 'ICICI Pension Fund Scheme E - Tier I', currencyCode: 'INR' },
      raw: true,
    });

    expect(security).toMatchObject({
      symbol: 'NPSICICIE',
      name: 'ICICI Pension Fund Scheme E - Tier I',
      currencyCode: 'INR',
      assetClass: ASSET_CLASS.mutual_fund,
      providerName: SECURITY_PROVIDER.manual,
    });
  });

  it('reuses the existing row instead of duplicating on the same symbol/currency', async () => {
    const first = await helpers.createManualSecurity({
      payload: { symbol: 'NPSICICIC', name: 'ICICI Pension Fund Scheme C - Tier I', currencyCode: 'INR' },
      raw: true,
    });

    const second = await helpers.createManualSecurity({
      payload: { symbol: 'npsiciciC', name: 'ICICI Pension Fund Scheme C - Tier I (renamed)', currencyCode: 'inr' },
      raw: true,
    });

    expect(second.id).toEqual(first.id);

    const all = await helpers.getAllSecurities({ raw: true });
    expect(all.filter((s) => s.symbol === 'NPSICICIC')).toHaveLength(1);
  });

  it('rejects an empty symbol', async () => {
    const result = await helpers.createManualSecurity({
      payload: { symbol: '', name: 'Invalid Fund', currencyCode: 'INR' },
    });

    expect(result.statusCode).toEqual(ERROR_CODES.ValidationError);
  });

  it('rejects an invalid currency code', async () => {
    const result = await helpers.createManualSecurity({
      payload: { symbol: 'NPSTEST', name: 'Test Fund', currencyCode: 'XXX' },
    });

    expect(result.statusCode).toEqual(ERROR_CODES.ValidationError);
  });
});
