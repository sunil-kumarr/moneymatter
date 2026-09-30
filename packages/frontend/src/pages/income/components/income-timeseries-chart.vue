<template>
  <Card class="@container/income-chart overflow-hidden p-6">
    <!-- Loading Skeleton -->
    <div v-if="isLoading && !timeseries" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-2">
          <div class="bg-muted h-4 w-24 animate-pulse rounded" />
          <div class="bg-muted h-8 w-36 animate-pulse rounded" />
        </div>
        <div class="bg-muted h-8 w-64 animate-pulse rounded" />
      </div>
      <div class="bg-muted/50 h-52 w-full animate-pulse rounded-lg" />
    </div>

    <!-- Error State -->
    <div v-else-if="isError" class="py-12 text-center">
      <div class="bg-destructive/10 mx-auto mb-3 flex size-10 items-center justify-center rounded-full">
        <AlertCircleIcon class="text-destructive-text size-5" />
      </div>
      <p class="text-destructive-text text-sm">{{ $t('income.chart.loadError') }}</p>
    </div>

    <!-- Content -->
    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="text-foreground text-sm font-semibold tracking-tight">
            {{ viewMode === 'cumulative' ? $t('income.chart.cumulativeTitle') : $t('income.chart.monthlyTitle') }}
          </span>
        </div>

        <div class="flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            type="button"
            size="sm"
            :variant="viewMode === 'monthly' ? 'secondary' : 'ghost'"
            class="h-7 px-2.5 text-xs font-medium"
            @click="viewMode = 'monthly'"
          >
            {{ $t('income.chart.viewMonthly') }}
          </Button>
          <Button
            type="button"
            size="sm"
            :variant="viewMode === 'cumulative' ? 'secondary' : 'ghost'"
            class="h-7 px-2.5 text-xs font-medium"
            @click="viewMode = 'cumulative'"
          >
            {{ $t('income.chart.viewCumulative') }}
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 class="text-app-income-color text-2xl font-bold tracking-tight md:text-3xl">
            {{ formattedHeadline }}
          </h3>
          <p class="text-muted-foreground mt-1 text-xs font-medium">
            {{ viewMode === 'cumulative' ? $t('income.chart.cumulativeHeadline') : $t('income.chart.monthlyHeadline') }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <Button
            v-for="p in PERIOD_PRESETS"
            :key="p"
            type="button"
            size="sm"
            :variant="selectedPeriod === p && !selectedFinancialYear ? 'secondary' : 'ghost'"
            class="h-8 px-2.5 text-xs font-medium"
            @click="selectPeriod(p)"
          >
            {{ $t(`income.chart.periods.${p}`) }}
          </Button>

          <div v-if="availableFinancialYears.length > 0" class="ml-1 w-32">
            <Select :model-value="selectedFinancialYear || ''" @update:model-value="selectFinancialYear">
              <SelectTrigger class="h-8 text-xs">
                <SelectValue :placeholder="$t('income.chart.selectFy')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="fy in availableFinancialYears" :key="fy" :value="fy">{{ fy }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div ref="containerRef" class="relative w-full" style="height: 220px">
        <svg
          v-if="chartReady && chartPoints.length > 0"
          ref="svgRef"
          class="h-full w-full select-none"
          :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        >
          <g :transform="`translate(${margin.left}, ${margin.top})`">
            <line :x1="0" :y1="yZero" :x2="innerWidth" :y2="yZero" class="stroke-border" stroke-width="1" />

            <!-- Cumulative line -->
            <path v-if="viewMode === 'cumulative'" :d="linePath" fill="none" :stroke="lineColor" stroke-width="2" />

            <g v-for="(point, i) in chartPoints" :key="point.dateKey">
              <rect
                v-if="viewMode === 'monthly' && point.value !== 0"
                :x="getNetBarX(point)"
                :y="getBarY(point.value)"
                :width="getNetBarWidth(point)"
                :height="getBarHeight(point.value)"
                :fill="point.value >= 0 ? barPositiveColor : barNegativeColor"
                rx="3"
                ry="3"
                class="transition-opacity duration-150"
                :class="{ 'opacity-80': hoveredIndex !== null && hoveredIndex !== i }"
              />

              <rect
                v-if="viewMode === 'monthly' && point.deductions > 0"
                :x="getDeductionBarX(point)"
                :y="getBarY(point.deductions)"
                :width="deductionBarWidth"
                :height="getBarHeight(point.deductions)"
                :fill="barNegativeColor"
                rx="3"
                ry="3"
                class="transition-opacity duration-150"
                :class="{ 'opacity-80': hoveredIndex !== null && hoveredIndex !== i }"
              />

              <circle
                v-if="viewMode === 'cumulative'"
                :cx="getColumnCenterX(point.dateKey)"
                :cy="yScale(point.value)"
                r="3"
                :fill="lineColor"
              />

              <text
                :x="getColumnCenterX(point.dateKey)"
                :y="innerHeight + 24"
                text-anchor="middle"
                class="fill-muted-foreground text-xs font-normal select-none"
                :class="{ 'fill-primary font-semibold': point.isCurrent }"
              >
                {{ point.month }}
              </text>

              <rect
                :x="xScale(point.dateKey)"
                :y="0"
                :width="xScale.bandwidth()"
                :height="chartHeight"
                fill="transparent"
                class="cursor-pointer"
                @mouseenter="(e) => handleHover(point, i, e)"
                @mousemove="handleMouseMove"
                @mouseleave="handleLeave"
                @touchstart.passive="(e) => handleTouch(point, i, e)"
              />
            </g>
          </g>
        </svg>

        <div v-else-if="chartReady" class="text-muted-foreground flex h-full items-center justify-center text-sm">
          {{ $t('income.chart.empty') }}
        </div>

        <div
          v-show="tooltip.visible"
          ref="tooltipRef"
          class="pointer-events-none absolute z-20"
          :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
        >
          <ChartTooltip>
            <ChartTooltipHeader>{{ tooltip.monthLabel }}</ChartTooltipHeader>
            <ChartTooltipRow
              :label="viewMode === 'cumulative' ? $t('income.chart.cumulativeNet') : $t('income.chart.net')"
              :value="formatSignedCurrency(tooltip.value)"
              value-class="text-app-income-color font-semibold"
            />
            <ChartTooltipRow
              v-if="viewMode === 'monthly'"
              :label="$t('income.chart.gross')"
              :value="formatCurrency(tooltip.gross)"
            />
            <ChartTooltipRow
              v-if="viewMode === 'monthly'"
              :label="$t('income.chart.deductions')"
              :value="formatCurrency(tooltip.deductions)"
            />
          </ChartTooltip>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ChartTooltip, ChartTooltipHeader, ChartTooltipRow } from '@/components/common/charts/chart-tooltip';
