import type { LoanApi } from '@/api/loans';
import { addMonths, differenceInCalendarMonths, isAfter, isBefore, parseISO, startOfMonth } from 'date-fns';

import { roundHalfToEven } from './payoff-schedule';
import { computeMinimumPaymentFromTerm } from './payoff-schedule';

export interface LoanAmortizationPoint {
  /** 0-indexed month from timeline start */
  month: number;
  /** Exact date for this month */
  date: Date;
  /** Remaining loan balance (principal still owed), decimal */
  remainingPrincipal: number;
  /** Cumulative interest accrued up to this point, decimal */
  cumulativeInterest: number;
  /** Cumulative principal repaid up to this point, decimal */
  cumulativePrincipal: number;
  /** Monthly payment amount for this month, decimal */
  monthlyPayment: number;
  /** Principal portion of the monthly payment, decimal */
  monthlyPrincipal: number;
  /** Interest portion of the monthly payment, decimal */
  monthlyInterest: number;
}

export interface LoanAmortizationSummary {
  /** Original/Total principal borrowing amount */
  totalPrincipal: number;
  /** Total projected or lifetime interest */
  totalInterest: number;
  /** Total cost = totalPrincipal + totalInterest */
  totalCost: number;
  /** Current remaining principal balance */
  currentBalance: number;
  /** Monthly payment amount */
  monthlyPayment: number;
  /** Payoff date */
  payoffDate: Date;
  /** Date when monthly principal exceeds monthly interest */
  paymentCrossoverDate: Date | null;
  /** Date when cumulative interest paid exceeds remaining balance */
  balanceCrossoverDate: Date | null;
  /** The points series */
  points: LoanAmortizationPoint[];
}

const MAX_PROJECTION_MONTHS = 1200;
const MONTHS_PER_YEAR = 12;

type ConvertFn = (params: { amount: number; from: string; to: string }) => number | null;

/**
 * Computes month-by-month amortization schedule for a single loan, starting from its
 * origination date through payoff.
 */
