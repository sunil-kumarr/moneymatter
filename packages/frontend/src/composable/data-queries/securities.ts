import { createManualPrice } from '@/api/securities';
import { useMutation, useQueryClient } from '@tanstack/vue-query';

import { invalidatePortfolioState } from './invalidate-portfolio-state';

export const useCreateManualPrice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createManualPrice,
    onSuccess: () => {
      invalidatePortfolioState({ queryClient });
    },
  });
};
