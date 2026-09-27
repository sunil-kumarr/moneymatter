<template>
  <ResponsiveAlertDialog
    v-model:open="isOpen"
    confirm-variant="destructive"
    :confirm-label="$t('income.dialog.deleteButton')"
    :confirm-disabled="deleteMutation.isPending.value"
    @confirm="handleDelete"
  >
    <template #title>{{ $t('income.dialog.deleteTitle') }}</template>
    <template #description>{{ $t('income.dialog.deleteDescription') }}</template>
  </ResponsiveAlertDialog>
</template>

<script setup lang="ts">
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useDeleteIncomeSource } from '@/composable/data-queries/income/sources';
import { captureException } from '@/lib/sentry';
import { useVModel } from '@vueuse/core';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ sourceId: string; open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean]; deleted: [] }>();

const { t } = useI18n();
const { addNotification } = useNotificationCenter();
const deleteMutation = useDeleteIncomeSource();
const isOpen = useVModel(props, 'open', emit, { passive: true });

const handleDelete = async () => {
  try {
    await deleteMutation.mutateAsync(props.sourceId);
    addNotification({ text: t('income.dialog.deleteSuccess'), type: NotificationType.success });
    isOpen.value = false;
    emit('deleted');
  } catch (error) {
    addNotification({ text: t('income.dialog.deleteError'), type: NotificationType.error });
    captureException({ error, context: { source: 'deleteIncomeSourceDialog' } });
  }
};
</script>
