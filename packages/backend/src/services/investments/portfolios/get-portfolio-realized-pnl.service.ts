import {
  ASSET_CLASS,
  COST_BASIS_METHOD,
  INVESTMENT_TRADE_TYPE,
  INVESTMENT_TRANSACTION_CATEGORY,
} from '@bt/shared/types/investments';
import type {
  MonthlyRealizedPnlItem,
  PortfolioRealizedPnlResponse,
} from '@bt/shared/types/investments/portfolio-realized-pnl.model';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import InvestmentTransaction from '@models/investments/investment-transaction.model';
import Portfolios from '@models/investments/portfolios.model';
import Securities from '@models/investments/securities.model';
import * as UsersCurrencies from '@models/users-currencies.model';
import { Big } from 'big.js';
import {
  addMonths,
  differenceInCalendarMonths,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
  subYears,
} from 'date-fns';
import { Op } from 'sequelize';

import { applyCostBasisLeg, createInitialCostBasisState, type CostBasisLeg } from '../holdings/cost-basis-replay';

interface GetPortfolioRealizedPnlParams {
  userId: number;
  portfolioId: string;
  from?: string;
  to?: string;
  period?: string;
  financialYear?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Returns the Indian Financial Year string (e.g. 'FY 2023-24') for a given date.
 * Apr 1 to Mar 31 defines the financial year.
 */
export function getFinancialYear(date: Date): string {
  const month = date.getUTCMonth(); // 0 = Jan, 3 = Apr
  const year = date.getUTCFullYear();
  if (month >= 3) {
    const nextYear = (year + 1).toString().slice(-2);
    return `FY ${year}-${nextYear}`;
  }
  const prevYear = year - 1;
  const curYear = year.toString().slice(-2);
  return `FY ${prevYear}-${curYear}`;
}

/**
 * Returns { start: Date, end: Date } for an FY string like 'FY 2023-24' or 'FY2023-24'.
 */
export function getFinancialYearRange(fyStr: string): { start: Date; end: Date } | null {
  const match = fyStr.match(/(\d{4})/);
  if (!match) return null;
  const startYear = parseInt(match[1]!, 10);
  return {
    start: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)), // Apr 1
    end: new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)), // Mar 31
  };
}

