import {
  createIncomeSource,
  deleteIncomeSource,
  getIncomeSource,
  getIncomeSources,
  updateIncomeSource,
} from '@/api/income/sources';
import { VUE_QUERY_CACHE_KEYS, VUE_QUERY_GLOBAL_PREFIXES } from '@/common/const';
import type { INCOME_SOURCE_STATUS } from '@bt/shared/types/income';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRef, unref } from 'vue';

const invalidateAllIncomeRelated = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes(VUE_QUERY_GLOBAL_PREFIXES.incomeChange),
  });
};

export const useIncomeSources = (status?: MaybeRef<INCOME_SOURCE_STATUS | undefined>, queryOptions = {}) => {
  return useQuery({
    queryFn: () => getIncomeSources(status ? { status: unref(status) } : undefined),
    queryKey: [...VUE_QUERY_CACHE_KEYS.incomeSourcesList, status],
    staleTime: 1000 * 60,
    ...queryOptions,
  });
};

export const useIncomeSource = (sourceId: MaybeRef<string | undefined>, queryOptions = {}) => {
  return useQuery({
    queryFn: () => getIncomeSource({ sourceId: unref(sourceId)! }),
    queryKey: [...VUE_QUERY_CACHE_KEYS.incomeSourceDetails, sourceId],
    enabled: () => !!unref(sourceId),
    staleTime: 1000 * 60,
    ...queryOptions,
  });
};

export const useCreateIncomeSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createIncomeSource,
    onSuccess: () => invalidateAllIncomeRelated(queryClient),
  });
};

export const useUpdateIncomeSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof updateIncomeSource>[0]) => updateIncomeSource(params),
    onSuccess: () => invalidateAllIncomeRelated(queryClient),
  });
};

export const useDeleteIncomeSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => deleteIncomeSource({ sourceId }),
    onSuccess: () => invalidateAllIncomeRelated(queryClient),
  });
};
