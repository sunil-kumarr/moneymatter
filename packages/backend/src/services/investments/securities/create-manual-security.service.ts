import { ASSET_CLASS, SECURITY_PROVIDER } from '@bt/shared/types/investments';
import Securities from '@models/investments/securities.model';
import { withTransaction } from '@services/common/with-transaction';

interface CreateManualSecurityParams {
  symbol: string;
  name: string;
  currencyCode: string;
}

/**
 * Creates (or reuses) a manually-tracked mutual fund security with no
 * market-data provider integration — for funds that don't exist in the
 * Yahoo/FMP search index (e.g. India's NPS scheme funds), so users can still
 * hold units and record NAV via create-manual-price. Dedupes on
 * (symbol, currencyCode, assetClass) like the provider-sync path, so
 * resubmitting the same fund reuses the row instead of creating duplicates.
 */
const createManualSecurityImpl = async ({ symbol, name, currencyCode }: CreateManualSecurityParams) => {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedCurrency = currencyCode.trim().toUpperCase();

  const existing = await Securities.findOne({
    where: { symbol: normalizedSymbol, currencyCode: normalizedCurrency, assetClass: ASSET_CLASS.mutual_fund },
  });

  if (existing) {
    return existing;
  }

  return Securities.create({
    symbol: normalizedSymbol,
    providerSymbol: normalizedSymbol,
    name,
    currencyCode: normalizedCurrency,
    providerName: SECURITY_PROVIDER.manual,
    assetClass: ASSET_CLASS.mutual_fund,
    isBrokerageCash: false,
  });
};

export const createManualSecurity = withTransaction(createManualSecurityImpl);
