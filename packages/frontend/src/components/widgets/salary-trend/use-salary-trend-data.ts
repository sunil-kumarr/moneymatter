import { getPivotReport } from '@/api/stats';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { useRootStore } from '@/stores';
import type { endpointsTypes } from '@bt/shared/types';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { computed, type Ref } from 'vue';

export type SalaryTrendGranularity = Extract<endpointsTypes.PivotGranularity, 'monthly' | 'yearly'>;

export interface SalaryTrendBar {
  key: string;
  label: string;
  value: number;
}

export function useSalaryTrendData({
  selectedPeriod,
  categoryId,
  granularity,
}: {
  selectedPeriod: () => { from: Date; to: Date };
  categoryId: Ref<string | null>;
  granularity: Ref<SalaryTrendGranularity>;
}) {
  const { isAppInitialized } = storeToRefs(useRootStore());

  const periodQueryKey = computed(() => `${selectedPeriod().from.getTime()}-${selectedPeriod().to.getTime()}`);
  const isEnabled = computed(() => isAppInitialized.value && !!categoryId.value);

  const { data, isFetching } = useQuery({
    queryKey: computed(() => [
      ...VUE_QUERY_CACHE_KEYS.widgetSalaryTrend,
      periodQueryKey.value,
      categoryId.value,
      granularity.value,
    ]),
    queryFn: () =>
      getPivotReport({
        from: selectedPeriod().from,
        to: selectedPeriod().to,
        granularity: granularity.value,
        rowDimension: 'category',
        measure: 'income',
        categoryIds: categoryId.value ? [categoryId.value] : undefined,
      }),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
    enabled: isEnabled,
  });

  const bars = computed<SalaryTrendBar[]>(() => {
    const report = data.value;
    if (!report) return [];
    return report.columns.map((column) => ({
      key: column.key,
      label: column.label,
      value: report.columnTotals[column.key] ?? 0,
    }));
  });

  const total = computed(() => bars.value.reduce((sum, bar) => sum + bar.value, 0));
  const hasData = computed(() => bars.value.some((bar) => bar.value !== 0));
  const isInitialLoading = computed(() => isFetching.value && !data.value);
  const currencyCode = computed(() => data.value?.currencyCode);

  return { bars, total, hasData, isFetching, isInitialLoading, currencyCode };
}
