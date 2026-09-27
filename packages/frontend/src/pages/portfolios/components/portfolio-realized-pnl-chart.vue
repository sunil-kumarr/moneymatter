<template>
  <Card class="border-border bg-card @container/realized-pnl overflow-hidden p-6">
    <!-- Loading Skeleton -->
    <div v-if="isLoading && !pnlData" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-2">
          <div class="bg-muted h-4 w-24 animate-pulse rounded" />
          <div class="bg-muted h-8 w-36 animate-pulse rounded" />
        </div>
        <div class="bg-muted h-8 w-64 animate-pulse rounded" />
      </div>
      <div class="bg-muted/50 h-52 w-full animate-pulse rounded-lg" />
      <div class="border-border/60 border-t border-dashed pt-4">
        <div class="flex items-center justify-between">
          <div class="bg-muted h-4 w-16 animate-pulse rounded" />
          <div class="bg-muted h-4 w-20 animate-pulse rounded" />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="isError" class="py-12 text-center">
      <div class="bg-destructive/10 mx-auto mb-3 flex size-10 items-center justify-center rounded-full">
        <AlertCircleIcon class="text-destructive-text size-5" />
      </div>
      <p class="text-destructive-text text-sm">{{ $t('portfolioDetail.realizedPnlChart.loadError') }}</p>
    </div>

    <!-- Content -->
    <div v-else class="space-y-4">
      <!-- Top Row: Realised P&L Header on Left, Period Selectors on Right -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-muted-foreground text-sm font-medium">
            {{ $t('portfolioDetail.realizedPnlChart.title') }}
          </p>
          <h3 class="text-2xl font-bold tracking-tight md:text-3xl" :class="totalPnlColorClass">
            {{ formattedTotalPnl }}
          </h3>
        </div>

        <!-- Period Selectors -->
        <div class="flex flex-wrap items-center gap-1.5">
          <Button
            v-for="p in INVESTMENT_HISTORY_PERIODS"
            :key="p"
            type="button"
            size="sm"
            :variant="selectedPeriod === p && !selectedFinancialYear ? 'secondary' : 'ghost'"
            class="h-8 px-2.5 text-xs font-medium"
            @click="selectPeriod(p)"
          >
            {{ $t(`investments.valueHistory.periods.${p}`) }}
          </Button>

          <!-- Financial Year Dropdown if available -->
          <div v-if="availableFinancialYears.length > 0" class="ml-1 w-32">
            <Select :model-value="selectedFinancialYear || ''" @update:model-value="selectFinancialYear">
              <SelectTrigger class="h-8 text-xs">
                <SelectValue :placeholder="$t('portfolioDetail.realizedPnlChart.selectFy')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="fy in availableFinancialYears" :key="fy" :value="fy">
                  {{ fy }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <!-- Monthly Bar Chart -->
      <div ref="containerRef" class="relative w-full" style="height: 220px">
        <svg
          v-if="chartReady && months.length > 0"
          ref="svgRef"
          class="h-full w-full select-none"
          :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        >
          <g :transform="`translate(${margin.left}, ${margin.top})`">
            <!-- Zero Baseline Line -->
            <line :x1="0" :y1="yZero" :x2="innerWidth" :y2="yZero" class="stroke-border" stroke-width="1" />

            <!-- Month Columns & Bars -->
            <g v-for="(m, i) in months" :key="m.dateKey">
              <!-- Baseline Tick -->
              <line
                :x1="getColumnCenterX(m.dateKey)"
                :y1="yZero - 3"
                :x2="getColumnCenterX(m.dateKey)"
                :y2="yZero + 3"
                class="stroke-border"
                stroke-width="1"
              />

              <!-- Hover Highlight Column -->
              <rect
                v-if="hoveredIndex === i"
                :x="xScale(m.dateKey)"
                :y="0"
                :width="xScale.bandwidth()"
                :height="innerHeight"
                fill="currentColor"
                class="text-muted/20 pointer-events-none"
                rx="4"
              />

              <!-- P&L Bar (Green for positive, Red for negative) -->
              <rect
                v-if="m.realizedPnl !== 0"
                :x="getBarX(m.dateKey)"
                :y="getBarY(m.realizedPnl)"
                :width="barWidth"
                :height="getBarHeight(m.realizedPnl)"
                :fill="m.realizedPnl > 0 ? barPositiveColor : barNegativeColor"
                rx="3"
                ry="3"
                class="transition-opacity duration-150"
                :class="{ 'opacity-80': hoveredIndex !== null && hoveredIndex !== i }"
              />

              <!-- Month Label at Bottom -->
              <text
                :x="getColumnCenterX(m.dateKey)"
                :y="innerHeight + 24"
                text-anchor="middle"
                class="fill-muted-foreground text-xs font-normal select-none"
              >
                {{ m.month }}
              </text>

              <!-- Interactive Hover Target -->
              <rect
                :x="xScale(m.dateKey)"
                :y="0"
                :width="xScale.bandwidth()"
                :height="chartHeight"
                fill="transparent"
                class="cursor-pointer"
                @mouseenter="(e) => handleHover(m, i, e)"
                @mousemove="handleMouseMove"
                @mouseleave="handleLeave"
                @touchstart.passive="(e) => handleTouch(m, i, e)"
              />
            </g>
          </g>
        </svg>

        <!-- Tooltip -->
        <div
          v-show="tooltip.visible"
          ref="tooltipRef"
          class="pointer-events-none absolute z-20"
          :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
        >
          <ChartTooltip>
            <ChartTooltipHeader>{{ tooltip.monthLabel }}</ChartTooltipHeader>
            <ChartTooltipRow
              :label="$t('portfolioDetail.realizedPnlChart.title')"
              :value="formatTooltipPnl(tooltip.realizedPnl)"
              :value-class="
                tooltip.realizedPnl >= 0
                  ? 'text-app-income-color font-semibold'
                  : 'text-app-expense-color font-semibold'
              "
            />
            <ChartTooltipRow
              :label="$t('portfolioDetail.realizedPnlChart.charges')"
              :value="formatCurrency(tooltip.charges)"
            />
            <ChartTooltipDivider />
            <ChartTooltipRow
              :label="$t('portfolioDetail.realizedPnlChart.netPnl')"
              :value="formatTooltipPnl(tooltip.netRealizedPnl)"
              :value-class="
                tooltip.netRealizedPnl >= 0
                  ? 'text-app-income-color font-semibold'
                  : 'text-app-expense-color font-semibold'
              "
            />
            <ChartTooltipRow
              v-if="tooltip.tradeCount > 0"
              :label="$t('portfolioDetail.realizedPnlChart.trades')"
              :value="String(tooltip.tradeCount)"
            />
          </ChartTooltip>
        </div>
      </div>

      <!-- Dashed Separator & Charges Row -->
      <div class="border-border/60 border-t border-dashed" />
      <div class="flex items-center justify-between pt-1">
        <span class="text-muted-foreground text-sm font-semibold">
          {{ $t('portfolioDetail.realizedPnlChart.charges') }}
        </span>
        <span
          class="text-foreground border-muted-foreground/60 cursor-help border-b border-dashed pb-0.5 text-sm font-semibold"
          :title="$t('portfolioDetail.realizedPnlChart.chargesHint')"
        >
          {{ formattedTotalCharges }}
        </span>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipHeader,
  ChartTooltipRow,
} from '@/components/common/charts/chart-tooltip';
import { Button } from '@/components/lib/ui/button';
import { Card } from '@/components/lib/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/lib/ui/select';
import { useChartTooltipPosition } from '@/composable/charts/use-chart-tooltip-position';
import { usePortfolioRealizedPnl } from '@/composable/data-queries/portfolio-realized-pnl';
import { useFormatCurrency } from '@/composable/formatters';
import {
  INVESTMENT_HISTORY_PERIODS,
  type InvestmentHistoryPeriod,
} from '@/pages/investments/composables/investment-value-history-period';
import type { MonthlyRealizedPnlItem } from '@bt/shared/types/investments/portfolio-realized-pnl.model';
import { AlertCircleIcon } from '@lucide/vue';
import { useResizeObserver } from '@vueuse/core';
import * as d3 from 'd3';
import { computed, reactive, ref, toRef } from 'vue';

