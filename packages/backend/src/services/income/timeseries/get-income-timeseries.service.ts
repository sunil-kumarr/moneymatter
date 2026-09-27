import { INCOME_CREDIT_TYPE } from '@bt/shared/types/income';
import type { IncomeTimeseriesResponse, MonthlyIncomeItem } from '@bt/shared/types/income/income-timeseries.model';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import IncomeCredits from '@models/income/income-credits.model';
import IncomeSources from '@models/income/income-sources.model';
import * as UsersCurrencies from '@models/users-currencies.model';
import * as userExchangeRateService from '@services/user-exchange-rate';
import { Op } from 'sequelize';

import { resolveIncomePeriod } from './income-period';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

interface GetIncomeTimeseriesParams {
  userId: number;
  sourceId?: string;
  sourceIds?: string[];
  period?: string;
  financialYear?: string;
  from?: string;
  to?: string;
}

export const getIncomeTimeseries = async ({
  userId,
  sourceId,
  sourceIds,
  period,
  financialYear,
  from,
  to,
}: GetIncomeTimeseriesParams): Promise<IncomeTimeseriesResponse> => {
  const userCurrency = await findOrThrowNotFound({
    query: UsersCurrencies.getCurrency({ userId, isDefaultCurrency: true }),
    message: t({ key: 'income.userBaseCurrencyNotFound' }),
  });
  const baseCurrencyCode = userCurrency.currency.code;

  let sources: IncomeSources[] = [];
  let sourceName = '';
  let currencyCode = baseCurrencyCode;

  const isAll = !sourceId || sourceId === 'all';
  if (isAll) {
    if (sourceIds && sourceIds.length > 0) {
      sources = await IncomeSources.findAll({ where: { id: { [Op.in]: sourceIds }, userId } });
      sourceName = sources.length === 1 ? sources[0]!.name : `${sources.length} Sources`;
      currencyCode = sources.length === 1 ? sources[0]!.currencyCode : baseCurrencyCode;
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

  const credits =
    targetSourceIds.length > 0
      ? await IncomeCredits.findAll({
          where: { userId, incomeSourceId: { [Op.in]: targetSourceIds } },
          order: [['creditDate', 'ASC']],
        })
      : [];

  const creditDates = credits.map((c) => new Date(`${c.creditDate}T00:00:00.000Z`));
  const { activePeriod, isFyMode, startDate, endDate, availableFinancialYears } = resolveIncomePeriod({
    creditDates,
    period,
    financialYear,
    from,
    to,
  });

  interface CreditPoint {
    date: Date;
    gross: number;
    net: number;
    deductions: number;
    employerContributions: number;
    creditType: INCOME_CREDIT_TYPE;
  }

  const points: CreditPoint[] = [];
  for (const credit of credits) {
    const date = new Date(`${credit.creditDate}T00:00:00.000Z`);
    if (date < startDate || date > endDate) continue;
    const sourceCurrency = credit.currencyCode;
    points.push({
      date,
      gross: await toTargetCurrency(credit.grossAmount.toNumber(), sourceCurrency),
      net: await toTargetCurrency(credit.netAmount.toNumber(), sourceCurrency),
      deductions: await toTargetCurrency(credit.totalDeductions.toNumber(), sourceCurrency),
      employerContributions: await toTargetCurrency(credit.employerContributions.toNumber(), sourceCurrency),
      creditType: credit.creditType,
    });
  }

  const months: MonthlyIncomeItem[] = [];
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  const monthSlots: { mIndex: number; year: number }[] = [];
  if (isFyMode) {
    const fyStartYear = startDate.getFullYear();
    for (let i = 3; i <= 11; i++) monthSlots.push({ mIndex: i, year: fyStartYear });
    for (let i = 0; i <= 2; i++) monthSlots.push({ mIndex: i, year: fyStartYear + 1 });
  } else {
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cursor <= last) {
      monthSlots.push({ mIndex: cursor.getMonth(), year: cursor.getFullYear() });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  let cumulativeNet = 0;
  for (const { mIndex, year } of monthSlots) {
    const monthLabel = MONTH_NAMES[mIndex]!;
    const dateKey = `${year}-${(mIndex + 1).toString().padStart(2, '0')}`;

    const matching = points.filter((p) => p.date.getFullYear() === year && p.date.getMonth() === mIndex);

    const gross = matching.reduce((acc, p) => acc + p.gross, 0);
    const net = matching.reduce((acc, p) => acc + p.net, 0);
    const deductions = matching.reduce((acc, p) => acc + p.deductions, 0);
    const employerContributions = matching.reduce((acc, p) => acc + p.employerContributions, 0);

    const byType: Partial<Record<INCOME_CREDIT_TYPE, number>> = {};
    for (const p of matching) {
      byType[p.creditType] = (byType[p.creditType] ?? 0) + p.net;
    }

    cumulativeNet += net;

    months.push({
      month: monthLabel,
      year,
      dateKey,
      gross: Math.round(gross * 100) / 100,
      net: Math.round(net * 100) / 100,
      deductions: Math.round(deductions * 100) / 100,
      employerContributions: Math.round(employerContributions * 100) / 100,
      cumulativeNet: Math.round(cumulativeNet * 100) / 100,
      creditCount: matching.length,
      byType,
      isCurrent: dateKey === currentMonthKey,
      isFuture: dateKey > currentMonthKey,
    });
  }

  const totalGross = months.reduce((acc, m) => acc + m.gross, 0);
  const totalNet = months.reduce((acc, m) => acc + m.net, 0);
  const totalDeductions = months.reduce((acc, m) => acc + m.deductions, 0);

  return {
    sourceId: sourceId || 'all',
    sourceName,
    currencyCode,
    totalGross: Math.round(totalGross * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    period: activePeriod,
    availableFinancialYears,
    months,
  };
};
