<template>
  <div class="border-border bg-card @container/investments-value mb-6 space-y-4 rounded-lg border p-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex flex-wrap items-start gap-8">
        <div>
          <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
            <span class="bg-primary size-2.5 shrink-0 rounded-full" />
            {{ $t('investments.valueHistory.current') }}
          </div>
          <div class="text-xl font-semibold @xl/investments-value:text-2xl">{{ formatBaseCurrency(currentValue) }}</div>
        </div>

        <div>
          <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
            <span class="bg-muted-foreground size-2.5 shrink-0 rounded-full" />
            {{ $t('investments.valueHistory.invested') }}
          </div>
          <div class="text-xl font-semibold @xl/investments-value:text-2xl">
            {{ formatBaseCurrency(investedValue) }}
          </div>
        </div>
      </div>

      <div v-if="hasData" class="text-right">
        <div
          class="text-lg font-semibold"
          :class="gain.amount >= 0 ? 'text-app-income-color' : 'text-app-expense-color'"
        >
          {{ formattedGain }}
          <span v-if="gain.pct !== null" class="text-sm font-medium">({{ formattedGainPct }})</span>
        </div>
      </div>
    </div>

    <InvestmentValuePeriodSelector v-model="period" />

    <template v-if="query.isLoading.value">
      <div class="bg-muted/60 h-80 w-full animate-pulse rounded" />
    </template>
    <template v-else-if="query.isError.value">
      <div class="flex h-80 flex-col items-center justify-center gap-2 text-center">
        <TriangleAlertIcon class="text-muted-foreground size-8" />
        <p class="text-muted-foreground text-sm">{{ $t('investments.valueHistory.states.loadError') }}</p>
      </div>
    </template>
    <InvestmentsValueChart v-else :points="points" />
  </div>
</template>

<script setup lang="ts">
import { getPortfoliosValueHistory } from '@/api/portfolios';
import { QUERY_CACHE_STALE_TIME, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { useFormatCurrency } from '@/composable/formatters';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { useSessionStorage } from '@vueuse/core';
import { TriangleAlertIcon } from '@lucide/vue';
import { computed } from 'vue';

import { type InvestmentHistoryPeriod, resolvePeriodRange } from '../composables/investment-value-history-period';
import InvestmentValuePeriodSelector from './investment-value-period-selector.vue';
import InvestmentsValueChart from './investments-value-chart.vue';

const period = useSessionStorage<InvestmentHistoryPeriod>('investments-value-history-period', '1Y');

const periodRange = computed(() => resolvePeriodRange({ period: period.value }));

const query = useQuery({
  queryKey: [...VUE_QUERY_CACHE_KEYS.portfolioValueHistory, periodRange],
  queryFn: () => getPortfoliosValueHistory(periodRange.value),
  staleTime: QUERY_CACHE_STALE_TIME.ANALYTICS,
  gcTime: QUERY_CACHE_STALE_TIME.ANALYTICS * 2,
  placeholderData: keepPreviousData,
});

const points = computed(() => query.data.value ?? []);

// Backend returns a full list of daily rows even when nothing was ever
// invested, so row presence can't distinguish "no data" — only nonzero values can.
const hasData = computed(() => points.value.some((point) => point.currentValue !== 0 || point.investedValue !== 0));

const { formatBaseCurrency } = useFormatCurrency();

const currentValue = computed(() => points.value[points.value.length - 1]?.currentValue ?? 0);
const investedValue = computed(() => points.value[points.value.length - 1]?.investedValue ?? 0);

const gain = computed(() => {
  const amount = currentValue.value - investedValue.value;
  const pct = investedValue.value !== 0 ? (amount / investedValue.value) * 100 : null;
  return { amount, pct };
});

const formattedGain = computed(() => `${gain.value.amount > 0 ? '+' : ''}${formatBaseCurrency(gain.value.amount)}`);

const formattedGainPct = computed(() => {
  const pct = gain.value.pct;
  if (pct === null) return '';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
});
</script>
