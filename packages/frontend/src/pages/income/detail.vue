<template>
  <PageWrapper>
    <ResourceNotFound
      v-if="isNotFound"
      :title="$t('income.detail.notFoundTitle')"
      :description="$t('income.detail.notFoundDescription')"
      :link-label="$t('income.detail.backToList')"
      :link-to="{ name: ROUTES_NAMES.income }"
    />

    <template v-else>
      <div class="mb-8">
        <div class="mb-4">
          <router-link
            :to="{ name: ROUTES_NAMES.income }"
            class="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
          >
            <ChevronLeftIcon class="size-4" />
            <span>{{ $t('income.detail.backToList') }}</span>
          </router-link>
        </div>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <div class="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <BriefcaseIcon class="text-primary-text size-5" />
            </div>
            <div>
              <h1 v-if="source" class="text-2xl font-semibold tracking-tight">{{ source.name }}</h1>
              <h1 v-else-if="isLoading" class="text-2xl font-semibold tracking-tight">
                {{ $t('income.detail.loading') }}
              </h1>
              <p v-if="source && (source.employerName || source.jobTitle)" class="text-muted-foreground text-sm">
                {{ [source.jobTitle, source.employerName].filter(Boolean).join(' · ') }}
              </p>
            </div>
          </div>

          <div v-if="source" class="flex flex-wrap items-center gap-2">
            <EditIncomeSourceDialog :source="source" @updated="refetch">
              <UiButton variant="outline" size="sm">
                <PencilIcon class="size-4" />
                {{ $t('income.detail.actions.edit') }}
              </UiButton>
            </EditIncomeSourceDialog>

            <UiButton variant="destructive" size="sm" @click="isDeleteDialogOpen = true">
              <Trash2Icon class="size-4" />
              {{ $t('income.detail.actions.delete') }}
            </UiButton>
          </div>
        </div>
      </div>

      <div v-if="source" class="grid gap-6">
        <IncomeSummaryPanel :source-id="sourceId" />
        <IncomeTimeseriesChart :source-id="sourceId" />
        <SalaryCreditsList
          :source-id="sourceId"
          :currency-code="source.currencyCode"
          :component-template="source.componentTemplate"
        />
      </div>

      <div v-else-if="isLoading" class="py-12 text-center">
        <div
          class="border-primary/20 mb-4 inline-flex size-12 items-center justify-center rounded-full border-2 border-t-transparent"
        >
          <div class="bg-primary/20 size-6 animate-pulse rounded"></div>
        </div>
        <p class="text-muted-foreground">{{ $t('income.detail.loadingDetails') }}</p>
      </div>

      <div v-else-if="error" class="py-12 text-center">
        <div class="bg-destructive/10 mb-4 inline-flex size-12 items-center justify-center rounded-full">
          <AlertCircleIcon class="text-destructive-text size-6" />
        </div>
        <p class="text-destructive-text mb-4">{{ $t('income.detail.loadError') }}</p>
        <UiButton @click="refetch">{{ $t('income.detail.tryAgain') }}</UiButton>
      </div>

      <DeleteIncomeSourceDialog
        v-if="source"
        v-model:open="isDeleteDialogOpen"
        :source-id="source.id"
        @deleted="handleDeletion"
      />
    </template>
  </PageWrapper>
</template>

<script setup lang="ts">
import PageWrapper from '@/components/common/page-wrapper.vue';
import ResourceNotFound from '@/components/common/resource-not-found.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { useIncomeSource } from '@/composable/data-queries/income/sources';
import { isResourceMissingError } from '@/js/errors';
import { ROUTES_NAMES } from '@/routes/constants';
import { AlertCircleIcon, BriefcaseIcon, ChevronLeftIcon, PencilIcon, Trash2Icon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import DeleteIncomeSourceDialog from './components/delete-income-source-dialog.vue';
import EditIncomeSourceDialog from './components/edit-income-source-dialog.vue';
import IncomeSummaryPanel from './components/income-summary-panel.vue';
import IncomeTimeseriesChart from './components/income-timeseries-chart.vue';
import SalaryCreditsList from './components/salary-credits-list.vue';

const route = useRoute();
const router = useRouter();
const sourceId = computed(() => String(route.params.sourceId));

const { data: source, isLoading, isError, error, refetch } = useIncomeSource(sourceId, { retry: false });

const isNotFound = computed(() => isError.value && isResourceMissingError(error.value));

const isDeleteDialogOpen = ref(false);

const handleDeletion = () => {
  router.push({ name: ROUTES_NAMES.income });
};
</script>
