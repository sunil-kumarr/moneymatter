import type { IncomeSourceSummaryModel } from '@bt/shared/types/income';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import IncomeCredits from '@models/income/income-credits.model';
import IncomeSources from '@models/income/income-sources.model';
import * as UsersCurrencies from '@models/users-currencies.model';
import * as userExchangeRateService from '@services/user-exchange-rate';
import { Op } from 'sequelize';

import { computeIncomeMetrics, type IncomeMetricCredit } from './income-metrics';

interface GetIncomeSourceSummaryParams {
  userId: number;
  sourceId?: string;
  sourceIds?: string[];
}

export const getIncomeSourceSummary = async ({
  userId,
  sourceId,
  sourceIds,
}: GetIncomeSourceSummaryParams): Promise<IncomeSourceSummaryModel> => {
  const userCurrency = await findOrThrowNotFound({
    query: UsersCurrencies.getCurrency({ userId, isDefaultCurrency: true }),
    message: t({ key: 'income.userBaseCurrencyNotFound' }),
  });
  const baseCurrencyCode = userCurrency.currency.code;

  let sources: IncomeSources[] = [];
  let sourceName = '';
  let currencyCode = baseCurrencyCode;
  let expectedAnnualCtc: number | null = null;

  const isAll = !sourceId || sourceId === 'all';
  if (isAll) {
    if (sourceIds && sourceIds.length > 0) {
      sources = await IncomeSources.findAll({ where: { id: { [Op.in]: sourceIds }, userId } });
      sourceName = sources.length === 1 ? sources[0]!.name : `${sources.length} Sources`;
      currencyCode = sources.length === 1 ? sources[0]!.currencyCode : baseCurrencyCode;
      expectedAnnualCtc = sources.length === 1 ? (sources[0]!.expectedAnnualCtc?.toNumber() ?? null) : null;
    } else {
      sources = await IncomeSources.findAll({ where: { userId } });
      sourceName = 'All Sources';
      currencyCode = baseCurrencyCode;
    }
  } else {
    const singleSource = await findOrThrowNotFound({
      query: IncomeSources.findOne({ where: { id: sourceId, userId } }),
      message: t({ key: 'income.sourceNotFound' }),
    });
    sources = [singleSource];
    sourceName = singleSource.name;
    currencyCode = singleSource.currencyCode;
    expectedAnnualCtc = singleSource.expectedAnnualCtc?.toNumber() ?? null;
  }

  const targetSourceIds = sources.map((s) => s.id);
  const conversionDate = new Date();

  const rateCache = new Map<string, number>();
  const toTargetCurrency = async (amount: number, fromCode: string): Promise<number> => {
    if (!amount || fromCode === currencyCode) return amount;
    const cacheKey = `${fromCode}_${currencyCode}`;
    let rate = rateCache.get(cacheKey);
    if (rate === undefined) {
      try {
        const res = await userExchangeRateService.getExchangeRate({
          userId,
          date: conversionDate,
          baseCode: fromCode,
          quoteCode: currencyCode,
        });
        rate = res.rate;
      } catch {
        rate = 1;
      }
      rateCache.set(cacheKey, rate);
    }
    return amount * rate;
  };

  const rawCredits =
    targetSourceIds.length > 0
      ? await IncomeCredits.findAll({
          where: { userId, incomeSourceId: { [Op.in]: targetSourceIds } },
          order: [['creditDate', 'ASC']],
        })
      : [];

  const credits: IncomeMetricCredit[] = [];
  for (const credit of rawCredits) {
    credits.push({
      creditDate: credit.creditDate,
      creditType: credit.creditType,
      gross: await toTargetCurrency(credit.grossAmount.toNumber(), credit.currencyCode),
      net: await toTargetCurrency(credit.netAmount.toNumber(), credit.currencyCode),
      deductions: await toTargetCurrency(credit.totalDeductions.toNumber(), credit.currencyCode),
      employerContributions: await toTargetCurrency(credit.employerContributions.toNumber(), credit.currencyCode),
    });
  }

  const metrics = computeIncomeMetrics({ credits });

  const netInBase =
    currencyCode === baseCurrencyCode
      ? metrics.totalNet
      : await (async () => {
          const cacheKey = `${currencyCode}_${baseCurrencyCode}`;
          let rate = rateCache.get(cacheKey);
          if (rate === undefined) {
            try {
              const res = await userExchangeRateService.getExchangeRate({
                userId,
                date: conversionDate,
                baseCode: currencyCode,
                quoteCode: baseCurrencyCode,
              });
              rate = res.rate;
            } catch {
              rate = 1;
            }
            rateCache.set(cacheKey, rate);
          }
          return Math.round(metrics.totalNet * rate * 100) / 100;
        })();

  const expectedVsActualPct =
    expectedAnnualCtc && expectedAnnualCtc > 0
      ? Math.round((metrics.annualRunRateNet / expectedAnnualCtc) * 100 * 100) / 100
      : null;

  return {
    sourceId: sourceId || 'all',
    sourceName,
    currencyCode,
    baseCurrencyCode,
    totalGross: metrics.totalGross.toFixed(2),
    totalNet: metrics.totalNet.toFixed(2),
    totalDeductions: metrics.totalDeductions.toFixed(2),
    totalEmployerContributions: metrics.totalEmployerContributions.toFixed(2),
    effectiveDeductionRatePct: metrics.effectiveDeductionRatePct?.toFixed(2) ?? null,
    ytdGross: metrics.ytdGross.toFixed(2),
    ytdNet: metrics.ytdNet.toFixed(2),
    fyLabel: metrics.fyLabel,
    fyGross: metrics.fyGross.toFixed(2),
    fyNet: metrics.fyNet.toFixed(2),
    avgMonthlyNet: metrics.avgMonthlyNet.toFixed(2),
    monthsCounted: metrics.monthsCounted,
    latestCreditDate: metrics.latestCreditDate,
    latestCreditNet: metrics.latestCreditNet?.toFixed(2) ?? null,
    annualRunRateNet: metrics.annualRunRateNet.toFixed(2),
    yoyGrowthPct: metrics.yoyGrowthPct?.toFixed(2) ?? null,
    lastRaiseDate: metrics.lastRaiseDate,
    lastRaiseAmount: metrics.lastRaiseAmount?.toFixed(2) ?? null,
    lastRaisePct: metrics.lastRaisePct?.toFixed(2) ?? null,
    expectedAnnualCtc: expectedAnnualCtc?.toFixed(2) ?? null,
    expectedVsActualPct: expectedVsActualPct?.toFixed(2) ?? null,
    totalNetInBaseCurrency: (currencyCode === baseCurrencyCode ? metrics.totalNet : netInBase).toFixed(2),
  };
};
