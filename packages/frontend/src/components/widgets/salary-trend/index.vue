<template>
  <WidgetWrapper :is-fetching="isFetching" data-testid="widget-salary-trend">
    <template #title>
      <div class="flex w-full items-center gap-2">
        <span class="shrink-0">{{ t('dashboard.widgets.salaryTrend.title') }}</span>
        <SelectField
          :model-value="selectedCategoryOption"
          :values="categoryOptions"
          value-key="id"
          label-key="name"
          with-search
          :search-keys="['name']"
          :placeholder="t('dashboard.widgets.salaryTrend.selectCategory')"
          class="w-36 text-xs"
          :disabled="isFetching"
          @update:model-value="handleCategorySelected"
        >
          <template #trigger="{ item }">
            <span class="flex min-w-0 items-center gap-1.5">
              <CategoryCircle :category-id="item.id" />
              <span class="truncate">{{ item.name }}</span>
            </span>
          </template>
          <template #item="{ item }">
            <span class="flex min-w-0 items-center gap-1.5">
              <CategoryCircle :category-id="item.id" />
              <span class="truncate">{{ item.name }}</span>
            </span>
          </template>
        </SelectField>
        <SelectField
          v-model="selectedGranularity"
          :values="granularityOptions"
          value-key="value"
          label-key="label"
          class="w-28 text-xs"
          :disabled="isFetching"
        />
      </div>
    </template>

    <template v-if="isInitialLoading">
      <LoadingState />
    </template>

    <template v-else-if="!salaryCategoryId">
      <div class="flex min-h-[220px] flex-col items-center justify-center gap-3 opacity-70">
        <BanknoteArrowUpIcon class="size-32" />
        <p class="max-w-64 text-center text-sm">{{ t('dashboard.widgets.salaryTrend.noCategorySelected') }}</p>
      </div>
    </template>

    <template v-else-if="!hasData">
      <EmptyState>
        <BanknoteArrowUpIcon class="size-32" />
      </EmptyState>
    </template>

    <template v-else>
      <div class="max-xs:px-2 mb-4">
        <div class="text-2xl font-bold tracking-tight">{{ formatBaseCurrency(total) }}</div>
        <div class="text-muted-foreground mt-1 text-xs font-medium tracking-tight uppercase">
          {{ periodLabel }}
        </div>
      </div>

      <div ref="chartAreaRef" class="max-xs:px-2 relative flex min-h-0 flex-1 items-end justify-center gap-2">
        <svg class="pointer-events-none absolute inset-0 size-full overflow-visible">
          <polyline
            :points="linePointsAttr"
            fill="none"
            stroke="var(--color-app-income-color)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            v-for="point in linePoints"
            :key="point.key"
            :cx="point.x"
            :cy="point.y"
            r="3"
            fill="var(--card)"
            stroke="var(--color-app-income-color)"
            stroke-width="2"
          />
        </svg>

        <ResponsiveTooltip
          v-for="bar in bars"
          :key="bar.key"
          variant="chart"
          content-class-name="min-w-0"
          :delay-duration="100"
        >
          <div class="flex h-full max-w-14 min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div class="flex w-full flex-1 items-end justify-center">
              <div
                :ref="(el) => setBarElRef({ el: el as HTMLDivElement | null, key: bar.key })"
                class="bg-app-income-color/90 min-h-1 w-full max-w-10 rounded-xs transition-all duration-500"
                :style="{ height: `${barHeightPercent(bar.value)}%` }"
              />
            </div>
            <span class="text-muted-foreground w-full truncate text-center text-[10px] leading-none">{{
              bar.label
            }}</span>
          </div>
          <template #content>
            <ChartTooltipHeader>{{ bar.label }}</ChartTooltipHeader>
            <div class="text-app-income-color font-semibold whitespace-nowrap tabular-nums">
              {{ formatBaseCurrency(bar.value) }}
            </div>
          </template>
        </ResponsiveTooltip>
      </div>
    </template>
  </WidgetWrapper>
</template>

