<template>
  <div v-if="chartData.length < 2" class="flex flex-col items-center justify-center gap-2 py-16 text-center">
    <ChartLineIcon class="text-muted-foreground size-8" />
    <p class="text-muted-foreground text-sm">{{ $t('loans.valueHistory.states.noData') }}</p>
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
          :color="chartColors.principal"
          :label="principalLabel"
          :value="formatCurrency(tooltip.principal)"
        />
        <ChartTooltipRow
          :color="chartColors.interest"
          :label="interestLabel"
          :value="formatCurrency(tooltip.interest)"
        />
        <ChartTooltipRow
          v-if="tooltip.extra"
          :color="chartColors.text"
          :label="tooltip.extra.label"
          :value="formatCurrency(tooltip.extra.value)"
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
import { useResizeObserver } from '@vueuse/core';
import * as d3 from 'd3';
import { ChartLineIcon } from '@lucide/vue';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { LoanAmortizationPoint } from '../utils/loan-amortization-series';

const props = withDefaults(
  defineProps<{
    points: LoanAmortizationPoint[];
    mode: 'balance' | 'payment';
    currencyCode?: string;
    today?: Date;
  }>(),
  {
    currencyCode: 'USD',
    today: () => new Date(),
  },
);

const { t } = useI18n();
const { formatAmountByCurrencyCode, getCurrencySymbol } = useFormatCurrency();

const formatCurrency = (val: number) => formatAmountByCurrencyCode(val, props.currencyCode);
const currencySymbol = computed(() => getCurrencySymbol(props.currencyCode));

const principalLabel = computed(() =>
  props.mode === 'balance' ? t('loans.valueHistory.remainingBalance') : t('loans.valueHistory.monthlyPrincipal'),
);

const interestLabel = computed(() =>
  props.mode === 'balance' ? t('loans.valueHistory.cumulativeInterest') : t('loans.valueHistory.monthlyInterest'),
);

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const tooltipRef = ref<HTMLDivElement | null>(null);

const tooltip = reactive<{
  visible: boolean;
  x: number;
  y: number;
  date: string;
  principal: number;
  interest: number;
  extra?: { label: string; value: number } | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  date: '',
  principal: 0,
  interest: 0,
  extra: null,
});

const { updateTooltipPosition } = useChartTooltipPosition({ containerRef, tooltipRef, tooltip });

const chartColors = ref({
  ...getChartColors(),
  principal: 'var(--loan-principal, rgb(59, 130, 246))',
  interest: 'var(--loan-interest, rgb(245, 158, 11))',
});

interface ChartPoint {
  date: number;
  principal: number;
  interest: number;
  raw: LoanAmortizationPoint;
}

const chartData = computed<ChartPoint[]>(() =>
  props.points
    .map((p) => ({
      date: p.date.getTime(),
      principal: props.mode === 'balance' ? p.remainingPrincipal : p.monthlyPrincipal,
      interest: props.mode === 'balance' ? p.cumulativeInterest : p.monthlyInterest,
      raw: p,
    }))
    .sort((a, b) => a.date - b.date),
);

