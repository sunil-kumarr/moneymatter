<template>
  <div v-if="chartData.length < 2" class="flex flex-col items-center justify-center gap-2 py-16 text-center">
    <ChartLineIcon class="text-muted-foreground size-8" />
    <p class="text-muted-foreground text-sm">{{ $t('investments.valueHistory.states.noData') }}</p>
  </div>

  <div v-else ref="containerRef" class="relative h-80 w-full">
    <svg ref="svgRef" class="h-full w-full"></svg>

    <div
      v-show="tooltip.visible"
      ref="tooltipRef"
      class="pointer-events-none absolute z-10"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <ChartTooltip>
        <ChartTooltipHeader>{{ tooltip.date }}</ChartTooltipHeader>
        <ChartTooltipRow
          v-if="tooltip.currentValue != null"
          :color="chartColors.primary"
          :label="$t('investments.valueHistory.current')"
          :value="formatCurrency(tooltip.currentValue)"
        />
        <ChartTooltipRow
          v-if="showFuture && tooltip.projectedValue != null"
          color="#10b981"
          :label="$t('investments.valueHistory.expectedMaturity')"
          :value="formatCurrency(tooltip.projectedValue)"
        />
        <ChartTooltipRow
          :color="chartColors.text"
          :label="$t('investments.valueHistory.invested')"
          :value="formatCurrency(tooltip.investedValue)"
        />
      </ChartTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChartTooltip, ChartTooltipHeader, ChartTooltipRow } from '@/components/common/charts/chart-tooltip';
import { getChartColors } from '@/composable/charts/chart-colors';
import { formatAxisCurrency } from '@/composable/charts/format-axis-currency';
import { useChartTooltipPosition } from '@/composable/charts/use-chart-tooltip-position';
import { useFormatCurrency } from '@/composable/formatters';
import type { PortfolioValueHistoryItem } from '@bt/shared/types/investments/portfolio-value-history.model';
import * as d3 from 'd3';
import { parseISO } from 'date-fns';
import { ChartLineIcon } from '@lucide/vue';
import { useResizeObserver } from '@vueuse/core';
import { computed, nextTick, reactive, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    points: PortfolioValueHistoryItem[];
    currencyCode?: string;
    showFuture?: boolean;
  }>(),
  {
    showFuture: true,
  },
);

const { formatBaseCurrency, formatAmountByCurrencyCode, getCurrencySymbol } = useFormatCurrency();

const formatCurrency = (val: number) =>
  props.currencyCode ? formatAmountByCurrencyCode(val, props.currencyCode) : formatBaseCurrency(val);

const currencySymbol = computed(() => getCurrencySymbol(props.currencyCode));

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const tooltipRef = ref<HTMLDivElement | null>(null);

const tooltip = reactive<{
  visible: boolean;
  x: number;
  y: number;
  date: string;
  currentValue: number | null;
  investedValue: number;
  projectedValue: number | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  date: '',
  currentValue: 0,
  investedValue: 0,
  projectedValue: null,
});
const { updateTooltipPosition } = useChartTooltipPosition({ containerRef, tooltipRef, tooltip });

const chartColors = ref(getChartColors());

type ChartPoint = {
  date: number;
  currentValue: number | null;
  investedValue: number;
  projectedValue: number | null;
};

const chartData = computed<ChartPoint[]>(() => {
  let pts = props.points;
  if (!props.showFuture) {
    pts = pts.filter((point) => point.currentValue != null);
  }

  return pts
    .map((point) => ({
      date: parseISO(point.date).getTime(),
      currentValue: point.currentValue != null ? point.currentValue : null,
      investedValue: point.investedValue,
      projectedValue: props.showFuture && point.projectedValue != null ? point.projectedValue : null,
    }))
    .sort((a, b) => a.date - b.date);
});

