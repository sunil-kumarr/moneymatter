<template>
  <ResponsiveDialog v-model:open="isOpen" dialog-content-class="sm:max-w-2xl">
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ $t('income.dialog.createTitle') }}</template>
    <template #description>{{ $t('income.dialog.createDescription') }}</template>

    <IncomeSourceForm :form-id="FORM_ID" :submitting="createMutation.isPending.value" @submit="handleSubmit" />

    <template #footer>
      <div class="flex justify-end gap-2">
        <UiButton type="button" variant="ghost" :disabled="createMutation.isPending.value" @click="isOpen = false">
          {{ $t('forms.incomeSource.cancelButton') }}
        </UiButton>
        <UiButton type="submit" :form="FORM_ID" class="min-w-30" :disabled="createMutation.isPending.value">
          {{
            createMutation.isPending.value
              ? $t('forms.incomeSource.submitButtonLoading')
              : $t('forms.incomeSource.submitButton')
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
import { useCreateIncomeSource } from '@/composable/data-queries/income/sources';
import { captureException } from '@/lib/sentry';
import { ROUTES_NAMES } from '@/routes';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import IncomeSourceForm from './income-source-form.vue';

const FORM_ID = 'create-income-source-form';

const router = useRouter();
const { t } = useI18n();
const { addNotification } = useNotificationCenter();
const createMutation = useCreateIncomeSource();

const isOpen = ref(false);

const handleSubmit = async (payload: CreateIncomeSourcePayload | UpdateIncomeSourcePayload) => {
  try {
    const source = await createMutation.mutateAsync(payload as CreateIncomeSourcePayload);
    await router.push({ name: ROUTES_NAMES.incomeSourceDetail, params: { sourceId: source.id } });
    addNotification({ text: t('forms.incomeSource.notifications.createSuccess'), type: NotificationType.success });
  } catch (error) {
    addNotification({ text: t('forms.incomeSource.notifications.createError'), type: NotificationType.error });
    captureException({ error, context: { source: 'createIncomeSourceDialog' } });
  }
};
</script>
