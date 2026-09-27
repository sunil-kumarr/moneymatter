<template>
  <PageWrapper>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
      <h1 class="text-2xl tracking-wider">{{ $t('income.title') }}</h1>

      <CreateIncomeSourceDialog>
        <UiButton>
          <PlusIcon class="mr-2 size-4" />
          {{ $t('income.createButton') }}
        </UiButton>
      </CreateIncomeSourceDialog>
    </div>

    <template v-if="sourcesQuery.isLoading.value">
      <div class="mb-6 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        <Card v-for="i in 3" :key="i" class="overflow-hidden">
          <CardContent class="p-4">
            <div class="bg-muted h-7 w-28 animate-pulse rounded" />
            <div class="bg-muted mt-2 h-5 w-24 animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    </template>

    <template v-else-if="sourcesQuery.error.value">
      <div class="py-12 text-center">
        <div class="text-destructive-text mb-4">{{ $t('income.loadError') }}</div>
        <UiButton @click="sourcesQuery.refetch()">{{ $t('income.tryAgain') }}</UiButton>
      </div>
    </template>

    <template v-else-if="sources.length">
      <IncomeSummaryPanel source-id="all" class="mb-6" />
      <IncomeTimeseriesChart source-id="all" class="mb-6" />

      <section v-if="activeSources.length">
        <div class="mb-3 flex items-center gap-2 px-1">
          <h2 class="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            {{ $t('income.list.activeSectionTitle') }}
          </h2>
        </div>
        <div class="mb-6 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          <IncomeSourceCard v-for="source in activeSources" :key="source.id" :source="source" />
        </div>
      </section>

      <section v-if="endedSources.length" class="mt-8">
        <div class="mb-3 flex items-center gap-2 px-1">
          <h2 class="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            {{ $t('income.list.endedSectionTitle') }}
          </h2>
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          <IncomeSourceCard v-for="source in endedSources" :key="source.id" :source="source" />
        </div>
      </section>
    </template>

    <template v-else>
      <div class="py-16 text-center">
        <div class="mb-6">
          <div class="bg-muted mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <BriefcaseIcon class="text-muted-foreground size-8" />
          </div>
          <h3 class="text-foreground mb-2 text-xl font-semibold">{{ $t('income.empty.title') }}</h3>
          <p class="text-muted-foreground mx-auto max-w-md text-base">{{ $t('income.empty.description') }}</p>
        </div>
        <CreateIncomeSourceDialog>
          <UiButton size="lg">
            <PlusIcon class="size-4" />
            {{ $t('income.empty.createFirstButton') }}
          </UiButton>
        </CreateIncomeSourceDialog>
      </div>
    </template>
  </PageWrapper>
</template>

<script setup lang="ts">
import PageWrapper from '@/components/common/page-wrapper.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent } from '@/components/lib/ui/card';
import { useIncomeSources } from '@/composable/data-queries/income/sources';
import { BriefcaseIcon, PlusIcon } from '@lucide/vue';
import { computed } from 'vue';

import CreateIncomeSourceDialog from './components/create-income-source-dialog.vue';
import IncomeSourceCard from './components/income-source-card.vue';
import IncomeSummaryPanel from './components/income-summary-panel.vue';
import IncomeTimeseriesChart from './components/income-timeseries-chart.vue';
import { partitionIncomeSources } from './utils/income-source-partition';

const sourcesQuery = useIncomeSources();

const sources = computed(() => sourcesQuery.data.value ?? []);

const partitioned = computed(() => partitionIncomeSources({ sources: sources.value }));
const activeSources = computed(() => partitioned.value.active);
const endedSources = computed(() => partitioned.value.ended);
</script>
