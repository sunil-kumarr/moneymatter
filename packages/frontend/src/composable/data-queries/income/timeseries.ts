import { type GetIncomeTimeseriesParams, getIncomeTimeseries } from '@/api/income/sources';
import { QUERY_CACHE_STALE_TIME, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, computed, toValue } from 'vue';

export const useIncomeTimeseries = (
  sourceId: MaybeRefOrGetter<string>,
  params?: MaybeRefOrGetter<Omit<GetIncomeTimeseriesParams, 'sourceId'> | undefined>,
) => {
  const resolvedParams = computed(() => {
    const extra = params ? toValue(params) : undefined;
    return {
      sourceId: toValue(sourceId),
      ...extra,
    };
  });

  return useQuery({
    queryKey: computed(() => [
      ...VUE_QUERY_CACHE_KEYS.incomeSourceTimeseries,
      resolvedParams.value.sourceId,
      resolvedParams.value.sourceIds?.slice().sort().join(','),
      resolvedParams.value.period,
      resolvedParams.value.financialYear,
      resolvedParams.value.from,
      resolvedParams.value.to,
    ]),
    queryFn: () => getIncomeTimeseries(resolvedParams.value),
    enabled: computed(() => {
      const id = toValue(sourceId);
      return typeof id === 'string' && id.length > 0;
    }),
    staleTime: QUERY_CACHE_STALE_TIME.ANALYTICS,
    placeholderData: keepPreviousData,
  });
};
