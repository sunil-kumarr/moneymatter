<template>
  <Card class="border-border bg-card @container/portfolio-value overflow-hidden p-6">
    <!-- Initial Loading State (Dashboard style) -->
    <div v-if="query.isLoading.value && !points.length" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-start gap-8">
          <div class="space-y-1.5">
            <div class="bg-muted h-4 w-20 animate-pulse rounded" />
            <div class="bg-muted h-7 w-28 animate-pulse rounded" />
          </div>
          <div class="space-y-1.5">
            <div class="bg-muted h-4 w-20 animate-pulse rounded" />
            <div class="bg-muted h-7 w-28 animate-pulse rounded" />
          </div>
          <div class="space-y-1.5">
            <div class="bg-muted h-4 w-28 animate-pulse rounded" />
            <div class="bg-muted h-7 w-28 animate-pulse rounded" />
          </div>
        </div>
        <div class="space-y-1.5 text-right">
          <div class="bg-muted ml-auto h-7 w-24 animate-pulse rounded" />
        </div>
      </div>
      <div class="bg-muted h-8 w-64 animate-pulse rounded-md" />
      <div class="border-border/40 bg-muted/20 flex h-80 w-full items-center justify-center rounded-lg border">
        <LoadingState />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="query.isError.value" class="flex h-80 flex-col items-center justify-center gap-2 text-center">
      <TriangleAlertIcon class="text-muted-foreground size-8" />
      <p class="text-muted-foreground text-sm">{{ $t('investments.valueHistory.states.loadError') }}</p>
    </div>

    <!-- Ready Content -->
    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-wrap items-start gap-8">
          <div>
            <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
              <span class="bg-primary size-2.5 shrink-0 rounded-full" />
              {{ $t('investments.valueHistory.current') }}
            </div>
            <div class="text-xl font-semibold @xl/portfolio-value:text-2xl">
              {{ formatCurrency(animatedCurrentValue) }}
            </div>
          </div>

          <div>
            <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
              <span class="bg-muted-foreground size-2.5 shrink-0 rounded-full" />
              {{ $t('investments.valueHistory.invested') }}
            </div>
            <div class="text-xl font-semibold @xl/portfolio-value:text-2xl">
              {{ formatCurrency(animatedInvestedValue) }}
            </div>
          </div>

          <div v-if="showFutureReturns && expectedMaturityValue != null">
            <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
              <span class="size-2.5 shrink-0 rounded-full bg-emerald-500" />
              {{ $t('investments.valueHistory.expectedMaturity') }}
            </div>
            <div class="text-xl font-semibold text-emerald-600 @xl/portfolio-value:text-2xl dark:text-emerald-400">
              {{ formatCurrency(animatedExpectedMaturity) }}
            </div>
          </div>
        </div>

        <div v-if="hasData" class="text-right">
          <div
            class="text-lg font-semibold"
            :class="gainAmount >= 0 ? 'text-app-income-color' : 'text-app-expense-color'"
          >
            {{ formattedGain }}
            <span v-if="formattedGainPct" class="text-sm font-medium">({{ formattedGainPct }})</span>
          </div>
        </div>
      </div>

      <!-- Controls Row: Period Selector & Future Returns Toggle -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div class="flex items-center gap-2">
          <InvestmentValuePeriodSelector v-model="period" />
          <Loader2Icon v-if="query.isFetching.value" class="text-muted-foreground size-4 animate-spin" />
        </div>

        <!-- Button: Show / Hide Future Returns (like PnL chart on Dashboard) -->
        <Button
          v-if="hasFutureData"
          type="button"
          size="sm"
          :variant="showFutureReturns ? 'secondary' : 'outline'"
          class="h-8 px-2.5 text-xs font-medium transition-all"
          :class="{ 'border-primary/60 text-primary font-semibold shadow-xs': showFutureReturns }"
          @click="showFutureReturns = !showFutureReturns"
        >
          <SparklesIcon class="mr-1.5 size-3.5" :class="{ 'text-primary': showFutureReturns }" />
          {{
            showFutureReturns
              ? $t('investments.valueHistory.hideFutureReturns')
              : $t('investments.valueHistory.showFutureReturns')
          }}
        </Button>
      </div>

      <!-- Chart -->
      <InvestmentsValueChart :points="displayPoints" :currency-code="currencyCode" :show-future="showFutureReturns" />
    </div>
  </Card>
</template>

<script setup lang="ts">
import { getPortfoliosValueHistory } from '@/api/portfolios';
import { Card } from '@/components/lib/ui/card';
import { Button } from '@/components/lib/ui/button';
import LoadingState from '@/components/widgets/components/loading-state.vue';
import { QUERY_CACHE_STALE_TIME, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { useFormatCurrency } from '@/composable/formatters';
import { useAnimatedNumber } from '@/composable/use-animated-number';
import InvestmentsValueChart from '@/pages/investments/components/investments-value-chart.vue';
import InvestmentValuePeriodSelector from '@/pages/investments/components/investment-value-period-selector.vue';
import {
  type InvestmentHistoryPeriod,
  resolvePeriodRange,
} from '@/pages/investments/composables/investment-value-history-period';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { useSessionStorage } from '@vueuse/core';
import { Loader2Icon, SparklesIcon, TriangleAlertIcon } from '@lucide/vue';
import { computed, toRef } from 'vue';

const props = defineProps<{
  portfolioId: string;
  currencyCode?: string;
}>();

const portfolioId = toRef(props, 'portfolioId');
const period = useSessionStorage<InvestmentHistoryPeriod>('portfolio-value-history-period', '1Y');
const showFutureReturns = useSessionStorage<boolean>('portfolio-show-future-returns', true);

const periodRange = computed(() => resolvePeriodRange({ period: period.value }));

const query = useQuery({
  queryKey: computed(() => [...VUE_QUERY_CACHE_KEYS.portfolioValueHistory, portfolioId.value, periodRange.value]),
  queryFn: () => getPortfoliosValueHistory({ ...periodRange.value, portfolioId: portfolioId.value }),
  staleTime: QUERY_CACHE_STALE_TIME.ANALYTICS,
  gcTime: QUERY_CACHE_STALE_TIME.ANALYTICS * 2,
  placeholderData: keepPreviousData,
});

const points = computed(() => query.data.value ?? []);

const hasFutureData = computed(() => points.value.some((point) => point.projectedValue != null));

const displayPoints = computed(() => {
  if (showFutureReturns.value) return points.value;
  return points.value.filter((point) => point.currentValue != null);
});

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

const expectedMaturityNumeric = computed(() => expectedMaturityValue.value ?? 0);

const { displayValue: animatedCurrentValue } = useAnimatedNumber({ value: currentValue });
const { displayValue: animatedInvestedValue } = useAnimatedNumber({ value: investedValue });
const { displayValue: animatedExpectedMaturity } = useAnimatedNumber({ value: expectedMaturityNumeric });

const gainAmount = computed(() => currentValue.value - investedValue.value);
const { displayValue: animatedGainAmount } = useAnimatedNumber({ value: gainAmount });

const formattedGain = computed(() => {
  const val = animatedGainAmount.value;
  return `${val > 0 ? '+' : ''}${formatCurrency(val)}`;
});

const formattedGainPct = computed(() => {
  if (investedValue.value === 0) return '';
  const pct = (gainAmount.value / investedValue.value) * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
});
</script>
