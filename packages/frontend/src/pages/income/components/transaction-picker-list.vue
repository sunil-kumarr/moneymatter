<template>
  <div class="flex flex-col gap-3">
    <InputField v-model="searchQuery" :placeholder="$t('income.credits.linkDialog.searchPlaceholder')">
      <template #iconLeading><SearchIcon class="text-muted-foreground size-4" /></template>
    </InputField>

    <ScrollArea class="h-80">
      <div v-if="isLoading" class="text-muted-foreground py-8 text-center text-sm">
        {{ $t('income.credits.linkDialog.loading') }}
      </div>
      <div v-else-if="!transactions || transactions.length === 0" class="py-10 text-center">
        <InboxIcon class="text-muted-foreground mx-auto mb-2 size-8 opacity-50" />
        <p class="text-muted-foreground text-sm">{{ $t('income.credits.linkDialog.empty') }}</p>
      </div>
      <div v-else class="flex flex-col gap-1 pr-2">
        <button
          v-for="tx in transactions"
          :key="tx.id"
          type="button"
          class="hover:bg-muted/50 flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="disabled"
          @click="emit('select', tx)"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{
              tx.note || $t('income.credits.linkDialog.noNote')
            }}</span>
            <span class="text-muted-foreground text-xs">{{ format(new Date(tx.time), 'd MMM yyyy') }}</span>
          </span>
          <span class="text-app-income-color shrink-0 text-sm font-semibold tabular-nums">
            {{ formatAmountByCurrencyCode(tx.amount, tx.currencyCode) }}
          </span>
        </button>
      </div>
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
import { loadTransactions } from '@/api/transactions';
import InputField from '@/components/fields/input-field.vue';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { useFormatCurrency } from '@/composable/formatters';
import type { TransactionModel } from '@bt/shared/types/db-models';
import { TRANSACTION_TYPES } from '@bt/shared/types/enums';
import { useQuery } from '@tanstack/vue-query';
import { useDebounce } from '@vueuse/core';
import { InboxIcon, SearchIcon } from '@lucide/vue';
import { format } from 'date-fns';
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    currencyCode: string;
    /** Whether the query should run — pass the owning dialog's open state. */
    active?: boolean;
    disabled?: boolean;
  }>(),
  { active: true, disabled: false },
);

const emit = defineEmits<{ select: [transaction: TransactionModel] }>();

const { formatAmountByCurrencyCode } = useFormatCurrency();

const searchQuery = ref('');
const searchQueryDebounced = useDebounce(searchQuery, 300);

const { data: transactions, isLoading } = useQuery({
  queryKey: computed(() => ['income-link-transaction-candidates', props.currencyCode, searchQueryDebounced.value]),
  queryFn: () =>
    loadTransactions({
      transactionType: TRANSACTION_TYPES.income,
      search: searchQueryDebounced.value || undefined,
      limit: 25,
    }),
  select: (data: TransactionModel[]) => data.filter((tx) => tx.currencyCode === props.currencyCode),
  enabled: computed(() => props.active),
});

defineExpose({ resetSearch: () => (searchQuery.value = '') });
</script>
