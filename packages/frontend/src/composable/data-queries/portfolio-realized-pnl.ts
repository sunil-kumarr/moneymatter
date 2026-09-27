import { getPortfolioRealizedPnl, type GetPortfolioRealizedPnlParams } from '@/api/portfolios';
import { QUERY_CACHE_STALE_TIME, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, computed, toValue } from 'vue';

export const usePortfolioRealizedPnl = (
  portfolioId: MaybeRefOrGetter<string>,
  params?: MaybeRefOrGetter<Omit<GetPortfolioRealizedPnlParams, 'portfolioId'> | undefined>,
) => {
  const resolvedParams = computed(() => {
    const extra = params ? toValue(params) : undefined;
    return {
      portfolioId: toValue(portfolioId),
      ...extra,
    };
  });

  return useQuery({
    queryKey: computed(() => [
      ...VUE_QUERY_CACHE_KEYS.portfolioRealizedPnl,
      resolvedParams.value.portfolioId,
      resolvedParams.value.period,
      resolvedParams.value.financialYear,
      resolvedParams.value.from,
      resolvedParams.value.to,
    ]),
    queryFn: () => getPortfolioRealizedPnl(resolvedParams.value),
    enabled: computed(() => {
      const id = toValue(portfolioId);
      return typeof id === 'string' && id.length > 0;
    }),
    staleTime: QUERY_CACHE_STALE_TIME.ANALYTICS,
    placeholderData: keepPreviousData,
  });
};