const props = defineProps<{
  portfolioId: string;
}>();

const portfolioId = toRef(props, 'portfolioId');

const selectedPeriod = ref<InvestmentHistoryPeriod | ''>('1Y');
const selectedFinancialYear = ref<string | null>(null);

const queryParams = computed(() => {
  if (selectedFinancialYear.value) {
    return { financialYear: selectedFinancialYear.value };
  }
  return { period: selectedPeriod.value || '1Y' };
});

const { data: pnlData, isLoading, isError } = usePortfolioRealizedPnl(portfolioId, queryParams);

const availableFinancialYears = computed(() => pnlData.value?.availableFinancialYears ?? []);
const months = computed(() => pnlData.value?.months ?? []);
const currencyCode = computed(() => pnlData.value?.currencyCode || 'INR');

const selectPeriod = (period: InvestmentHistoryPeriod) => {
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

const formatTooltipPnl = (val: number) => formatSignedCurrency(val);

const totalRealizedPnl = computed(() => pnlData.value?.totalRealizedPnl ?? 0);
const totalCharges = computed(() => pnlData.value?.totalCharges ?? 0);

const formattedTotalPnl = computed(() => formatSignedCurrency(totalRealizedPnl.value));
const formattedTotalCharges = computed(() => formatCurrency(totalCharges.value));

const totalPnlColorClass = computed(() => {
  if (totalRealizedPnl.value > 0) return 'text-app-income-color';
  if (totalRealizedPnl.value < 0) return 'text-destructive-text';
  return 'text-foreground';
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
  if (entry) {
    chartWidth.value = Math.max(280, entry.contentRect.width);
  }
});

const barPositiveColor = '#00d09c';
const barNegativeColor = '#eb5b3c';

const xScale = computed(() => {
  const keys = months.value.map((m) => m.dateKey);
  return d3.scaleBand().domain(keys).range([0, innerWidth.value]).padding(0.35);
});

const barWidth = computed(() => {
  const bw = xScale.value.bandwidth();
  return Math.min(22, Math.max(6, bw * 0.75));
});

const getColumnCenterX = (dateKey: string) => {
  return (xScale.value(dateKey) ?? 0) + xScale.value.bandwidth() / 2;
};

const getBarX = (dateKey: string) => {
  return getColumnCenterX(dateKey) - barWidth.value / 2;
};

const yScale = computed(() => {
  const values = months.value.map((m) => m.realizedPnl);
  const maxPnl = Math.max(0, ...values);
  const minPnl = Math.min(0, ...values);

  let yMin: number;
  let yMax: number;

  if (maxPnl === 0 && minPnl === 0) {
    yMin = -100;
    yMax = 100;
  } else if (minPnl === 0) {
    yMin = 0;
    yMax = maxPnl * 1.15;
  } else if (maxPnl === 0) {
    yMin = minPnl * 1.15;
    yMax = 0;
  } else {
    const padMin = Math.abs(minPnl) * 0.15;
    const padMax = Math.abs(maxPnl) * 0.15;
    yMin = minPnl - padMin;
    yMax = maxPnl + padMax;
  }

  return d3.scaleLinear().domain([yMin, yMax]).range([innerHeight.value, 0]);
});

const yZero = computed(() => {
  return yScale.value(0);
});

const getBarY = (pnl: number) => {
  if (pnl > 0) {
    return yScale.value(pnl);
  }
  return yZero.value;
};

const getBarHeight = (pnl: number) => {
  if (pnl > 0) {
    return Math.max(2, yZero.value - yScale.value(pnl));
  }
  if (pnl < 0) {
    return Math.max(2, yScale.value(pnl) - yZero.value);
  }
  return 0;
};

// Tooltip Interaction
const hoveredIndex = ref<number | null>(null);

const tooltip = reactive<{
  visible: boolean;
  x: number;
  y: number;
  monthLabel: string;
  realizedPnl: number;
  charges: number;
  netRealizedPnl: number;
  tradeCount: number;
}>({
  visible: false,
  x: 0,
  y: 0,
  monthLabel: '',
  realizedPnl: 0,
  charges: 0,
  netRealizedPnl: 0,
  tradeCount: 0,
});

const { updateTooltipPosition } = useChartTooltipPosition({
  containerRef,
  tooltipRef,
  tooltip,
});

const handleHover = (m: MonthlyRealizedPnlItem, index: number, event: MouseEvent) => {
  hoveredIndex.value = index;
  tooltip.visible = true;
  tooltip.monthLabel = `${m.month} ${m.year}`;
  tooltip.realizedPnl = m.realizedPnl;
  tooltip.charges = m.charges;
  tooltip.netRealizedPnl = m.netRealizedPnl;
  tooltip.tradeCount = m.tradeCount;
  updateTooltipPosition(event);
};

const handleMouseMove = (event: MouseEvent) => {
  if (tooltip.visible) {
    updateTooltipPosition(event);
  }
};

const handleLeave = () => {
  hoveredIndex.value = null;
  tooltip.visible = false;
};

const handleTouch = (m: MonthlyRealizedPnlItem, index: number, event: TouchEvent) => {
  const touch = event.touches[0];
  if (!touch) return;
  hoveredIndex.value = index;
  tooltip.visible = true;
  tooltip.monthLabel = `${m.month} ${m.year}`;
  tooltip.realizedPnl = m.realizedPnl;
  tooltip.charges = m.charges;
  tooltip.netRealizedPnl = m.netRealizedPnl;
  tooltip.tradeCount = m.tradeCount;
  updateTooltipPosition({ clientX: touch.clientX, clientY: touch.clientY });
};
</script>