import { Button } from '@/components/lib/ui/button';
import { Card } from '@/components/lib/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/lib/ui/select';
import { useChartTooltipPosition } from '@/composable/charts/use-chart-tooltip-position';
import { useIncomeTimeseries } from '@/composable/data-queries/income/timeseries';
import { useFormatCurrency } from '@/composable/formatters';
import { AlertCircleIcon } from '@lucide/vue';
import { useResizeObserver } from '@vueuse/core';
import * as d3 from 'd3';
import { computed, reactive, ref, toRef } from 'vue';

import {
  computeIncomeYDomain,
  getIncomeChartSeries,
  type IncomeChartPoint,
  type IncomeChartViewMode,
} from '../utils/income-series';

const props = withDefaults(defineProps<{ sourceId?: string }>(), { sourceId: 'all' });
const sourceId = toRef(props, 'sourceId');

const PERIOD_PRESETS = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'All'] as const;
type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const viewMode = ref<IncomeChartViewMode>('monthly');
const selectedPeriod = ref<PeriodPreset | ''>('');
const selectedFinancialYear = ref<string | null>(null);

const queryParams = computed(() => {
  const params: { period?: string; financialYear?: string } = {};
  if (selectedFinancialYear.value) {
    params.financialYear = selectedFinancialYear.value;
  } else {
    params.period = selectedPeriod.value || '1Y';
  }
  return params;
});

const { data: timeseries, isLoading, isError } = useIncomeTimeseries(sourceId, queryParams);

const availableFinancialYears = computed(() => timeseries.value?.availableFinancialYears ?? []);
const months = computed(() => timeseries.value?.months ?? []);
const currencyCode = computed(() => timeseries.value?.currencyCode || 'INR');

const selectPeriod = (period: PeriodPreset) => {
  selectedFinancialYear.value = null;
  selectedPeriod.value = period;
};

const selectFinancialYear = (fy: unknown) => {
  if (typeof fy === 'string' && fy) {
    selectedFinancialYear.value = fy;
    selectedPeriod.value = '';
  }
};

const { formatAmountByCurrencyCode } = useFormatCurrency();
const formatCurrency = (val: number) => formatAmountByCurrencyCode(val, currencyCode.value);
const formatSignedCurrency = (val: number) => {
  const formatted = formatCurrency(Math.abs(val));
  if (val > 0) return `+${formatted}`;
  if (val < 0) return `-${formatted}`;
  return formatted;
};

const chartPoints = computed<IncomeChartPoint[]>(() =>
  getIncomeChartSeries({ months: months.value, viewMode: viewMode.value }),
);

const formattedHeadline = computed(() => {
  if (viewMode.value === 'cumulative') {
    const last = chartPoints.value.at(-1);
    return formatSignedCurrency(last?.value ?? 0);
  }
  return formatSignedCurrency(timeseries.value?.totalNet ?? 0);
});

