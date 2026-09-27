<template>
  <ResponsiveDialog v-model:open="isOpen" dialog-content-class="sm:max-w-2xl">
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ $t('income.dialog.editTitle') }}</template>

    <IncomeSourceForm
      :form-id="FORM_ID"
      mode="edit"
      :initial-source="source"
      :submitting="updateMutation.isPending.value"
      @submit="handleSubmit"
    />

    <template #footer>
      <div class="flex justify-end gap-2">
        <UiButton type="button" variant="ghost" :disabled="updateMutation.isPending.value" @click="isOpen = false">
          {{ $t('forms.incomeSource.cancelButton') }}
        </UiButton>
        <UiButton type="submit" :form="FORM_ID" class="min-w-30" :disabled="updateMutation.isPending.value">
          {{
            updateMutation.isPending.value
              ? $t('forms.incomeSource.submitButtonLoading')
              : $t('forms.incomeSource.saveButton')
          }}
        </UiButton>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup lang="ts">
import type { CreateIncomeSourcePayload, UpdateIncomeSourcePayload } from '@/api/income/sources';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useUpdateIncomeSource } from '@/composable/data-queries/income/sources';
import { captureException } from '@/lib/sentry';
import type { IncomeSourceModel } from '@bt/shared/types/income';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import IncomeSourceForm from './income-source-form.vue';

const FORM_ID = 'edit-income-source-form';

const props = defineProps<{ source: IncomeSourceModel }>();
const emit = defineEmits<{ updated: [] }>();

const { t } = useI18n();
const { addNotification } = useNotificationCenter();
const updateMutation = useUpdateIncomeSource();

const isOpen = ref(false);

const handleSubmit = async (payload: CreateIncomeSourcePayload | UpdateIncomeSourcePayload) => {
  try {
    await updateMutation.mutateAsync({ sourceId: props.source.id, payload: payload as UpdateIncomeSourcePayload });
    addNotification({ text: t('forms.incomeSource.notifications.updateSuccess'), type: NotificationType.success });
    isOpen.value = false;
    emit('updated');
  } catch (error) {
    addNotification({ text: t('forms.incomeSource.notifications.updateError'), type: NotificationType.error });
    captureException({ error, context: { source: 'editIncomeSourceDialog' } });
  }
};
</script>
