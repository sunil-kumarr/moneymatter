<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import FixedIncomePositionForm from '@/components/forms/fixed-income-position-form.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lib/ui/card';
import { useFixedIncomePositions } from '@/composable/data-queries/fixed-income/positions';
import { LandmarkIcon, PlusIcon } from '@lucide/vue';
import { ref, toRef } from 'vue';

import FixedIncomePositionRow from './fixed-income-position-row.vue';

const props = defineProps<{ portfolioId: string }>();
const portfolioId = toRef(props, 'portfolioId');

const { data: positions, isLoading, invalidate } = useFixedIncomePositions(portfolioId);

const isAddOpen = ref(false);

const onSaved = () => {
  isAddOpen.value = false;
  invalidate();
};
</script>

<template>
  <Card class="min-w-0">
    <CardHeader class="pb-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="bg-primary/10 flex size-9 items-center justify-center rounded-lg">
            <LandmarkIcon class="text-primary-text size-5" />
          </div>
          <CardTitle class="text-lg">Fixed Income</CardTitle>
        </div>
        <UiButton size="sm" @click="isAddOpen = true">
          <PlusIcon class="mr-1 size-4" />
          Add Position
        </UiButton>
      </div>
    </CardHeader>
    <CardContent class="pt-0">
      <div v-if="isLoading" class="text-muted-foreground py-8 text-center text-sm">Loading…</div>
      <div v-else-if="!positions || positions.length === 0" class="text-muted-foreground py-4 text-center text-sm">
        Track Fixed Deposits, Bonds, and Peer Loans for this portfolio.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-150">
          <thead class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            <tr>
              <th class="px-3 py-2 text-left">Name</th>
              <th class="px-3 py-2 text-left">Type</th>
              <th class="px-3 py-2 text-right">Principal</th>
              <th class="px-3 py-2 text-right">Interest</th>
              <th class="px-3 py-2 text-right">Current Value</th>
              <th class="px-3 py-2 text-right">Rate</th>
              <th class="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody class="divide-border divide-y">
            <FixedIncomePositionRow
              v-for="position in positions"
              :key="position.id"
              :position="position"
              @changed="invalidate"
            />
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>

  <ResponsiveDialog v-model:open="isAddOpen">
    <template #title>Add Fixed Income Position</template>
    <FixedIncomePositionForm :portfolio-id="portfolioId" @saved="onSaved" @cancel="isAddOpen = false" />
  </ResponsiveDialog>
</template>
