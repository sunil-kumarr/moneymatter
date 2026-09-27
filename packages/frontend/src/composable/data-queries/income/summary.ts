import { getIncomeSourceSummary } from '@/api/income/sources';
import { QUERY_CACHE_STALE_TIME, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, computed, toValue } from 'vue';

export const useIncomeSourceSummary = (
  sourceId: MaybeRefOrGetter<string>,
  params?: MaybeRefOrGetter<{ sourceIds?: string[] } | undefined>,
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
      ...VUE_QUERY_CACHE_KEYS.incomeSourceSummary,
      resolvedParams.value.sourceId,
      resolvedParams.value.sourceIds?.slice().sort().join(','),
    ]),
    queryFn: () => getIncomeSourceSummary(resolvedParams.value),
    enabled: computed(() => {
      const id = toValue(sourceId);
      return typeof id === 'string' && id.length > 0;
    }),
    staleTime: QUERY_CACHE_STALE_TIME.ANALYTICS,
    placeholderData: keepPreviousData,
  });
};