const renderChart = () => {
  if (!svgRef.value || !containerRef.value || chartData.value.length < 2) return;

  const colors = getChartColors();
  chartColors.value = {
    ...colors,
    principal: 'var(--loan-principal, rgb(59, 130, 246))',
    interest: 'var(--loan-interest, rgb(245, 158, 11))',
  };

  const svg = d3.select(svgRef.value);
  svg.selectAll('*').remove();

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;
  const margin = { top: 16, right: 18, bottom: 32, left: 54 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  if (innerWidth === 0 || innerHeight === 0) return;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(chartData.value, (d) => d.date) as [number, number])
    .range([0, innerWidth]);

  const allValues = chartData.value.flatMap((d) => [d.principal, d.interest]);
  const [yMinRaw, yMaxRaw] = d3.extent(allValues) as [number, number];
  const yPadding = (yMaxRaw - yMinRaw) * 0.1 || Math.abs(yMaxRaw) * 0.1 || 100;
  const yScale = d3
    .scaleLinear()
    .domain([0, yMaxRaw + yPadding])
    .nice(5)
    .range([innerHeight, 0]);

  // Horizontal gridlines
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

  // Gradients
  const principalGradId = `loan-principal-grad-${Math.random().toString(36).slice(2)}`;
  const interestGradId = `loan-interest-grad-${Math.random().toString(36).slice(2)}`;
  const defs = svg.append('defs');

  const principalGrad = defs
    .append('linearGradient')
    .attr('id', principalGradId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  principalGrad
    .append('stop')
    .attr('offset', '0%')
    .attr('stop-color', 'var(--loan-principal)')
    .attr('stop-opacity', 0.3);
  principalGrad
    .append('stop')
    .attr('offset', '100%')
    .attr('stop-color', 'var(--loan-principal)')
    .attr('stop-opacity', 0);

  const interestGrad = defs
    .append('linearGradient')
    .attr('id', interestGradId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  interestGrad
    .append('stop')
    .attr('offset', '0%')
    .attr('stop-color', 'var(--loan-interest)')
    .attr('stop-opacity', 0.25);
  interestGrad.append('stop').attr('offset', '100%').attr('stop-color', 'var(--loan-interest)').attr('stop-opacity', 0);

  // Area generators
  const principalArea = d3
    .area<ChartPoint>()
    .x((d) => xScale(d.date))
    .y0(innerHeight)
    .y1((d) => yScale(d.principal))
    .curve(d3.curveMonotoneX);

  const interestArea = d3
    .area<ChartPoint>()
    .x((d) => xScale(d.date))
    .y0(innerHeight)
    .y1((d) => yScale(d.interest))
    .curve(d3.curveMonotoneX);

  // Line generators
  const principalLine = d3
    .line<ChartPoint>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.principal))
    .curve(d3.curveMonotoneX);

  const interestLine = d3
    .line<ChartPoint>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.interest))
    .curve(d3.curveMonotoneX);

  // Draw areas
  g.append('path').datum(chartData.value).attr('fill', `url(#${principalGradId})`).attr('d', principalArea);
  g.append('path').datum(chartData.value).attr('fill', `url(#${interestGradId})`).attr('d', interestArea);

  // Draw lines
  g.append('path')
    .datum(chartData.value)
    .attr('fill', 'none')
    .attr('stroke', 'var(--loan-interest)')
    .attr('stroke-width', 2.5)
    .attr('d', interestLine);

  g.append('path')
    .datum(chartData.value)
    .attr('fill', 'none')
    .attr('stroke', 'var(--loan-principal)')
    .attr('stroke-width', 2.5)
    .attr('d', principalLine);

  // Today reference line if in domain
  const todayTime = props.today.getTime();
  const [minDate, maxDate] = xScale.domain() as [Date, Date];
  if (todayTime >= minDate.getTime() && todayTime <= maxDate.getTime()) {
    const todayX = xScale(todayTime);
    const todayGroup = g.append('g').attr('class', 'today-marker');

    todayGroup
      .append('line')
      .attr('x1', todayX)
      .attr('x2', todayX)
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', colors.text)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.6);

    todayGroup
      .append('text')
      .attr('x', todayX)
      .attr('y', -4)
      .attr('text-anchor', 'middle')
      .attr('fill', colors.text)
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .text(t('loans.valueHistory.today'));
  }

  // X-Axis
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .ticks(Math.min(7, chartData.value.length))
        .tickFormat((d) => (d as Date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })),
    )
    .call((axis) => {
      axis.select('.domain').attr('stroke', colors.grid).attr('stroke-opacity', 0.4);
      axis.selectAll('.tick line').attr('stroke', colors.grid).attr('stroke-opacity', 0.4);
      axis.selectAll('.tick text').attr('fill', colors.text).attr('font-size', '11px');
    });

  // Y-Axis
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

  // Hover indicator elements
  const hoverLine = g
    .append('line')
    .attr('stroke', colors.text)
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('y1', 0)
    .attr('y2', innerHeight)
    .style('opacity', 0);

  const hoverDotPrincipal = g
    .append('circle')
    .attr('r', 5)
    .attr('fill', 'var(--loan-principal)')
    .attr('stroke', 'var(--card)')
    .attr('stroke-width', 2)
    .style('opacity', 0);

  const hoverDotInterest = g
    .append('circle')
    .attr('r', 5)
    .attr('fill', 'var(--loan-interest)')
    .attr('stroke', 'var(--card)')
    .attr('stroke-width', 2)
    .style('opacity', 0);

  const bisect = d3.bisector<ChartPoint, number>((d) => d.date).left;

  // Transparent hover overlay
  g.append('rect')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'crosshair')
    .on('mouseenter', () => {
      hoverLine.style('opacity', 0.6);
      hoverDotPrincipal.style('opacity', 1);
      hoverDotInterest.style('opacity', 1);
    })
    .on('mousemove', (event: MouseEvent) => {
      const [mouseX] = d3.pointer(event);
      const x0 = xScale.invert(mouseX).getTime();
      const index = bisect(chartData.value, x0, 1);
      const d0 = chartData.value[index - 1];
      const d1 = chartData.value[index];
      if (!d0) return;

      const d = d1 && x0 - d0.date > d1.date - x0 ? d1 : d0;

      const pX = xScale(d.date);
      hoverLine.attr('x1', pX).attr('x2', pX);
      hoverDotPrincipal.attr('cx', pX).attr('cy', yScale(d.principal));
      hoverDotInterest.attr('cx', pX).attr('cy', yScale(d.interest));

      tooltip.date = new Date(d.date).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      });
      tooltip.principal = d.principal;
      tooltip.interest = d.interest;

      if (props.mode === 'balance') {
        tooltip.extra = {
          label: t('loans.valueHistory.cumulativePrincipal'),
          value: d.raw.cumulativePrincipal,
        };
      } else {
        tooltip.extra = {
          label: t('loans.valueHistory.monthlyPayment'),
          value: d.raw.monthlyPayment,
        };
      }

      tooltip.visible = true;
      updateTooltipPosition(event);
    })
    .on('mouseleave', () => {
      tooltip.visible = false;
      hoverLine.style('opacity', 0);
      hoverDotPrincipal.style('opacity', 0);
      hoverDotInterest.style('opacity', 0);
    });
};

useResizeObserver(containerRef, renderChart);

watch(
  [chartData, () => props.mode, () => props.currencyCode],
  async () => {
    await nextTick();
    renderChart();
  },
  { immediate: true },
);
</script>