export function computeLoanAmortizationSeries({
  originalPrincipal,
  interestRate,
  startDate,
  termMonths,
  plannedPayment,
  minPayment,
  currentBalance,
}: {
  originalPrincipal: number;
  interestRate: number;
  startDate: Date | string;
  termMonths?: number | null;
  plannedPayment?: number | null;
  minPayment?: number | null;
  currentBalance?: number | null;
}): LoanAmortizationSummary {
  const parsedStartDate = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const validStartDate = isNaN(parsedStartDate.getTime()) ? new Date() : parsedStartDate;

  if (originalPrincipal <= 0) {
    return {
      totalPrincipal: 0,
      totalInterest: 0,
      totalCost: 0,
      currentBalance: 0,
      monthlyPayment: 0,
      payoffDate: validStartDate,
      paymentCrossoverDate: null,
      balanceCrossoverDate: null,
      points: [],
    };
  }

  // Determine monthly payment
  let payment = 0;
  if (plannedPayment != null && plannedPayment > 0) {
    payment = plannedPayment;
  } else if (minPayment != null && minPayment > 0) {
    payment = minPayment;
  } else if (termMonths != null && termMonths > 0) {
    payment = computeMinimumPaymentFromTerm({ principal: originalPrincipal, interestRate, termMonths }) ?? 0;
  }

  const minMonthlyInterest = (originalPrincipal * (interestRate / 100)) / MONTHS_PER_YEAR;

  // If payment cannot amortize the loan, fallback to contractual term payment or standard 30y term
  if (payment <= minMonthlyInterest) {
    const fallbackTerm = termMonths && termMonths > 0 ? termMonths : 360;
    payment =
      computeMinimumPaymentFromTerm({ principal: originalPrincipal, interestRate, termMonths: fallbackTerm }) ??
      Math.max(1, minMonthlyInterest * 1.15);
  }

  const balanceCentsInitial = Math.round(originalPrincipal * 100);
  const paymentCents = Math.round(payment * 100);

  const points: LoanAmortizationPoint[] = [
    {
      month: 0,
      date: validStartDate,
      remainingPrincipal: originalPrincipal,
      cumulativeInterest: 0,
      cumulativePrincipal: 0,
      monthlyPayment: 0,
      monthlyPrincipal: 0,
      monthlyInterest: 0,
    },
  ];

  let runningBalanceCents = balanceCentsInitial;
  let totalInterestCents = 0;
  let totalPrincipalPaidCents = 0;
  let paymentCrossoverDate: Date | null = null;
  let balanceCrossoverDate: Date | null = null;

  for (let month = 1; month <= MAX_PROJECTION_MONTHS; month++) {
    const date = addMonths(validStartDate, month);
    const monthlyInterestCents = roundHalfToEven((runningBalanceCents * interestRate) / 100 / MONTHS_PER_YEAR);

    let actualPaymentCents: number;
    let monthlyPrincipalCents: number;

    if (runningBalanceCents + monthlyInterestCents <= paymentCents) {
      // Final payoff payment
      actualPaymentCents = runningBalanceCents + monthlyInterestCents;
      monthlyPrincipalCents = runningBalanceCents;
      runningBalanceCents = 0;
    } else {
      actualPaymentCents = paymentCents;
      monthlyPrincipalCents = Math.max(0, paymentCents - monthlyInterestCents);
      runningBalanceCents = Math.max(0, runningBalanceCents - monthlyPrincipalCents);
    }

    totalInterestCents += monthlyInterestCents;
    totalPrincipalPaidCents += monthlyPrincipalCents;

    if (!paymentCrossoverDate && monthlyPrincipalCents >= monthlyInterestCents) {
      paymentCrossoverDate = date;
    }

    const remainingDecimal = runningBalanceCents / 100;
    const cumInterestDecimal = totalInterestCents / 100;

    if (!balanceCrossoverDate && cumInterestDecimal >= remainingDecimal) {
      balanceCrossoverDate = date;
    }

    points.push({
      month,
      date,
      remainingPrincipal: remainingDecimal,
      cumulativeInterest: cumInterestDecimal,
      cumulativePrincipal: totalPrincipalPaidCents / 100,
      monthlyPayment: actualPaymentCents / 100,
      monthlyPrincipal: monthlyPrincipalCents / 100,
      monthlyInterest: monthlyInterestCents / 100,
    });

    if (runningBalanceCents === 0) {
      break;
    }
  }

  const finalPoint = points[points.length - 1];
  const totalInterest = totalInterestCents / 100;

  return {
    totalPrincipal: originalPrincipal,
    totalInterest,
    totalCost: originalPrincipal + totalInterest,
    currentBalance: currentBalance != null ? Math.abs(currentBalance) : originalPrincipal,
    monthlyPayment: payment,
    payoffDate: finalPoint ? finalPoint.date : validStartDate,
    paymentCrossoverDate,
    balanceCrossoverDate,
    points,
  };
}

/**
 * Computes an aggregated amortization schedule across multiple loans.
 * If live FX conversion is provided, amounts are converted to baseCode.
 */
