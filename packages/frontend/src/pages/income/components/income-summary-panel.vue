<template>
  <Card class="@container/income-balance overflow-hidden">
    <!-- Loading State -->
    <div v-if="isLoading" class="p-6">
      <div class="space-y-2">
        <div class="bg-muted h-9 w-48 animate-pulse rounded" />
        <div class="bg-muted h-5 w-36 animate-pulse rounded" />
      </div>
      <div class="mt-5 grid grid-cols-2 gap-4 border-t pt-5 @md/income-balance:grid-cols-4">
        <div v-for="i in 4" :key="i" class="space-y-1.5">
          <div class="bg-muted h-3 w-16 animate-pulse rounded" />
          <div class="bg-muted h-5 w-24 animate-pulse rounded" />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-6 text-center">
      <div class="bg-destructive/10 mx-auto mb-3 flex size-10 items-center justify-center rounded-full">
        <AlertCircleIcon class="text-destructive-text size-5" />
      </div>
      <p class="text-destructive-text text-sm">{{ $t('income.summary.loadError') }}</p>
    </div>

    <!-- Content -->
    <div v-else-if="summary" class="p-6">
      <div class="@3xl/income-balance:flex @3xl/income-balance:items-center @3xl/income-balance:gap-8">
        <div class="shrink-0">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 class="text-3xl font-semibold tracking-tight">
              {{ formatCurrency(Number(summary.totalNet), summary.currencyCode) }}
            </h2>
            <div
              v-if="yoyGrowthPct !== null"
              :class="getGainColorClass({ gainValue: yoyGrowthPct })"
              class="flex items-center gap-1.5"
            >
              <component :is="yoyGrowthPct >= 0 ? TrendingUpIcon : TrendingDownIcon" class="size-4" />
              <span class="text-sm font-medium">{{ yoyGrowthPct >= 0 ? '+' : '' }}{{ yoyGrowthPct.toFixed(1) }}%</span>
              <span class="text-xs">{{ $t('income.summary.yoy') }}</span>
            </div>
          </div>
          <i18n-t
            v-if="summary.baseCurrencyCode && summary.currencyCode !== summary.baseCurrencyCode"
            keypath="income.summary.baseCurrencyEquivalent"
            tag="p"
            class="text-muted-foreground mt-1 text-base tabular-nums"
          >
            <template #value>
              <span class="text-foreground font-medium">
                {{ formatCurrency(Number(summary.totalNetInBaseCurrency), summary.baseCurrencyCode) }}
              </span>
            </template>
          </i18n-t>
          <p class="text-muted-foreground mt-0.5 text-sm">{{ $t('income.summary.totalNet') }}</p>
        </div>

        <div
          class="mt-5 grid grid-cols-2 gap-4 border-t pt-5 @md/income-balance:grid-cols-4 @3xl/income-balance:mt-0 @3xl/income-balance:flex-1 @3xl/income-balance:border-t-0 @3xl/income-balance:border-l @3xl/income-balance:pt-0 @3xl/income-balance:pl-8"
        >
          <!-- FY-to-date -->
          <div class="space-y-0.5">
            <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {{ $t('income.summary.metrics.ytd', { fy: summary.fyLabel }) }}
            </p>
            <p class="text-base font-semibold">{{ formatCurrency(Number(summary.ytdNet), summary.currencyCode) }}</p>
          </div>

          <!-- Average monthly -->
          <div class="space-y-0.5">
            <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {{ $t('income.summary.metrics.avgMonthly') }}
            </p>
            <p class="text-base font-semibold">
              {{ formatCurrency(Number(summary.avgMonthlyNet), summary.currencyCode) }}
            </p>
          </div>

          <!-- Latest / run-rate -->
          <div class="space-y-0.5">
            <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {{ $t('income.summary.metrics.runRate') }}
            </p>
            <p class="text-base font-semibold">
              {{ formatCurrency(Number(summary.annualRunRateNet), summary.currencyCode) }}
            </p>
          </div>

          <!-- Effective deduction rate -->
          <div class="space-y-0.5">
            <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {{ $t('income.summary.metrics.deductionRate') }}
            </p>
            <p class="text-base font-semibold">
              {{
                summary.effectiveDeductionRatePct !== null
                  ? `${Number(summary.effectiveDeductionRatePct).toFixed(1)}%`
                  : '—'
              }}
            </p>
            <p class="text-muted-foreground text-xs">
              {{ formatCurrency(Number(summary.totalDeductions), summary.currencyCode) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Last raise callout -->
      <div
        v-if="summary.lastRaiseDate"
        class="border-border/60 mt-4 flex items-center gap-2 border-t border-dashed pt-3 text-sm"
      >
        <TrendingUpIcon class="text-app-income-color size-4" />
        <i18n-t keypath="income.summary.lastRaise" tag="span" class="text-muted-foreground">
          <template #amount>
            <span class="text-foreground font-medium">
              {{ formatCurrency(Number(summary.lastRaiseAmount), summary.currencyCode) }}
            </span>
          </template>
          <template #pct>
            <span class="text-foreground font-medium">{{ Number(summary.lastRaisePct).toFixed(1) }}%</span>
          </template>
          <template #date>{{ summary.lastRaiseDate }}</template>
        </i18n-t>
      </div>

      <!-- Expected vs actual CTC -->
      <div
        v-if="summary.expectedAnnualCtc"
        class="border-border/60 mt-3 flex items-center justify-between border-t border-dashed pt-3 text-sm"
      >
        <span class="text-muted-foreground">{{ $t('income.summary.expectedCtc') }}</span>
        <span class="text-foreground font-medium">
          {{ formatCurrency(Number(summary.expectedAnnualCtc), summary.currencyCode) }}
          <span v-if="summary.expectedVsActualPct !== null" class="text-muted-foreground ml-1 text-xs">
            ({{ Number(summary.expectedVsActualPct).toFixed(0) }}% {{ $t('income.summary.realized') }})
          </span>
        </span>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Card } from '@/components/lib/ui/card';
import { useIncomeSourceSummary } from '@/composable/data-queries/income/summary';
import { useFormatCurrency } from '@/composable/formatters';
import { getGainColorClass } from '@/composable/gain-color';
import { AlertCircleIcon, TrendingDownIcon, TrendingUpIcon } from '@lucide/vue';
import { computed, toRef } from 'vue';

const props = withDefaults(defineProps<{ sourceId?: string }>(), { sourceId: 'all' });
const sourceId = toRef(props, 'sourceId');

const { data: summary, isLoading, error } = useIncomeSourceSummary(sourceId);

const { formatAmountByCurrencyCode } = useFormatCurrency();
const formatCurrency = (amount: number, currencyCode: string) => formatAmountByCurrencyCode(amount, currencyCode);

const yoyGrowthPct = computed(() => {
  const value = summary.value?.yoyGrowthPct;
  return value === null || value === undefined ? null : Number(value);
});
</script>
