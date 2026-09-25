import { FIXED_INCOME_EVENT_TYPE } from '@bt/shared/types/investments';
import FixedIncomeEvents from '@models/investments/fixed-income-events.model';
import FixedIncomePositions from '@models/investments/fixed-income-positions.model';

/**
 * Cost basis is the amount actually invested: the `initial_investment`
 * event's recorded amount when one exists, falling back to the position's
 * snapshot `principal` for positions created before that event was recorded.
 */
export function computeCostBasis({
  position,
  events,
}: {
  position: FixedIncomePositions;
  events: readonly FixedIncomeEvents[];
}): string {
  const initial = events.find((event) => event.type === FIXED_INCOME_EVENT_TYPE.initial_investment);
  const amount = initial?.grossAmount ?? initial?.principalComponent;

  return amount?.toDecimalString(10) ?? position.principal.toDecimalString(10);
}