<script lang="ts" setup>
import type { DashboardWidgetConfig } from '@/api/user-settings';
import CategoryCircle from '@/components/common/category-circle.vue';
import { ChartTooltipHeader } from '@/components/common/charts/chart-tooltip';
import ResponsiveTooltip from '@/components/common/responsive-tooltip.vue';
import SelectField from '@/components/fields/select-field.vue';
import { useFormatCurrency } from '@/composable/formatters';
import { useCategoriesStore } from '@/stores/categories/categories';
import { useResizeObserver } from '@vueuse/core';
import { format, min, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns';
import { BanknoteArrowUpIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { computed, inject, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import EmptyState from '../components/empty-state.vue';
import LoadingState from '../components/loading-state.vue';
import WidgetWrapper from '../components/widget-wrapper.vue';
import { type SalaryTrendGranularity, useSalaryTrendData } from './use-salary-trend-data';

defineOptions({ name: 'salary-trend-widget' });

const props = defineProps<{
  selectedPeriod: { from: Date; to: Date };
}>();

const { t } = useI18n();
const { formatBaseCurrency } = useFormatCurrency();
const { ownCategories } = storeToRefs(useCategoriesStore());

const widgetConfigRef = inject<Ref<DashboardWidgetConfig> | null>('dashboard-widget-config', null);
const saveWidgetConfig =
  inject<(params: { widgetId: string; config: Record<string, unknown> }) => Promise<void>>(
    'dashboard-save-widget-config',
  );

// Falls back to a category literally named "Salary" so the widget shows useful data out of
// the box for the common case, without forcing every user through the settings popover first.
const configuredCategoryId = computed<string | null>(() => {
  const id = widgetConfigRef?.value?.config?.salaryCategoryId;
  return typeof id === 'string' ? id : null;
});
const autoDetectedCategoryId = computed<string | null>(() => {
  const match = ownCategories.value.find((category) => category.name.trim().toLowerCase() === 'salary');
  return match?.id ?? null;
});
const salaryCategoryId = computed<string | null>(() => configuredCategoryId.value ?? autoDetectedCategoryId.value);

interface CategoryOption {
  id: string;
  name: string;
}

const categoryOptions = computed<CategoryOption[]>(() =>
  ownCategories.value.map((category) => ({ id: category.id, name: category.name })),
);
const selectedCategoryOption = computed<CategoryOption | null>(() => {
  if (!salaryCategoryId.value) return null;
  return categoryOptions.value.find((option) => option.id === salaryCategoryId.value) ?? null;
});

const handleCategorySelected = (option: CategoryOption | null) => {
  if (!option || !saveWidgetConfig || !widgetConfigRef?.value) return;
  saveWidgetConfig({ widgetId: widgetConfigRef.value.widgetId, config: { salaryCategoryId: option.id } });
};

type GranularityOption = { value: SalaryTrendGranularity; label: string };
const granularityOptions = computed<GranularityOption[]>(() => [
  { value: 'monthly', label: t('dashboard.widgets.salaryTrend.granularity.monthly') },
  { value: 'yearly', label: t('dashboard.widgets.salaryTrend.granularity.yearly') },
]);
const selectedGranularity = ref<GranularityOption>(granularityOptions.value[0]!);

// A trend chart needs its own trailing window, sized to the chosen granularity — the dashboard's
// global period filter is often just "this month" and would starve a Yearly trend of every bucket
// but the current one. The window always ends at the selected period (capped at today) so picking
// an earlier dashboard period still shows the trend leading up to it.
const MONTHLY_WINDOW_SIZE = 12;
const YEARLY_WINDOW_SIZE = 5;
const trendRange = computed(() => {
  const to = min([props.selectedPeriod.to, new Date()]);
  if (selectedGranularity.value.value === 'yearly') {
    return { from: startOfYear(subYears(to, YEARLY_WINDOW_SIZE - 1)), to };
  }
  return { from: startOfMonth(subMonths(to, MONTHLY_WINDOW_SIZE - 1)), to };
});

const { bars, total, hasData, isFetching, isInitialLoading } = useSalaryTrendData({
  selectedPeriod: () => trendRange.value,
  categoryId: salaryCategoryId,
  granularity: computed(() => selectedGranularity.value.value),
});

const maxBarValue = computed(() => Math.max(...bars.value.map((bar) => Math.abs(bar.value)), 1));
const barHeightPercent = (value: number) => Math.max((Math.abs(value) / maxBarValue.value) * 100, 4);

const periodLabel = computed(() => {
  const { from, to } = trendRange.value;
  return `${format(from, 'MMM yyyy')} - ${format(to, 'MMM yyyy')}`;
});

// Trend line connecting each bar's top. Positions are measured from the actual bar elements
// (rather than derived from `barHeightPercent`) so the line lines up exactly with the rendered
// bars regardless of column width/shrinking, and stays correct across resizes.
const chartAreaRef = ref<HTMLDivElement | null>(null);
const barElByKey = new Map<string, HTMLDivElement>();

const setBarElRef = ({ el, key }: { el: HTMLDivElement | null; key: string }) => {
  if (el) barElByKey.set(key, el);
  else barElByKey.delete(key);
};

const linePoints = ref<{ key: string; x: number; y: number }[]>([]);

const updateLinePoints = () => {
  const container = chartAreaRef.value;
  if (!container) return;
  const containerRect = container.getBoundingClientRect();

  linePoints.value = bars.value.flatMap((bar) => {
    const el = barElByKey.get(bar.key);
    if (!el) return [];
    const rect = el.getBoundingClientRect();
    return [{ key: bar.key, x: rect.left - containerRect.left + rect.width / 2, y: rect.top - containerRect.top }];
  });
};

const linePointsAttr = computed(() => linePoints.value.map((point) => `${point.x},${point.y}`).join(' '));

useResizeObserver(chartAreaRef, updateLinePoints);

// Bars animate their height over 500ms (see the `transition-all duration-500` class below); an
// immediate measurement would catch them mid-transition, so the line is re-measured once right
// away and once more after the transition settles, rather than trying to track it frame-by-frame.
const BAR_TRANSITION_MS = 500;
watch(
  bars,
  () => {
    nextTick(updateLinePoints);
    window.setTimeout(updateLinePoints, BAR_TRANSITION_MS + 20);
  },
  { flush: 'post' },
);
</script>
