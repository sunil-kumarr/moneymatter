import type { MonthlyIncomeItem } from '@bt/shared/types/income';

export type IncomeChartViewMode = 'monthly' | 'cumulative';

export interface IncomeChartPoint {
  dateKey: string;
  month: string;
  year: number;
  value: number;
  isCurrent: boolean;
  isFuture: boolean;
}

/** Picks the series to plot for the active view — net-per-month bars, or the running cumulativeNet line. */
export function getIncomeChartSeries({
  months,
  viewMode,
}: {
  months: MonthlyIncomeItem[];
  viewMode: IncomeChartViewMode;
}): IncomeChartPoint[] {
  return months.map((m) => ({
    dateKey: m.dateKey,
    month: m.month,
    year: m.year,
    value: viewMode === 'monthly' ? m.net : m.cumulativeNet,
    isCurrent: !!m.isCurrent,
    isFuture: !!m.isFuture,
  }));
}

/** Padded [min, max] y-domain for a set of chart values, always including zero. */
export function computeIncomeYDomain(values: number[]): [number, number] {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);

  if (max === 0 && min === 0) return [0, 100];
  if (min === 0) return [0, max * 1.15];
  if (max === 0) return [min * 1.15, 0];

  const padMin = Math.abs(min) * 0.15;
  const padMax = Math.abs(max) * 0.15;
  return [min - padMin, max + padMax];
}
