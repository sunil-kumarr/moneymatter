import { ASSET_CLASS, COST_BASIS_METHOD, PORTFOLIO_TYPE } from '@bt/shared/types/investments';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import { ValidationError } from '@js/errors';
import Holdings from '@models/investments/holdings.model';
import Portfolios from '@models/investments/portfolios.model';
import Securities from '@models/investments/securities.model';
import * as UsersCurrencies from '@models/users-currencies.model';
import { withTransaction } from '@services/common/with-transaction';
import { recalculateHolding } from '@services/investments/holdings/recalculation.service';

interface UpdatePortfolioParams {
  userId: number;
  portfolioId: string;
  name?: string;
  portfolioType?: PORTFOLIO_TYPE;
  description?: string | null;
  displayCurrencyCode?: string | null;
  isEnabled?: boolean;
  costBasisMethod?: COST_BASIS_METHOD;
}

const updatePortfolioImpl = async ({
  userId,
  portfolioId,
  name,
  portfolioType,
  description,
  displayCurrencyCode,
  isEnabled,
  costBasisMethod,
}: UpdatePortfolioParams) => {
  // Find the portfolio and verify ownership
  const portfolio = await findOrThrowNotFound({
    query: Portfolios.findOne({
      where: { id: portfolioId, userId },
    }),
    message: t({ key: 'investments.portfolioNotFound' }),
  });

  // Duplicate names are allowed — see the matching note in create.service.ts.

  // Display currency must be connected to the user, otherwise the summary
  // endpoint could not resolve an exchange rate for it.
  if (displayCurrencyCode != null) {
    const userCurrency = await UsersCurrencies.getCurrency({ userId, currencyCode: displayCurrencyCode });
    if (!userCurrency) {
      throw new ValidationError({ message: t({ key: 'currencies.currencyNotConnected' }) });
    }
  }

  // Update the portfolio with only provided fields
  const updateData: Partial<Portfolios> = {};

  if (name !== undefined) updateData.name = name.trim();
  if (portfolioType !== undefined) updateData.portfolioType = portfolioType;
  if (description !== undefined) updateData.description = description;
  if (displayCurrencyCode !== undefined) updateData.displayCurrencyCode = displayCurrencyCode;
  if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

  const costBasisMethodChanged = costBasisMethod !== undefined && costBasisMethod !== portfolio.costBasisMethod;
  if (costBasisMethod !== undefined) updateData.costBasisMethod = costBasisMethod;

  await portfolio.update(updateData);

  // Cost basis method only affects mutual_fund holdings (see `COST_BASIS_METHOD`).
  // Flipping it leaves every existing holding's stored `costBasis` stale until
  // its next transaction touch — force it now so the holdings table reflects
  // the new method immediately instead of silently lagging.
  if (costBasisMethodChanged) {
    const mutualFundHoldings = await Holdings.findAll({
      where: { portfolioId },
      include: [{ model: Securities, as: 'security', where: { assetClass: ASSET_CLASS.mutual_fund }, required: true }],
    });
    for (const holding of mutualFundHoldings) {
      await recalculateHolding({ portfolioId, securityId: holding.securityId });
    }
  }

  return portfolio.reload();
};

export const updatePortfolio = withTransaction(updatePortfolioImpl);