export const getPortfolioRealizedPnl = async ({
  userId,
  portfolioId,
  from,
  to,
  period,
  financialYear,
}: GetPortfolioRealizedPnlParams): Promise<PortfolioRealizedPnlResponse> => {
  const portfolio = await findOrThrowNotFound({
    query: Portfolios.findOne({
      where: { id: portfolioId, userId },
    }),
    message: t({ key: 'investments.portfolioNotFound' }),
  });

  const userCurrency = await findOrThrowNotFound({
    query: UsersCurrencies.getCurrency({
      userId,
      isDefaultCurrency: true,
    }),
    message: t({ key: 'investments.userBaseCurrencyNotFound' }),
  });

  const baseCurrencyCode = userCurrency.currency.code;
  const currencyCode = portfolio.displayCurrencyCode || baseCurrencyCode;

  // Fetch all buy/sell transactions for this portfolio, ordered chronologically
  const transactions = await InvestmentTransaction.findAll({
    where: {
      portfolioId,
      category: { [Op.in]: [INVESTMENT_TRANSACTION_CATEGORY.buy, INVESTMENT_TRANSACTION_CATEGORY.sell] },
    },
    include: [
      {
        model: Securities,
        as: 'security',
        required: true,
      },
    ],
    order: [
      ['date', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });

  // Group by securityId to replay cost basis per security
  const txBySecurity = new Map<string, InvestmentTransaction[]>();
  for (const tx of transactions) {
    const list = txBySecurity.get(tx.securityId) ?? [];
    list.push(tx);
    txBySecurity.set(tx.securityId, list);
  }

  interface PnlEvent {
    date: Date;
    realizedPnl: number;
    charges: number;
    isSell: boolean;
  }

  const pnlEvents: PnlEvent[] = [];

  for (const [_, txs] of txBySecurity.entries()) {
    const firstTx = txs[0]!;
    const isMutualFund = firstTx.security?.assetClass === ASSET_CLASS.mutual_fund;
    const method =
      isMutualFund && portfolio.costBasisMethod === COST_BASIS_METHOD.fifo
        ? COST_BASIS_METHOD.fifo
        : COST_BASIS_METHOD.weighted_average;

    // Intraday vs delivery separation
    const intradayTxsByDay = new Map<string, InvestmentTransaction[]>();
    const deliveryTxs: InvestmentTransaction[] = [];

    for (const tx of txs) {
      if (tx.tradeType === INVESTMENT_TRADE_TYPE.intraday) {
        const dayKey = format(tx.date, 'yyyy-MM-dd');
        const list = intradayTxsByDay.get(dayKey) ?? [];
        list.push(tx);
        intradayTxsByDay.set(dayKey, list);
      } else {
        deliveryTxs.push(tx);
      }
    }

    // Process intraday trades
    for (const [_, dayTxs] of intradayTxsByDay.entries()) {
      let buyCost = 0;
      let sellProceeds = 0;
      let totalFees = 0;
      for (const tx of dayTxs) {
        const q = Number(tx.quantity);
        const p = Number(tx.price);
        const fees = Number(tx.fees || 0);
        totalFees += fees;
        const amt = q * p;
        if (tx.category === INVESTMENT_TRANSACTION_CATEGORY.buy) {
          buyCost += amt + fees;
        } else if (tx.category === INVESTMENT_TRANSACTION_CATEGORY.sell) {
          sellProceeds += amt - fees;
        }
      }
      const dayDate = dayTxs[0]!.date;
      pnlEvents.push({
        date: dayDate,
        realizedPnl: sellProceeds - buyCost,
        charges: totalFees,
        isSell: true,
      });
    }

    // Process delivery trades using step-by-step cost basis replay
    let state = createInitialCostBasisState();

    for (const tx of deliveryTxs) {
      const quantity = new Big(String(tx.quantity));
      const price = new Big(String(tx.price));
      const fees = Number(tx.fees || 0);
      const amount = quantity.times(price);

      const leg: CostBasisLeg = {
        category: tx.category,
        quantity,
        amount,
        refAmount: amount,
      };

      const prevRealized = state.realizedGain;
      state = applyCostBasisLeg({ state, leg, method });
      const gainOnLeg = state.realizedGain.minus(prevRealized).toNumber();

      pnlEvents.push({
        date: tx.date,
        realizedPnl: gainOnLeg,
        charges: fees,
        isSell: tx.category === INVESTMENT_TRANSACTION_CATEGORY.sell,
      });
    }
  }

  // Extract all available financial years from trade dates
  const fySet = new Set<string>();
  for (const ev of pnlEvents) {
    if (ev.isSell || ev.charges > 0) {
      fySet.add(getFinancialYear(ev.date));
    }
  }
  const availableFinancialYears = Array.from(fySet).sort().reverse();

  // Determine active period & date range
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let activePeriod = period || financialYear || (availableFinancialYears[0] ?? getFinancialYear(now));
  let isFyMode = false;

  if (financialYear || activePeriod.startsWith('FY')) {
    isFyMode = true;
    const fyRange = getFinancialYearRange(activePeriod);
    if (fyRange) {
      startDate = fyRange.start;
      endDate = fyRange.end;
    } else {
      const defaultFyRange = getFinancialYearRange(getFinancialYear(now))!;
      startDate = defaultFyRange.start;
      endDate = defaultFyRange.end;
      activePeriod = getFinancialYear(now);
    }
  } else if (from && to) {
    startDate = startOfDay(parseISO(from));
    endDate = parseISO(to);
  } else {
    switch (activePeriod) {
      case '1M':
        startDate = subMonths(now, 1);
        endDate = now;
        break;
      case '3M':
        startDate = subMonths(now, 3);
        endDate = now;
        break;
      case '6M':
        startDate = subMonths(now, 6);
        endDate = now;
        break;
      case '1Y':
        if (availableFinancialYears.length > 0) {
          isFyMode = true;
          activePeriod = availableFinancialYears[0]!;
          const fyRange = getFinancialYearRange(activePeriod)!;
          startDate = fyRange.start;
          endDate = fyRange.end;
        } else {
          startDate = subYears(now, 1);
          endDate = now;
        }
        break;
      case '3Y':
        startDate = subYears(now, 3);
        endDate = now;
        break;
      case '5Y':
        startDate = subYears(now, 5);
        endDate = now;
        break;
      case 'All':
      default: {
        if (pnlEvents.length > 0) {
          const earliest = pnlEvents.reduce((min, e) => (isBefore(e.date, min) ? e.date : min), pnlEvents[0]!.date);
          startDate = startOfMonth(earliest);
        } else {
          startDate = subYears(now, 1);
        }
        endDate = now;
        break;
      }
    }
  }

  // Generate monthly buckets
  const months: MonthlyRealizedPnlItem[] = [];

  if (isFyMode) {
    // Exactly 12 months from Apr to Mar of the FY
    const fyStartYear = startDate.getFullYear();
    // Months sequence: Apr (3) to Dec (11) of startYear, then Jan (0) to Mar (2) of startYear + 1
    const fyMonths = [
      { mIndex: 3, year: fyStartYear },
      { mIndex: 4, year: fyStartYear },
      { mIndex: 5, year: fyStartYear },
      { mIndex: 6, year: fyStartYear },
      { mIndex: 7, year: fyStartYear },
      { mIndex: 8, year: fyStartYear },
      { mIndex: 9, year: fyStartYear },
      { mIndex: 10, year: fyStartYear },
      { mIndex: 11, year: fyStartYear },
      { mIndex: 0, year: fyStartYear + 1 },
      { mIndex: 1, year: fyStartYear + 1 },
      { mIndex: 2, year: fyStartYear + 1 },
    ];

    for (const { mIndex, year } of fyMonths) {
      const monthLabel = MONTH_NAMES[mIndex]!;
      const monthNumStr = (mIndex + 1).toString().padStart(2, '0');
      const dateKey = `${year}-${monthNumStr}`;

      // Filter events in this calendar month
      const matchingEvents = pnlEvents.filter((e) => {
        const d = e.date;
        return d.getFullYear() === year && d.getMonth() === mIndex;
      });

      const realizedPnl = matchingEvents.reduce((acc, e) => acc + e.realizedPnl, 0);
      const charges = matchingEvents.reduce((acc, e) => acc + e.charges, 0);
      const tradeCount = matchingEvents.filter((e) => e.isSell).length;

      months.push({
        month: monthLabel,
        year,
        dateKey,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        charges: Math.round(charges * 100) / 100,
        netRealizedPnl: Math.round((realizedPnl - charges) * 100) / 100,
        tradeCount,
      });
    }
  } else {
    // Arbitrary date range: step month by month
    const totalMonths = Math.max(1, differenceInCalendarMonths(endDate, startDate) + 1);
    const startAnchor = startOfMonth(startDate);

    for (let i = 0; i < totalMonths; i++) {
      const monthDate = addMonths(startAnchor, i);
      const year = monthDate.getFullYear();
      const mIndex = monthDate.getMonth();
      const monthLabel = MONTH_NAMES[mIndex]!;
      const monthNumStr = (mIndex + 1).toString().padStart(2, '0');
      const dateKey = `${year}-${monthNumStr}`;

      const matchingEvents = pnlEvents.filter((e) => {
        const d = e.date;
        return d.getFullYear() === year && d.getMonth() === mIndex;
      });

      const realizedPnl = matchingEvents.reduce((acc, e) => acc + e.realizedPnl, 0);
      const charges = matchingEvents.reduce((acc, e) => acc + e.charges, 0);
      const tradeCount = matchingEvents.filter((e) => e.isSell).length;

      months.push({
        month: monthLabel,
        year,
        dateKey,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        charges: Math.round(charges * 100) / 100,
        netRealizedPnl: Math.round((realizedPnl - charges) * 100) / 100,
        tradeCount,
      });
    }
  }

  const totalRealizedPnl = months.reduce((acc, m) => acc + m.realizedPnl, 0);
  const totalCharges = months.reduce((acc, m) => acc + m.charges, 0);

  return {
    portfolioId,
    portfolioName: portfolio.name,
    currencyCode,
    totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100,
    netRealizedPnl: Math.round((totalRealizedPnl - totalCharges) * 100) / 100,
    period: activePeriod,
    availableFinancialYears,
    months,
  };
};
