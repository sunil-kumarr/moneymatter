import {
  ASSET_CLASS,
  COST_BASIS_METHOD,
  FIXED_INCOME_EVENT_TYPE,
  FIXED_INCOME_POSITION_STATUS,
  INVESTMENT_TRADE_TYPE,
  INVESTMENT_TRANSACTION_CATEGORY,
} from '@bt/shared/types/investments';
import type {
  MonthlyRealizedPnlItem,
  PortfolioRealizedPnlResponse,
} from '@bt/shared/types/investments/portfolio-realized-pnl.model';
import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import InvestmentTransaction from '@models/investments/investment-transaction.model';
import Portfolios from '@models/investments/portfolios.model';
import Securities from '@models/investments/securities.model';
import * as UsersCurrencies from '@models/users-currencies.model';
import { getFinancialYear, getFinancialYearRange } from '@services/common/financial-year';
import * as userExchangeRateService from '@services/user-exchange-rate';
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

import { computeAccruedInterest } from '../fixed-income/metrics/compute-accrued-interest';
import { applyCostBasisLeg, createInitialCostBasisState, type CostBasisLeg } from '../holdings/cost-basis-replay';
import { getHoldingValues } from '../holdings/get-holding-values.service';

interface GetPortfolioRealizedPnlParams {
  userId: number;
  portfolioId?: string;
  portfolioIds?: string[];
  from?: string;
  to?: string;
  period?: string;
  financialYear?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// Re-exported for callers that historically imported the FY helpers from this module.
export { getFinancialYear, getFinancialYearRange };

export const getPortfolioRealizedPnl = async ({
  userId,
  portfolioId,
  portfolioIds,
  from,
  to,
  period,
  financialYear,
}: GetPortfolioRealizedPnlParams): Promise<PortfolioRealizedPnlResponse> => {
  const userCurrency = await findOrThrowNotFound({
    query: UsersCurrencies.getCurrency({
      userId,
      isDefaultCurrency: true,
    }),
    message: t({ key: 'investments.userBaseCurrencyNotFound' }),
  });

  const baseCurrencyCode = userCurrency.currency.code;

  let portfolios: Portfolios[] = [];
  let portfolioName = '';
  let currencyCode = baseCurrencyCode;

  const isAll = !portfolioId || portfolioId === 'all';
  if (isAll) {
    if (portfolioIds && portfolioIds.length > 0) {
      portfolios = await Portfolios.findAll({
        where: { id: { [Op.in]: portfolioIds }, userId, isEnabled: true },
      });
      portfolioName = portfolios.length === 1 ? portfolios[0]!.name : `${portfolios.length} Portfolios`;
      currencyCode =
        portfolios.length === 1 ? portfolios[0]!.displayCurrencyCode || baseCurrencyCode : baseCurrencyCode;
    } else {
      portfolios = await Portfolios.findAll({
        where: { userId, isEnabled: true },
      });
      portfolioName = 'All Portfolios';
      currencyCode = baseCurrencyCode;
    }
  } else {
    const singlePortfolio = await findOrThrowNotFound({
      query: Portfolios.findOne({
        where: { id: portfolioId, userId },
      }),
      message: t({ key: 'investments.portfolioNotFound' }),
    });
    portfolios = [singlePortfolio];
    portfolioName = singlePortfolio.name;
    currencyCode = singlePortfolio.displayCurrencyCode || baseCurrencyCode;
  }

  const targetPortfolioIds = portfolios.map((p) => p.id);
  const conversionDate = new Date();

  // Exchange rate cache
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

  interface PnlEvent {
    date: Date;
    realizedPnl: number;
    charges: number;
    isSell: boolean;
  }

  const pnlEvents: PnlEvent[] = [];

  // 1. Process Stocks & Mutual Funds trades across portfolios
  for (const p of portfolios) {
    const pCurrency = p.displayCurrencyCode || baseCurrencyCode;
    const transactions = await InvestmentTransaction.findAll({
      where: {
        portfolioId: p.id,
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

    const txBySecurity = new Map<string, InvestmentTransaction[]>();
    for (const tx of transactions) {
      const list = txBySecurity.get(tx.securityId) ?? [];
      list.push(tx);
      txBySecurity.set(tx.securityId, list);
    }

    for (const [, txs] of txBySecurity.entries()) {
      const firstTx = txs[0]!;
      const isMutualFund = firstTx.security?.assetClass === ASSET_CLASS.mutual_fund;
      const method =
        isMutualFund && p.costBasisMethod === COST_BASIS_METHOD.fifo
          ? COST_BASIS_METHOD.fifo
          : COST_BASIS_METHOD.weighted_average;

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

      for (const [, dayTxs] of intradayTxsByDay.entries()) {
        let buyCost = 0;
        let sellProceeds = 0;
        let totalFees = 0;
        for (const tx of dayTxs) {
          const q = Number(tx.quantity);
          const pPrice = Number(tx.price);
          const fees = Number(tx.fees || 0);
          totalFees += fees;
          const amt = q * pPrice;
          if (tx.category === INVESTMENT_TRANSACTION_CATEGORY.buy) {
            buyCost += amt + fees;
          } else if (tx.category === INVESTMENT_TRANSACTION_CATEGORY.sell) {
            sellProceeds += amt - fees;
          }
        }
        const dayDate = dayTxs[0]!.date;
        const netPnl = sellProceeds - buyCost;
        const convPnl = await toTargetCurrency(netPnl, pCurrency);
        const convFees = await toTargetCurrency(totalFees, pCurrency);
        pnlEvents.push({
          date: dayDate,
          realizedPnl: convPnl,
          charges: convFees,
          isSell: true,
        });
      }

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

        const isSell = tx.category === INVESTMENT_TRANSACTION_CATEGORY.sell;
        const convGain = isSell ? await toTargetCurrency(gainOnLeg, pCurrency) : 0;
        const convFees = await toTargetCurrency(fees, pCurrency);

        pnlEvents.push({
          date: tx.date,
          realizedPnl: convGain,
          charges: convFees,
          isSell,
        });
      }
    }
  }

  // 2. Open stock holdings unrealized PnL (for current month)
  let currentOpenStocksUnrealizedGain = 0;
  for (const p of portfolios) {
    try {
      const holdings = await getHoldingValues({ portfolioId: p.id, userId, date: conversionDate });
      for (const h of holdings) {
        const unGain = Number(h.unrealizedGainValue || 0);
        const conv = await toTargetCurrency(unGain, h.currencyCode || p.displayCurrencyCode || baseCurrencyCode);
        currentOpenStocksUnrealizedGain += conv;
      }
    } catch {
      // Empty portfolio or holding calculation skip
    }
  }

  // 3. Process Fixed Income (FDs) across portfolios
  let currentAccruedFdUnrealizedInterest = 0;
  const futureFdEvents: { date: Date; unrealizedPnl: number }[] = [];

  const fixedPositions = await FixedIncomePositions.findAll({
    where: {
      portfolioId: { [Op.in]: targetPortfolioIds },
      userId,
    },
    include: [{ model: FixedIncomeEvents, as: 'events' }],
  });

  for (const pos of fixedPositions) {
    const events = pos.events ?? [];
    const posCurrency = pos.currencyCode || currencyCode;

    // Past realized events on FD
    for (const ev of events) {
      const evDate = new Date(`${ev.eventDate}T00:00:00.000Z`);
      if (ev.type === FIXED_INCOME_EVENT_TYPE.interest_accrual_payout) {
        const interest = Number(ev.interestComponent?.toDecimalString(10) ?? ev.grossAmount?.toDecimalString(10) ?? 0);
        const tax = Number(ev.taxWithheld?.toDecimalString(10) ?? 0);
        if (interest > 0) {
          const convInterest = await toTargetCurrency(interest, posCurrency);
          const convTax = await toTargetCurrency(tax, posCurrency);
          pnlEvents.push({
            date: evDate,
            realizedPnl: convInterest,
            charges: convTax,
            isSell: true,
          });
        }
      } else if (
        ev.type === FIXED_INCOME_EVENT_TYPE.maturity ||
        ev.type === FIXED_INCOME_EVENT_TYPE.full_repayment ||
        ev.type === FIXED_INCOME_EVENT_TYPE.partial_repayment
      ) {
        let interest = 0;
        if (ev.interestComponent) {
          interest = Number(ev.interestComponent.toDecimalString(10));
        } else if (ev.grossAmount && ev.principalComponent) {
          interest = Math.max(0, Number(ev.grossAmount.subtract(ev.principalComponent).toDecimalString(10)));
        }
        const tax = Number(ev.taxWithheld?.toDecimalString(10) ?? 0);
        if (interest > 0) {
          const convInterest = await toTargetCurrency(interest, posCurrency);
          const convTax = await toTargetCurrency(tax, posCurrency);
          pnlEvents.push({
            date: evDate,
            realizedPnl: convInterest,
            charges: convTax,
            isSell: true,
          });
        }
      } else if (ev.type === FIXED_INCOME_EVENT_TYPE.fee) {
        const fee = Number(ev.grossAmount?.toDecimalString(10) ?? 0);
        if (fee > 0) {
          const convFee = await toTargetCurrency(fee, posCurrency);
          pnlEvents.push({
            date: evDate,
            realizedPnl: 0,
            charges: convFee,
            isSell: false,
          });
        }
      }
    }

    // Active FD accrued interest & future maturity projection
    if (pos.status === FIXED_INCOME_POSITION_STATUS.active) {
      const currentAccrual = computeAccruedInterest({
        principal: pos.principal.toDecimalString(10),
        interestRatePct: pos.interestRatePct,
        compoundingFrequency: pos.compoundingFrequency,
        dayCountConvention: pos.dayCountConvention,
        startDate: pos.startDate,
        events,
        asOfDate: conversionDate,
      });

      const currentUnpaid = Number(currentAccrual.accruedUnpaidInterest);
      if (currentUnpaid > 0) {
        currentAccruedFdUnrealizedInterest += await toTargetCurrency(currentUnpaid, posCurrency);
      }

      if (pos.expectedEndDate) {
        const matDate = new Date(`${pos.expectedEndDate}T00:00:00.000Z`);
        if (isAfter(matDate, conversionDate)) {
          const maturityAccrual = computeAccruedInterest({
            principal: pos.principal.toDecimalString(10),
            interestRatePct: pos.interestRatePct,
            compoundingFrequency: pos.compoundingFrequency,
            dayCountConvention: pos.dayCountConvention,
            startDate: pos.startDate,
            events,
            asOfDate: matDate,
          });

          const expectedTotal = new Big(maturityAccrual.totalInterestReceived).plus(
            maturityAccrual.accruedUnpaidInterest,
          );
          const alreadyAccounted = new Big(currentAccrual.totalInterestReceived).plus(
            currentAccrual.accruedUnpaidInterest,
          );
          const futureRemaining = expectedTotal.minus(alreadyAccounted);
          if (futureRemaining.gt(0)) {
            const convFuture = await toTargetCurrency(futureRemaining.toNumber(), posCurrency);
            futureFdEvents.push({
              date: matDate,
              unrealizedPnl: convFuture,
            });
          }
        }
      }
    }
  }

  // Extract all available financial years from trade dates and future FD dates
  const fySet = new Set<string>();
  for (const ev of pnlEvents) {
    if (ev.isSell || ev.charges > 0) {
      fySet.add(getFinancialYear(ev.date));
    }
  }
  for (const fEv of futureFdEvents) {
    fySet.add(getFinancialYear(fEv.date));
  }
  const availableFinancialYears = Array.from(fySet).toSorted().toReversed();

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
  const currentMonthKey = format(now, 'yyyy-MM');

  if (isFyMode) {
    const fyStartYear = startDate.getFullYear();
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

      const matchingEvents = pnlEvents.filter((e) => {
        const d = e.date;
        return d.getFullYear() === year && d.getMonth() === mIndex;
      });

      const realizedPnl = matchingEvents.reduce((acc, e) => acc + e.realizedPnl, 0);
      const charges = matchingEvents.reduce((acc, e) => acc + e.charges, 0);
      const tradeCount = matchingEvents.filter((e) => e.isSell).length;

      const isCurrent = dateKey === currentMonthKey;
      const isFuture = dateKey > currentMonthKey;

      let unrealizedPnl = 0;
      if (isCurrent) {
        unrealizedPnl = currentOpenStocksUnrealizedGain + currentAccruedFdUnrealizedInterest;
      } else if (isFuture) {
        const matchingFuture = futureFdEvents.filter((e) => {
          const d = e.date;
          return d.getFullYear() === year && d.getMonth() === mIndex;
        });
        unrealizedPnl = matchingFuture.reduce((acc, e) => acc + e.unrealizedPnl, 0);
      }

      months.push({
        month: monthLabel,
        year,
        dateKey,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        charges: Math.round(charges * 100) / 100,
        netRealizedPnl: Math.round((realizedPnl - charges) * 100) / 100,
        tradeCount,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        isFuture,
        isCurrent,
      });
    }
  } else {
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

      const isCurrent = dateKey === currentMonthKey;
      const isFuture = dateKey > currentMonthKey;

      let unrealizedPnl = 0;
      if (isCurrent) {
        unrealizedPnl = currentOpenStocksUnrealizedGain + currentAccruedFdUnrealizedInterest;
      } else if (isFuture) {
        const matchingFuture = futureFdEvents.filter((e) => {
          const d = e.date;
          return d.getFullYear() === year && d.getMonth() === mIndex;
        });
        unrealizedPnl = matchingFuture.reduce((acc, e) => acc + e.unrealizedPnl, 0);
      }

      months.push({
        month: monthLabel,
        year,
        dateKey,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        charges: Math.round(charges * 100) / 100,
        netRealizedPnl: Math.round((realizedPnl - charges) * 100) / 100,
        tradeCount,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        isFuture,
        isCurrent,
      });
    }
  }

  const totalRealizedPnl = months.reduce((acc, m) => acc + m.realizedPnl, 0);
  const totalCharges = months.reduce((acc, m) => acc + m.charges, 0);
  const totalUnrealizedPnl = months.reduce((acc, m) => acc + (m.unrealizedPnl ?? 0), 0);

  return {
    portfolioId: portfolioId || 'all',
    portfolioName,
    currencyCode,
    totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100,
    netRealizedPnl: Math.round((totalRealizedPnl - totalCharges) * 100) / 100,
    totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
    period: activePeriod,
    availableFinancialYears,
    months,
  };
};
