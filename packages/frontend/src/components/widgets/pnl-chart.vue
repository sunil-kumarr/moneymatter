<template>
  <Card
    class="border-border bg-card @container/realized-pnl flex h-full flex-col justify-between overflow-hidden p-6"
    data-testid="widget-pnl-chart"
  >
    <PortfolioRealizedPnlChart is-dashboard-widget :show-portfolio-selector="true" />
  </Card>
</template>

<script setup lang="ts">
import { Card } from '@/components/lib/ui/card';
import PortfolioRealizedPnlChart from '@/pages/portfolios/components/portfolio-realized-pnl-chart.vue';

defineOptions({ name: 'pnl-chart-widget' });
</script>
