import {
  createFixedIncomeEvent,
  deleteFixedIncomeEvent,
  listFixedIncomeEvents,
  updateFixedIncomeEvent,
} from '@/api/fixed-income/events';
import { VUE_QUERY_CACHE_KEYS, VUE_QUERY_GLOBAL_PREFIXES } from '@/common/const';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRef, unref } from 'vue';

const invalidateAllFixedIncomeRelated = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes(VUE_QUERY_GLOBAL_PREFIXES.fixedIncomeChange),
  });
};

export const useFixedIncomePositionEvents = (positionId: MaybeRef<string | undefined>, queryOptions = {}) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryFn: () => listFixedIncomeEvents({ positionId: unref(positionId)! }),
    queryKey: [...VUE_QUERY_CACHE_KEYS.fixedIncomePositionEvents, positionId],
    enabled: () => !!unref(positionId),
    staleTime: 1000 * 60,
    ...queryOptions,
  });

  return {
    ...query,
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: [...VUE_QUERY_CACHE_KEYS.fixedIncomePositionEvents, positionId] }),
  };
};

export const useCreateFixedIncomeEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof createFixedIncomeEvent>[0]) => createFixedIncomeEvent(params),
    onSuccess: () => invalidateAllFixedIncomeRelated(queryClient),
  });
};

export const useUpdateFixedIncomeEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof updateFixedIncomeEvent>[0]) => updateFixedIncomeEvent(params),
    onSuccess: () => invalidateAllFixedIncomeRelated(queryClient),
  });
};

export const useDeleteFixedIncomeEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => deleteFixedIncomeEvent({ eventId }),
    onSuccess: () => invalidateAllFixedIncomeRelated(queryClient),
  });
};
