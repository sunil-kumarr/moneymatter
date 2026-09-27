import {
  createIncomeCredit,
  deleteIncomeCredit,
  getIncomeCredits,
  linkTransactionsToCredit,
  unlinkTransactionFromCredit,
  updateIncomeCredit,
} from '@/api/income/credits';
import { VUE_QUERY_CACHE_KEYS, VUE_QUERY_GLOBAL_PREFIXES } from '@/common/const';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRef, unref } from 'vue';

const invalidateAllIncomeRelated = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes(VUE_QUERY_GLOBAL_PREFIXES.incomeChange),
  });
};

// Linking/unlinking touches a real Transaction, so it must also invalidate every
// query keyed off transactionChange (cash flow, dashboard widgets, etc.).
const invalidateIncomeAndTransactionRelated = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey.includes(VUE_QUERY_GLOBAL_PREFIXES.incomeChange) ||
        q.queryKey.includes(VUE_QUERY_GLOBAL_PREFIXES.transactionChange)),
  });
};

export const useIncomeCredits = (sourceId: MaybeRef<string | undefined>, queryOptions = {}) => {
  return useQuery({
    queryFn: () => getIncomeCredits({ sourceId: unref(sourceId)! }),
    queryKey: [...VUE_QUERY_CACHE_KEYS.incomeCreditsList, sourceId],
    enabled: () => !!unref(sourceId),
    staleTime: 1000 * 60,
    ...queryOptions,
  });
};

export const useCreateIncomeCredit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createIncomeCredit,
    onSuccess: () => invalidateAllIncomeRelated(queryClient),
  });
};

export const useUpdateIncomeCredit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof updateIncomeCredit>[0]) => updateIncomeCredit(params),
    onSuccess: () => invalidateAllIncomeRelated(queryClient),
  });
};

export const useDeleteIncomeCredit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (creditId: string) => deleteIncomeCredit({ creditId }),
    onSuccess: () => invalidateAllIncomeRelated(queryClient),
  });
};

export const useLinkTransactionsToCredit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: linkTransactionsToCredit,
    onSuccess: () => invalidateIncomeAndTransactionRelated(queryClient),
  });
};

export const useUnlinkTransactionFromCredit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof unlinkTransactionFromCredit>[0]) => unlinkTransactionFromCredit(params),
    onSuccess: () => invalidateIncomeAndTransactionRelated(queryClient),
  });
};
