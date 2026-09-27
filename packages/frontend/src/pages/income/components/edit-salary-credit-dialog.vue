<template>
  <ResponsiveDialog v-model:open="isOpen" dialog-content-class="sm:max-w-2xl">
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ $t('income.dialog.editCreditTitle') }}</template>

    <SalaryCreditForm
      :form-id="FORM_ID"
      mode="edit"
      :initial-credit="credit"
      :currency-code="currencyCode"
      :submitting="updateMutation.isPending.value"
      @submit="handleSubmit"
    />

    <template #footer>
      <div class="flex justify-end gap-2">
        <UiButton type="button" variant="ghost" :disabled="updateMutation.isPending.value" @click="isOpen = false">
          {{ $t('forms.salaryCredit.cancelButton') }}
        </UiButton>
        <UiButton type="submit" :form="FORM_ID" class="min-w-30" :disabled="updateMutation.isPending.value">
          {{
            updateMutation.isPending.value
              ? $t('forms.salaryCredit.submitButtonLoading')
              : $t('forms.salaryCredit.saveButton')
          }}
        </UiButton>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup lang="ts">
import type { CreateIncomeCreditPayload, UpdateIncomeCreditPayload } from '@/api/income/credits';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useUpdateIncomeCredit } from '@/composable/data-queries/income/credits';
import { captureException } from '@/lib/sentry';
import type { IncomeCreditModel } from '@bt/shared/types/income';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import SalaryCreditForm from './salary-credit-form.vue';

const FORM_ID = 'edit-salary-credit-form';

const props = defineProps<{ credit: IncomeCreditModel; currencyCode: string }>();
const emit = defineEmits<{ updated: [] }>();

const { t } = useI18n();
const { addNotification } = useNotificationCenter();
const updateMutation = useUpdateIncomeCredit();

const isOpen = ref(false);

const handleSubmit = async (
  payload: CreateIncomeCreditPayload | UpdateIncomeCreditPayload,
  _linkedTransactionId: string | null,
) => {
  try {
    await updateMutation.mutateAsync({ creditId: props.credit.id, payload: payload as UpdateIncomeCreditPayload });
    addNotification({ text: t('forms.salaryCredit.notifications.updateSuccess'), type: NotificationType.success });
    isOpen.value = false;
    emit('updated');
  } catch (error) {
    addNotification({ text: t('forms.salaryCredit.notifications.updateError'), type: NotificationType.error });
    captureException({ error, context: { source: 'editSalaryCreditDialog' } });
  }
};
</script>