// Chart Dimensions & Scales
const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const tooltipRef = ref<HTMLDivElement | null>(null);

const chartWidth = ref(700);
const chartHeight = 220;
const margin = { top: 20, right: 16, bottom: 40, left: 16 };

const chartReady = computed(() => chartWidth.value > 0);
const innerWidth = computed(() => Math.max(100, chartWidth.value - margin.left - margin.right));
const innerHeight = computed(() => chartHeight - margin.top - margin.bottom);

useResizeObserver(containerRef, (entries) => {
  const entry = entries[0];
  if (entry) chartWidth.value = Math.max(280, entry.contentRect.width);
});

const barPositiveColor = '#00d09c';
const barNegativeColor = '#eb5b3c';
const lineColor = '#00d09c';

const xScale = computed(() => {
  const keys = chartPoints.value.map((p) => p.dateKey);
  return d3.scaleBand().domain(keys).range([0, innerWidth.value]).padding(0.35);
});

const barWidth = computed(() => Math.min(22, Math.max(6, xScale.value.bandwidth() * 0.75)));
const BAR_PAIR_GAP = 2;
const deductionBarWidth = computed(() => Math.max(4, barWidth.value * 0.55));

const getColumnCenterX = (dateKey: string) => (xScale.value(dateKey) ?? 0) + xScale.value.bandwidth() / 2;

/** When a month has a deduction, the net bar shrinks and shifts left to make room for the red deduction bar beside it. */
const getNetBarWidth = (point: IncomeChartPoint) => (point.deductions > 0 ? deductionBarWidth.value : barWidth.value);

const getNetBarX = (point: IncomeChartPoint) => {
  const centerX = getColumnCenterX(point.dateKey);
  if (point.deductions > 0) {
    return centerX - deductionBarWidth.value - BAR_PAIR_GAP / 2;
  }
  return centerX - barWidth.value / 2;
};

const getDeductionBarX = (point: IncomeChartPoint) => getColumnCenterX(point.dateKey) + BAR_PAIR_GAP / 2;

const yScale = computed(() => {
  const values = chartPoints.value.flatMap((p) => (viewMode.value === 'monthly' ? [p.value, p.deductions] : [p.value]));
  const [yMin, yMax] = computeIncomeYDomain(values);
  return d3.scaleLinear().domain([yMin, yMax]).range([innerHeight.value, 0]);
});

const yZero = computed(() => yScale.value(0));

const getBarY = (value: number) => (value > 0 ? yScale.value(value) : yZero.value);
const getBarHeight = (value: number) => {
  if (value > 0) return Math.max(2, yZero.value - yScale.value(value));
  if (value < 0) return Math.max(2, yScale.value(value) - yZero.value);
  return 0;
};

const linePath = computed(() => {
  const line = d3
    .line<IncomeChartPoint>()
    .x((p) => getColumnCenterX(p.dateKey))
    .y((p) => yScale.value(p.value))
    .curve(d3.curveMonotoneX);
  return line(chartPoints.value) ?? '';
});

// Tooltip Interaction
const hoveredIndex = ref<number | null>(null);

const tooltip = reactive<{
  visible: boolean;
  x: number;
  y: number;
  monthLabel: string;
  value: number;
  gross: number;
  deductions: number;
}>({
  visible: false,
  x: 0,
  y: 0,
  monthLabel: '',
  value: 0,
  gross: 0,
  deductions: 0,
});

const { updateTooltipPosition } = useChartTooltipPosition({ containerRef, tooltipRef, tooltip });

const findRawMonth = (dateKey: string) => months.value.find((m) => m.dateKey === dateKey);

const showTooltip = (point: IncomeChartPoint, index: number) => {
  hoveredIndex.value = index;
  tooltip.visible = true;
  tooltip.monthLabel = `${point.month} ${point.year}`;
  tooltip.value = point.value;
  const raw = findRawMonth(point.dateKey);
  tooltip.gross = raw?.gross ?? 0;
  tooltip.deductions = raw?.deductions ?? 0;
};

const handleHover = (point: IncomeChartPoint, index: number, event: MouseEvent) => {
  showTooltip(point, index);
  updateTooltipPosition(event);
};

const handleMouseMove = (event: MouseEvent) => {
  if (tooltip.visible) updateTooltipPosition(event);
};

const handleLeave = () => {
  hoveredIndex.value = null;
  tooltip.visible = false;
};

const handleTouch = (point: IncomeChartPoint, index: number, event: TouchEvent) => {
  const touch = event.touches[0];
  if (!touch) return;
  showTooltip(point, index);
  updateTooltipPosition({ clientX: touch.clientX, clientY: touch.clientY });
};
</script>
