<template>
  <Card class="border-border bg-card @container/portfolio-value overflow-hidden p-6">
    <div class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-wrap items-start gap-8">
          <div>
            <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
              <span class="bg-primary size-2.5 shrink-0 rounded-full" />
              {{ $t('investments.valueHistory.current') }}
            </div>
            <div class="text-xl font-semibold @xl/portfolio-value:text-2xl">
              {{ formatCurrency(currentValue) }}
            </div>
          </div>

          <div>
            <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
              <span class="bg-muted-foreground size-2.5 shrink-0 rounded-full" />
              {{ $t('investments.valueHistory.invested') }}
            </div>
            <div class="text-xl font-semibold @xl/portfolio-value:text-2xl">
              {{ formatCurrency(investedValue) }}
            </div>
          </div>

          <div v-if="expectedMaturityValue != null">
            <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
              <span class="size-2.5 shrink-0 rounded-full bg-emerald-500" />
              {{ $t('investments.valueHistory.expectedMaturity') }}
            </div>
            <div class="text-xl font-semibold text-emerald-600 @xl/portfolio-value:text-2xl dark:text-emerald-400">
              {{ formatCurrency(expectedMaturityValue) }}
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

      <template v-if="query.isLoading.value && !query.data.value">
        <div class="bg-muted/60 h-80 w-full animate-pulse rounded-lg" />
      </template>
      <template v-else-if="query.isError.value">
        <div class="flex h-80 flex-col items-center justify-center gap-2 text-center">
          <TriangleAlertIcon class="text-muted-foreground size-8" />
          <p class="text-muted-foreground text-sm">{{ $t('investments.valueHistory.states.loadError') }}</p>
        </div>
      </template>
      <InvestmentsValueChart v-else :points="points" :currency-code="currencyCode" />
    </div>
  </Card>
</template>

<script setup lang="ts">
import { getPortfoliosValueHistory } from '@/api/portfolios';
import { Card } from '@/components/lib/ui/card';
import { QUERY_CACHE_STALE_TIME, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { useFormatCurrency } from '@/composable/formatters';
import InvestmentsValueChart from '@/pages/investments/components/investments-value-chart.vue';
import InvestmentValuePeriodSelector from '@/pages/investments/components/investment-value-period-selector.vue';
import {
  type InvestmentHistoryPeriod,
  resolvePeriodRange,
} from '@/pages/investments/composables/investment-value-history-period';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { useSessionStorage } from '@vueuse/core';
import { TriangleAlertIcon } from '@lucide/vue';
import { computed, toRef } from 'vue';

const props = defineProps<{
  portfolioId: string;
  currencyCode?: string;
}>();

const portfolioId = toRef(props, 'portfolioId');
const period = useSessionStorage<InvestmentHistoryPeriod>('portfolio-value-history-period', '1Y');

const periodRange = computed(() => resolvePeriodRange({ period: period.value }));

const query = useQuery({
  queryKey: computed(() => [...VUE_QUERY_CACHE_KEYS.portfolioValueHistory, portfolioId.value, periodRange.value]),
  queryFn: () => getPortfoliosValueHistory({ ...periodRange.value, portfolioId: portfolioId.value }),
  staleTime: QUERY_CACHE_STALE_TIME.ANALYTICS,
  gcTime: QUERY_CACHE_STALE_TIME.ANALYTICS * 2,
  placeholderData: keepPreviousData,
});

const points = computed(() => query.data.value ?? []);

const hasData = computed(() => points.value.some((point) => point.currentValue !== 0 || point.investedValue !== 0));

const { formatBaseCurrency, formatAmountByCurrencyCode } = useFormatCurrency();

const formatCurrency = (val: number) =>
  props.currencyCode ? formatAmountByCurrencyCode(val, props.currencyCode) : formatBaseCurrency(val);

const currentValue = computed(() => {
  const pastPoints = points.value.filter((p) => p.currentValue != null);
  return pastPoints[pastPoints.length - 1]?.currentValue ?? 0;
});

const investedValue = computed(() => {
  const pastPoints = points.value.filter((p) => p.currentValue != null);
  return pastPoints[pastPoints.length - 1]?.investedValue ?? points.value[points.value.length - 1]?.investedValue ?? 0;
});

const expectedMaturityValue = computed(() => {
  const futurePoints = points.value.filter((p) => p.projectedValue != null);
  if (futurePoints.length === 0) return null;
  return futurePoints[futurePoints.length - 1]?.projectedValue ?? null;
});

const gain = computed(() => {
  const amount = currentValue.value - investedValue.value;
  const pct = investedValue.value !== 0 ? (amount / investedValue.value) * 100 : null;
  return { amount, pct };
});

const formattedGain = computed(() => `${gain.value.amount > 0 ? '+' : ''}${formatCurrency(gain.value.amount)}`);

const formattedGainPct = computed(() => {
  const pct = gain.value.pct;
  if (pct === null) return '';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
});
</script>
