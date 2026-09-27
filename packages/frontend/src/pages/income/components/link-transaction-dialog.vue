<template>
  <ResponsiveDialog v-model:open="isOpen" dialog-content-class="sm:max-w-lg" no-internal-scroll>
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ $t('income.credits.linkDialog.title') }}</template>
    <template #description>{{ $t('income.credits.linkDialog.description') }}</template>

    <TransactionPickerList
      :currency-code="currencyCode"
      :active="isOpen"
      :disabled="linkMutation.isPending.value"
      @select="handleLink"
    />
  </ResponsiveDialog>
</template>

<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useLinkTransactionsToCredit } from '@/composable/data-queries/income/credits';
import { captureException } from '@/lib/sentry';
import type { TransactionModel } from '@bt/shared/types/db-models';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import TransactionPickerList from './transaction-picker-list.vue';

const props = defineProps<{
  creditId: string;
  currencyCode: string;
}>();

const emit = defineEmits<{ linked: [] }>();

const { t } = useI18n();
const { addNotification } = useNotificationCenter();
const linkMutation = useLinkTransactionsToCredit();

const isOpen = ref(false);

const handleLink = async (tx: TransactionModel) => {
  try {
    await linkMutation.mutateAsync({ creditId: props.creditId, transactionIds: [tx.id] });
    addNotification({ text: t('income.credits.linkDialog.linkSuccess'), type: NotificationType.success });
    emit('linked');
    isOpen.value = false;
  } catch (error) {
    addNotification({ text: t('income.credits.linkDialog.linkError'), type: NotificationType.error });
    captureException({ error, context: { source: 'linkTransactionDialog' } });
  }
};
</script>
