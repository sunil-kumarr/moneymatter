import { FIXED_INCOME_EVENT_TYPE } from '@bt/shared/types/investments';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';
import { computeAccruedInterest } from '@services/investments/fixed-income/metrics/compute-accrued-interest';
import { computeCostBasis } from '@services/investments/fixed-income/metrics/compute-cost-basis';

/**
 * Daily current value and cumulative cost basis of a user's fixed-income
 * positions (fixed deposits, bonds, peer loans), so the investments dashboard
 * chart doesn't undercount portfolios that hold them alongside tradeable
 * securities. Mirrors `net-invested-replay.ts` / `holdings-replay.ts`'s
 * per-date walk-forward shape so the three slices combine the same way.
 *
 * Reuses `computeAccruedInterest` (the same function `getFixedIncomePositionValues`
 * uses for the live position-detail view) instead of re-deriving the accrual
 * math, at the cost of recomputing each position's ledger once per chart date
 * rather than walking it forward incrementally — negligible given the small
 * event counts and history lengths this chart deals with.
 */
export const computeFixedIncomeByDate = ({
  positions,
  uniqueDates,
  getExchangeRate,
}: {
  positions: FixedIncomePositions[];
  uniqueDates: string[];
  getExchangeRate: (currencyCode: string, dateStr: string) => number;
}): { currentValueByDate: Map<string, number>; investedValueByDate: Map<string, number> } => {
  const currentValueByDate = new Map<string, number>();
  const investedValueByDate = new Map<string, number>();
  if (uniqueDates.length === 0 || positions.length === 0) return { currentValueByDate, investedValueByDate };

  // Cost basis is recognized on the initial_investment event's date.
  // When principal repayments (partial, full, maturity) occur, returned cash
  // is subtracted so invested capital in this position accurately tracks remaining principal.
  const investedDeltaByDate = new Map<string, number>();
  for (const position of positions) {
    const events = position.events ?? [];
    const initial = events.find((event) => event.type === FIXED_INCOME_EVENT_TYPE.initial_investment);
    const eventDate = initial?.eventDate ?? position.startDate;
    const costBasis =
      Number(computeCostBasis({ position, events })) * getExchangeRate(position.currencyCode, eventDate);
    investedDeltaByDate.set(eventDate, (investedDeltaByDate.get(eventDate) ?? 0) + costBasis);

    for (const event of events) {
      if (
        event.type === FIXED_INCOME_EVENT_TYPE.partial_repayment ||
        event.type === FIXED_INCOME_EVENT_TYPE.full_repayment ||
        event.type === FIXED_INCOME_EVENT_TYPE.maturity
      ) {
        const returnedAmount = Number(
          event.principalReturnedThisEvent ?? event.principalComponent?.toDecimalString(10) ?? '0',
        );
        if (returnedAmount > 0) {
          const reduction = returnedAmount * getExchangeRate(position.currencyCode, event.eventDate);
          investedDeltaByDate.set(event.eventDate, (investedDeltaByDate.get(event.eventDate) ?? 0) - reduction);
        }
      }
    }
  }

  const firstDate = uniqueDates[0]!;
  let investedRunning = 0;
  for (const [dateStr, delta] of investedDeltaByDate) {
    if (dateStr < firstDate) investedRunning += delta;
  }

  for (const dateStr of uniqueDates) {
    const delta = investedDeltaByDate.get(dateStr);
    if (delta) investedRunning += delta;
    investedValueByDate.set(dateStr, Math.max(0, investedRunning));

    let currentTotal = 0;
    for (const position of positions) {
      if (position.startDate > dateStr) continue;

      // Only events recorded on or before this chart date may affect its value —
      // `computeAccruedInterest` has no date filter of its own, so a later repayment
      // would otherwise retroactively zero out an earlier day's balance.
      const eventsToDate = (position.events ?? []).filter((event) => event.eventDate <= dateStr);

      const { principalOutstanding, accruedUnpaidInterest } = computeAccruedInterest({
        principal: position.principal.toDecimalString(10),
        interestRatePct: position.interestRatePct,
        compoundingFrequency: position.compoundingFrequency,
        dayCountConvention: position.dayCountConvention,
        startDate: position.startDate,
        events: eventsToDate,
        asOfDate: new Date(`${dateStr}T00:00:00.000Z`),
      });

      const positionValue = Number(principalOutstanding) + Number(accruedUnpaidInterest);
      if (positionValue !== 0) {
        currentTotal += positionValue * getExchangeRate(position.currencyCode, dateStr);
      }
    }
    currentValueByDate.set(dateStr, currentTotal);
  }

  return { currentValueByDate, investedValueByDate };
};
