<template>
  <ResponsiveDialog v-model:open="isOpen" dialog-content-class="sm:max-w-2xl">
    <template #trigger>
      <slot />
    </template>

    <template #title>{{
      duplicateFrom ? $t('income.dialog.duplicateCreditTitle') : $t('income.dialog.addCreditTitle')
    }}</template>

    <SalaryCreditForm
      :form-id="FORM_ID"
      :initial-credit="duplicateFrom"
      :component-template="componentTemplate"
      :currency-code="currencyCode"
      :submitting="createMutation.isPending.value"
      @submit="handleSubmit"
    />

    <template #footer>
      <div class="flex justify-end gap-2">
        <UiButton type="button" variant="ghost" :disabled="createMutation.isPending.value" @click="isOpen = false">
          {{ $t('forms.salaryCredit.cancelButton') }}
        </UiButton>
        <UiButton type="submit" :form="FORM_ID" class="min-w-30" :disabled="createMutation.isPending.value">
          {{
            createMutation.isPending.value
              ? $t('forms.salaryCredit.submitButtonLoading')
              : $t('forms.salaryCredit.submitButton')
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
import { useCreateIncomeCredit, useLinkTransactionsToCredit } from '@/composable/data-queries/income/credits';
import { captureException } from '@/lib/sentry';
import type { IncomeComponentTemplateItem, IncomeCreditModel } from '@bt/shared/types/income';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import SalaryCreditForm from './salary-credit-form.vue';

const FORM_ID = 'create-salary-credit-form';

const props = withDefaults(
  defineProps<{
    sourceId: string;
    currencyCode: string;
    componentTemplate?: IncomeComponentTemplateItem[] | null;
    /** When set, the form is pre-filled from this credit's type/components/notes (a fresh row, not an edit). */
    duplicateFrom?: IncomeCreditModel | null;
  }>(),
  { componentTemplate: null, duplicateFrom: null },
);

const { t } = useI18n();
const { addNotification } = useNotificationCenter();
const createMutation = useCreateIncomeCredit();
const linkMutation = useLinkTransactionsToCredit();

const isOpen = ref(false);

const handleSubmit = async (
  payload: CreateIncomeCreditPayload | UpdateIncomeCreditPayload,
  linkedTransactionId: string | null,
) => {
  try {
    const credit = await createMutation.mutateAsync({
      sourceId: props.sourceId,
      payload: payload as CreateIncomeCreditPayload,
    });
    addNotification({ text: t('forms.salaryCredit.notifications.createSuccess'), type: NotificationType.success });
    isOpen.value = false;

    if (linkedTransactionId) {
      try {
        await linkMutation.mutateAsync({ creditId: credit.id, transactionIds: [linkedTransactionId] });
      } catch (linkError) {
        addNotification({ text: t('income.credits.linkDialog.linkError'), type: NotificationType.error });
        captureException({ error: linkError, context: { source: 'createSalaryCreditDialog.link' } });
      }
    }
  } catch (error) {
    addNotification({ text: t('forms.salaryCredit.notifications.createError'), type: NotificationType.error });
    captureException({ error, context: { source: 'createSalaryCreditDialog' } });
  }
};
</script>
