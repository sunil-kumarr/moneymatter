<script setup lang="ts">
import { getAccountAnalytics } from '@/api/stats';
import { QUERY_CACHE_STALE_TIME, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import BudgetCategoryChart from '@/pages/budgets/budgets-info/statistics/budget-category-chart.vue';
import Card from '@/components/lib/ui/card/Card.vue';
import PillTabs from '@/components/lib/ui/pill-tabs/pill-tabs.vue';
import GranularitySelector from '@/pages/analytics/components/granularity-selector.vue';
import PeriodSelector from '@/pages/analytics/subpages/cash-flow/components/period-selector.vue';
import CashFlowChart from '@/pages/analytics/subpages/cash-flow/components/cash-flow-chart.vue';
import ChartTypeSwitcher, {
  type ChartType,
} from '@/pages/analytics/subpages/cash-flow/components/chart-type-switcher.vue';
import type { Period } from '@/composable/use-period-navigation';
import AccountBalanceChart from './account-balance-chart.vue';
import { useQuery } from '@tanstack/vue-query';
import type { endpointsTypes } from '@bt/shared/types';
import { BarChart3Icon, LoaderCircleIcon, TriangleAlertIcon } from '@lucide/vue';
import { differenceInDays, endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { computed, ref } from 'vue';

const props = defineProps<{
  accountId: string;
}>();

const period = ref<Period>({
  from: startOfMonth(subMonths(new Date(), 5)),
  to: endOfMonth(new Date()),
});

const GRANULARITIES = ['weekly', 'biweekly', 'monthly'] as const satisfies endpointsTypes.CashFlowGranularity[];
const granularity = ref<endpointsTypes.CashFlowGranularity>('monthly');

const { data, isLoading, isError } = useQuery({
  queryFn: () =>
    getAccountAnalytics({
      accountId: props.accountId,
      from: period.value.from,
      to: period.value.to,
      granularity: granularity.value,
    }),
  queryKey: [...VUE_QUERY_CACHE_KEYS.accountAnalytics, props.accountId, period, granularity],
  staleTime: QUERY_CACHE_STALE_TIME.ANALYTICS,
});

const isEmpty = computed(
  () =>
    !!data.value &&
    data.value.spendingsByCategory.length === 0 &&
    data.value.cashFlow.periods.every(
      (cashFlowPeriod) => cashFlowPeriod.income === 0 && cashFlowPeriod.expenses === 0,
    ) &&
    data.value.balanceHistory.length === 0,
);

const activeChart = ref('cashFlow');
const chartTabs = computed(() => [
  { value: 'cashFlow', label: 'Cash Flow' },
  { value: 'categories', label: 'Categories' },
  { value: 'balance', label: 'Balance' },
]);

const cashFlowChartType = ref<ChartType>('stacked');

// Reasonable defaults: short ranges get finer buckets, longer ranges stay readable at monthly.
const onPeriodChange = (value: Period) => {
  period.value = value;
  const days = differenceInDays(value.to, value.from);
  if (days <= 45) granularity.value = 'weekly';
  else if (days <= 120) granularity.value = 'biweekly';
  else granularity.value = 'monthly';
};
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <PeriodSelector :model-value="period" @update:model-value="onPeriodChange" />
      <GranularitySelector
        v-model="granularity"
        :granularities="GRANULARITIES"
        label-key-prefix="analytics.cashFlow.granularity"
      />
    </div>

    <Card v-if="isLoading" class="flex items-center justify-center py-16">
      <LoaderCircleIcon class="text-muted-foreground size-8 animate-spin" />
    </Card>

    <Card v-else-if="isError" class="flex flex-col items-center justify-center py-12 text-center">
      <div class="bg-muted mb-4 flex size-16 items-center justify-center rounded-full">
        <TriangleAlertIcon class="text-muted-foreground size-8" />
      </div>
      <h3 class="mb-1 font-medium">Couldn't load analytics</h3>
      <p class="text-muted-foreground max-w-sm text-sm">
        Something went wrong while loading this account's analytics. Please try again.
      </p>
    </Card>

    <Card v-else-if="isEmpty" class="flex flex-col items-center justify-center py-12 text-center">
      <div class="bg-muted mb-4 flex size-16 items-center justify-center rounded-full">
        <BarChart3Icon class="text-muted-foreground size-8" />
      </div>
      <h3 class="mb-1 font-medium">No data yet</h3>
      <p class="text-muted-foreground max-w-sm text-sm">
        There isn't enough transaction history for this account in the selected period.
      </p>
    </Card>

    <Card v-else-if="data" class="p-4 @md:p-6">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-2">
        <PillTabs v-model="activeChart" :items="chartTabs" size="sm" />
        <ChartTypeSwitcher v-if="activeChart === 'cashFlow'" v-model="cashFlowChartType" />
      </div>

      <CashFlowChart v-if="activeChart === 'cashFlow'" :data="data.cashFlow.periods" :chart-type="cashFlowChartType" />
      <BudgetCategoryChart v-else-if="activeChart === 'categories'" :data="data.spendingsByCategory" />
      <AccountBalanceChart v-else :data="data.balanceHistory" />
    </Card>
  </div>
</template>