const renderChart = () => {
  if (!svgRef.value || !containerRef.value || chartData.value.length < 2) return;

  const colors = getChartColors();
  chartColors.value = colors;
  const svg = d3.select(svgRef.value);
  svg.selectAll('*').remove();

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;
  const margin = { top: 10, right: 16, bottom: 30, left: 48 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(chartData.value, (d) => d.date) as [number, number])
    .range([0, innerWidth]);

  const allValues = chartData.value.flatMap((d) => [
    ...(d.currentValue != null ? [d.currentValue] : []),
    d.investedValue,
    ...(props.showFuture && d.projectedValue != null ? [d.projectedValue] : []),
  ]);
  const [yMinRaw, yMaxRaw] = d3.extent(allValues) as [number, number];
  const yPadding = (yMaxRaw - yMinRaw) * 0.1 || Math.abs(yMaxRaw) * 0.1 || 100;
  const yScale = d3
    .scaleLinear()
    .domain([yMinRaw - yPadding, yMaxRaw + yPadding])
    .nice(5)
    .range([innerHeight, 0]);

  g.append('g')
    .attr('class', 'grid')
    .call(
      d3
        .axisLeft(yScale)
        .ticks(5)
        .tickSize(-innerWidth)
        .tickFormat(() => ''),
    )
    .call((grid) => {
      grid.select('.domain').remove();
      grid.selectAll('.tick line').attr('stroke', colors.grid).attr('stroke-opacity', 0.4);
    });

  const gradientId = `investments-value-gradient-${Math.random().toString(36).slice(2)}`;
  const gradient = svg
    .append('defs')
    .append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  gradient.append('stop').attr('offset', '0%').attr('stop-color', 'var(--primary)').attr('stop-opacity', 0.35);
  gradient.append('stop').attr('offset', '100%').attr('stop-color', 'var(--primary)').attr('stop-opacity', 0);

  const currentPoints = chartData.value.filter((d) => d.currentValue != null);
  const projectedPoints = props.showFuture ? chartData.value.filter((d) => d.projectedValue != null) : [];

  if (currentPoints.length >= 2) {
    const area = d3
      .area<ChartPoint>()
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScale(d.currentValue!))
      .curve(d3.curveMonotoneX);

    const currentLine = d3
      .line<ChartPoint>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.currentValue!))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(currentPoints).attr('fill', `url(#${gradientId})`).attr('d', area);

    g.append('path')
      .datum(currentPoints)
      .attr('fill', 'none')
      .attr('stroke', 'var(--primary)')
      .attr('stroke-width', 2)
      .attr('d', currentLine);
  }

  // Invested capital line
  const investedLine = d3
    .line<ChartPoint>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.investedValue))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(chartData.value)
    .attr('fill', 'none')
    .attr('stroke', colors.text)
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3')
    .attr('d', investedLine);

  // Future projected maturity line
  if (projectedPoints.length >= 2) {
    const projectedLine = d3
      .line<ChartPoint>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.projectedValue!))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(projectedPoints)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,4')
      .attr('d', projectedLine);

    // Marker dot at final maturity date
    const finalPoint = projectedPoints[projectedPoints.length - 1]!;
    g.append('circle')
      .attr('cx', xScale(finalPoint.date))
      .attr('cy', yScale(finalPoint.projectedValue!))
      .attr('r', 4)
      .attr('fill', '#10b981')
      .attr('stroke', 'var(--card)')
      .attr('stroke-width', 1.5);
  }

  // "Today" marker line when chart extends into the future
  if (projectedPoints.length > 0 && currentPoints.length > 0) {
    const todayPoint = currentPoints[currentPoints.length - 1]!;
    const todayX = xScale(todayPoint.date);
    if (todayX > 10 && todayX < innerWidth - 10) {
      g.append('line')
        .attr('x1', todayX)
        .attr('x2', todayX)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', colors.grid)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');

      g.append('text')
        .attr('x', todayX)
        .attr('y', 12)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.text)
        .attr('font-size', '10px')
        .text('Today');
    }
  }

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .ticks(Math.min(6, chartData.value.length))
        .tickFormat((d) => (d as Date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    )
    .call((axis) => {
      axis.select('.domain').attr('stroke', colors.grid).attr('stroke-opacity', 0.4);
      axis.selectAll('.tick line').attr('stroke', colors.grid).attr('stroke-opacity', 0.4);
      axis.selectAll('.tick text').attr('fill', colors.text).attr('font-size', '11px');
    });

  g.append('g')
    .call(
      d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((d) => formatAxisCurrency({ value: d as number, symbol: currencySymbol.value })),
    )
    .call((axis) => {
      axis.select('.domain').remove();
      axis.selectAll('.tick line').remove();
      axis.selectAll('.tick text').attr('fill', colors.text).attr('font-size', '11px');
    });

  const bisect = d3.bisector<ChartPoint, number>((d) => d.date).left;

  const hoverDot = g
    .append('circle')
    .attr('r', 5)
    .attr('fill', 'var(--primary)')
    .attr('stroke', 'var(--card)')
    .attr('stroke-width', 2)
    .style('opacity', 0);

  const hoverLine = g
    .append('line')
    .attr('stroke', 'var(--primary)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('y1', 0)
    .attr('y2', innerHeight)
    .style('opacity', 0);

  g.append('rect')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'crosshair')
    .on('mouseenter', () => {
      hoverDot.style('opacity', 1);
      hoverLine.style('opacity', 0.5);
    })
    .on('mousemove', (event: MouseEvent) => {
      const [mouseX] = d3.pointer(event);
      const x0 = xScale.invert(mouseX).getTime();
      const index = bisect(chartData.value, x0, 1);
      const d0 = chartData.value[index - 1];
      const d1 = chartData.value[index];
      if (!d0) return;

      const d = d1 && x0 - d0.date > d1.date - x0 ? d1 : d0;
      const targetYVal =
        d.currentValue != null
          ? d.currentValue
          : props.showFuture && d.projectedValue != null
            ? d.projectedValue
            : d.investedValue;
      const dotColor =
        d.currentValue != null
          ? 'var(--primary)'
          : props.showFuture && d.projectedValue != null
            ? '#10b981'
            : colors.text;

      hoverDot.attr('cx', xScale(d.date)).attr('cy', yScale(targetYVal)).attr('fill', dotColor);
      hoverLine.attr('x1', xScale(d.date)).attr('x2', xScale(d.date)).attr('stroke', dotColor);

      tooltip.date = new Date(d.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      tooltip.currentValue = d.currentValue;
      tooltip.investedValue = d.investedValue;
      tooltip.projectedValue = d.projectedValue;
      tooltip.visible = true;

      updateTooltipPosition(event);
    })
    .on('mouseleave', () => {
      tooltip.visible = false;
      hoverDot.style('opacity', 0);
      hoverLine.style('opacity', 0);
    });
};

useResizeObserver(containerRef, renderChart);

watch(
  [chartData, () => props.showFuture],
  async () => {
    await nextTick();
    renderChart();
  },
  { immediate: true },
);
</script>
