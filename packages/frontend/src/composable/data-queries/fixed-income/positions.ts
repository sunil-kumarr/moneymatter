import {
  createFixedIncomePosition,
  deleteFixedIncomePosition,
  getFixedIncomePositionMetrics,
  listFixedIncomePositions,
  updateFixedIncomePosition,
} from '@/api/fixed-income/positions';
import { VUE_QUERY_CACHE_KEYS, VUE_QUERY_GLOBAL_PREFIXES } from '@/common/const';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRef, unref } from 'vue';

const invalidateAllFixedIncomeRelated = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes(VUE_QUERY_GLOBAL_PREFIXES.fixedIncomeChange),
  });
};

export const useFixedIncomePositions = (portfolioId: MaybeRef<string | undefined>, queryOptions = {}) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryFn: () => listFixedIncomePositions({ portfolioId: unref(portfolioId) }),
    queryKey: [...VUE_QUERY_CACHE_KEYS.fixedIncomePositionsList, portfolioId],
    enabled: () => !!unref(portfolioId),
    staleTime: 1000 * 60 * 5,
    ...queryOptions,
  });

  return {
    ...query,
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: [...VUE_QUERY_CACHE_KEYS.fixedIncomePositionsList, portfolioId] }),
  };
};

export const useFixedIncomePositionMetrics = (positionId: MaybeRef<string | undefined>, queryOptions = {}) => {
  const query = useQuery({
    queryFn: () => getFixedIncomePositionMetrics({ positionId: unref(positionId)! }),
    queryKey: [...VUE_QUERY_CACHE_KEYS.fixedIncomePositionMetrics, positionId],
    enabled: () => !!unref(positionId),
    staleTime: 1000 * 60,
    ...queryOptions,
  });

  return { ...query };
};

export const useCreateFixedIncomePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFixedIncomePosition,
    onSuccess: () => invalidateAllFixedIncomeRelated(queryClient),
  });
};

export const useUpdateFixedIncomePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof updateFixedIncomePosition>[0]) => updateFixedIncomePosition(params),
    onSuccess: () => invalidateAllFixedIncomeRelated(queryClient),
  });
};

export const useDeleteFixedIncomePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (positionId: string) => deleteFixedIncomePosition({ positionId }),
    onSuccess: () => invalidateAllFixedIncomeRelated(queryClient),
  });
};
