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
          :color="chartColors.primary"
          :label="$t('investments.valueHistory.current')"
          :value="formatBaseCurrency(tooltip.currentValue)"
        />
        <ChartTooltipRow
          :color="chartColors.text"
          :label="$t('investments.valueHistory.invested')"
          :value="formatBaseCurrency(tooltip.investedValue)"
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

const props = defineProps<{
  points: PortfolioValueHistoryItem[];
}>();

const { formatBaseCurrency, getCurrencySymbol } = useFormatCurrency();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const tooltipRef = ref<HTMLDivElement | null>(null);

const tooltip = reactive({ visible: false, x: 0, y: 0, date: '', currentValue: 0, investedValue: 0 });
const { updateTooltipPosition } = useChartTooltipPosition({ containerRef, tooltipRef, tooltip });

const chartColors = ref(getChartColors());

type ChartPoint = { date: number; currentValue: number; investedValue: number };

const chartData = computed<ChartPoint[]>(() =>
  props.points
    .map((point) => ({
      date: parseISO(point.date).getTime(),
      currentValue: point.currentValue,
      investedValue: point.investedValue,
    }))
    .sort((a, b) => a.date - b.date),
);

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

  const allValues = chartData.value.flatMap((d) => [d.currentValue, d.investedValue]);
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

  const area = d3
    .area<ChartPoint>()
    .x((d) => xScale(d.date))
    .y0(innerHeight)
    .y1((d) => yScale(d.currentValue))
    .curve(d3.curveMonotoneX);

  const currentLine = d3
    .line<ChartPoint>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.currentValue))
    .curve(d3.curveMonotoneX);

  const investedLine = d3
    .line<ChartPoint>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.investedValue))
    .curve(d3.curveMonotoneX);

  g.append('path').datum(chartData.value).attr('fill', `url(#${gradientId})`).attr('d', area);

  g.append('path')
    .datum(chartData.value)
    .attr('fill', 'none')
    .attr('stroke', colors.text)
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3')
    .attr('d', investedLine);

  g.append('path')
    .datum(chartData.value)
    .attr('fill', 'none')
    .attr('stroke', 'var(--primary)')
    .attr('stroke-width', 2)
    .attr('d', currentLine);

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
        .tickFormat((d) => formatAxisCurrency({ value: d as number, symbol: getCurrencySymbol() })),
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

      hoverDot.attr('cx', xScale(d.date)).attr('cy', yScale(d.currentValue));
      hoverLine.attr('x1', xScale(d.date)).attr('x2', xScale(d.date));

      tooltip.date = new Date(d.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      tooltip.currentValue = d.currentValue;
      tooltip.investedValue = d.investedValue;
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
  chartData,
  async () => {
    await nextTick();
    renderChart();
  },
  { immediate: true },
);
</script>
