<template>
  <div>
    <p class="mb-1.5 text-sm font-medium">{{ $t('forms.salaryCredit.linkTransactionLabel') }}</p>

    <div v-if="modelValue" class="bg-muted/40 flex items-center justify-between gap-2 rounded-md px-3 py-2">
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm">{{ modelValue.note || $t('income.credits.linkDialog.noNote') }}</span>
        <span class="text-muted-foreground text-xs">{{ format(new Date(modelValue.time), 'd MMM yyyy') }}</span>
      </span>
      <span class="text-app-income-color shrink-0 text-sm font-semibold tabular-nums">
        {{ formatAmountByCurrencyCode(modelValue.amount, modelValue.currencyCode) }}
      </span>
      <UiButton
        type="button"
        variant="ghost"
        size="icon-sm"
        class="shrink-0"
        :aria-label="$t('forms.salaryCredit.removeLinkedTransaction')"
        @click="emit('update:modelValue', null)"
      >
        <XIcon class="size-3.5" />
      </UiButton>
    </div>

    <ResponsiveDialog v-else v-model:open="isPickerOpen" dialog-content-class="sm:max-w-lg" no-internal-scroll>
      <template #trigger>
        <UiButton type="button" variant="outline" size="sm">
          <LinkIcon class="size-3.5" />
          {{ $t('forms.salaryCredit.linkTransactionButton') }}
        </UiButton>
      </template>

      <template #title>{{ $t('income.credits.linkDialog.title') }}</template>
      <template #description>{{ $t('income.credits.linkDialog.description') }}</template>

      <TransactionPickerList :currency-code="currencyCode" :active="isPickerOpen" @select="handleSelect" />
    </ResponsiveDialog>
  </div>
</template>

<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { useFormatCurrency } from '@/composable/formatters';
import type { TransactionModel } from '@bt/shared/types/db-models';
import { LinkIcon, XIcon } from '@lucide/vue';
import { format } from 'date-fns';
import { ref } from 'vue';

import TransactionPickerList from './transaction-picker-list.vue';

defineProps<{
  modelValue: TransactionModel | null;
  currencyCode: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [transaction: TransactionModel | null] }>();

const { formatAmountByCurrencyCode } = useFormatCurrency();
const isPickerOpen = ref(false);

const handleSelect = (tx: TransactionModel) => {
  emit('update:modelValue', tx);
  isPickerOpen.value = false;
};
</script>