export function computeAggregateLoanAmortizationSeries({
  loans,
  convert,
  baseCode,
}: {
  loans: LoanApi[];
  convert?: ConvertFn;
  baseCode?: string | null;
}): LoanAmortizationSummary {
  if (!loans.length) {
    const today = new Date();
    return {
      totalPrincipal: 0,
      totalInterest: 0,
      totalCost: 0,
      currentBalance: 0,
      monthlyPayment: 0,
      payoffDate: today,
      paymentCrossoverDate: null,
      balanceCrossoverDate: null,
      points: [],
    };
  }

  if (loans.length === 1) {
    const loan = loans[0]!;
    return computeLoanAmortizationSeries({
      originalPrincipal: loan.loanDetails.originalPrincipal,
      interestRate: loan.loanDetails.interestRate,
      startDate: loan.loanDetails.startDate,
      termMonths: loan.loanDetails.termMonths,
      plannedPayment: loan.loanDetails.plannedPayment,
      minPayment: loan.loanDetails.minPayment,
      currentBalance: loan.currentBalance,
    });
  }

  // Precompute single schedules and FX conversions
  const summaries = loans.map((loan) => {
    const single = computeLoanAmortizationSeries({
      originalPrincipal: loan.loanDetails.originalPrincipal,
      interestRate: loan.loanDetails.interestRate,
      startDate: loan.loanDetails.startDate,
      termMonths: loan.loanDetails.termMonths,
      plannedPayment: loan.loanDetails.plannedPayment,
      minPayment: loan.loanDetails.minPayment,
      currentBalance: loan.currentBalance,
    });

    const rate =
      convert && baseCode && loan.currencyCode !== baseCode
        ? (convert({ amount: 1, from: loan.currencyCode, to: baseCode }) ?? 1)
        : 1;

    return {
      loan,
      rate,
      summary: single,
    };
  });

  // Find min start date and max payoff date across loans
  let minStart = summaries[0]!.summary.points[0]?.date ?? new Date();
  let maxPayoff = summaries[0]!.summary.payoffDate;

  for (const { summary } of summaries) {
    const start = summary.points[0]?.date;
    if (start && isBefore(start, minStart)) {
      minStart = start;
    }
    if (isAfter(summary.payoffDate, maxPayoff)) {
      maxPayoff = summary.payoffDate;
    }
  }

  const startAnchor = startOfMonth(minStart);
  const totalMonths = Math.max(1, differenceInCalendarMonths(maxPayoff, startAnchor));

  const aggregatePoints: LoanAmortizationPoint[] = [];
  let paymentCrossoverDate: Date | null = null;
  let balanceCrossoverDate: Date | null = null;

  for (let month = 0; month <= totalMonths; month++) {
    const monthDate = addMonths(startAnchor, month);
    let remainingPrincipal = 0;
    let cumulativeInterest = 0;
    let cumulativePrincipal = 0;
    let monthlyPayment = 0;
    let monthlyPrincipal = 0;
    let monthlyInterest = 0;

    for (const { rate, summary } of summaries) {
      const loanStart = summary.points[0]?.date;
      if (!loanStart) continue;

      if (isBefore(monthDate, startOfMonth(loanStart))) {
        // Loan has not started yet; add full original principal
        remainingPrincipal += summary.totalPrincipal * rate;
      } else {
        const offset = differenceInCalendarMonths(monthDate, startOfMonth(loanStart));
        const point =
          offset >= summary.points.length
            ? summary.points[summary.points.length - 1]
            : (summary.points[offset] ?? summary.points[summary.points.length - 1]);

        if (point) {
          remainingPrincipal += point.remainingPrincipal * rate;
          cumulativeInterest += point.cumulativeInterest * rate;
          cumulativePrincipal += point.cumulativePrincipal * rate;
          if (offset < summary.points.length && offset > 0) {
            monthlyPayment += point.monthlyPayment * rate;
            monthlyPrincipal += point.monthlyPrincipal * rate;
            monthlyInterest += point.monthlyInterest * rate;
          }
        }
      }
    }

    if (!paymentCrossoverDate && month > 0 && monthlyPrincipal >= monthlyInterest && monthlyPayment > 0) {
      paymentCrossoverDate = monthDate;
    }

    if (!balanceCrossoverDate && cumulativeInterest >= remainingPrincipal) {
      balanceCrossoverDate = monthDate;
    }

    aggregatePoints.push({
      month,
      date: monthDate,
      remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
      cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
      cumulativePrincipal: Math.round(cumulativePrincipal * 100) / 100,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      monthlyPrincipal: Math.round(monthlyPrincipal * 100) / 100,
      monthlyInterest: Math.round(monthlyInterest * 100) / 100,
    });
  }

  const totalPrincipal = summaries.reduce((acc, s) => acc + s.summary.totalPrincipal * s.rate, 0);
  const totalInterest = summaries.reduce((acc, s) => acc + s.summary.totalInterest * s.rate, 0);
  const currentBalance = summaries.reduce((acc, s) => acc + s.summary.currentBalance * s.rate, 0);
  const monthlyPayment = summaries.reduce((acc, s) => acc + s.summary.monthlyPayment * s.rate, 0);

  return {
    totalPrincipal: Math.round(totalPrincipal * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalCost: Math.round((totalPrincipal + totalInterest) * 100) / 100,
    currentBalance: Math.round(currentBalance * 100) / 100,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    payoffDate: maxPayoff,
    paymentCrossoverDate,
    balanceCrossoverDate,
    points: aggregatePoints,
  };
}
