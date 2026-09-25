<template>
  <ResponsiveDialog v-model:open="isOpen">
    <template #title>{{ $t('dialogs.manualNavEntry.title') }}</template>
    <template #description>
      <i18n-t keypath="dialogs.manualNavEntry.description" tag="span">
        <template #symbol>
          <strong>{{ symbol }}</strong>
        </template>
      </i18n-t>
    </template>

    <div class="grid gap-4">
      <InputField
        v-model="price"
        type="number"
        step="any"
        min="0"
        :label="$t('dialogs.manualNavEntry.priceLabel', { currency: currencyCode })"
        :disabled="createManualPriceMutation.isPending.value"
      />

      <DateField
        v-model="date"
        :label="$t('dialogs.manualNavEntry.dateLabel')"
        :disabled="createManualPriceMutation.isPending.value"
      />
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UiButton variant="outline" :disabled="createManualPriceMutation.isPending.value" @click="isOpen = false">
          {{ $t('dialogs.manualNavEntry.cancelButton') }}
        </UiButton>
        <UiButton :disabled="!isValid" :loading="createManualPriceMutation.isPending.value" @click="handleSave">
          {{ $t('dialogs.manualNavEntry.saveButton') }}
        </UiButton>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import DateField from '@/components/fields/date-field.vue';
import InputField from '@/components/fields/input-field.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useCreateManualPrice } from '@/composable/data-queries/securities';
import { useVModel } from '@vueuse/core';
import { format } from 'date-fns';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  open: boolean;
  securityId: string;
  symbol: string;
  currencyCode: string;
}>();

const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();

const { t } = useI18n();
const { addNotification } = useNotificationCenter();
const createManualPriceMutation = useCreateManualPrice();

const isOpen = useVModel(props, 'open', emit, { passive: true });
const price = ref('');
const date = ref(new Date());

// The dialog stays mounted across rows, so each open resets the draft.
watch(
  () => props.open,
  (open) => {
    if (open) {
      price.value = '';
      date.value = new Date();
    }
  },
);

const isValid = computed(() => Number(price.value) > 0);

const handleSave = async () => {
  if (!isValid.value) return;

  try {
    await createManualPriceMutation.mutateAsync({
      securityId: props.securityId,
      price: Number(price.value),
      date: format(date.value, 'yyyy-MM-dd'),
    });

    addNotification({ text: t('dialogs.manualNavEntry.notifications.success'), type: NotificationType.success });
    isOpen.value = false;
  } catch (error) {
    addNotification({
      text: error instanceof Error ? error.message : t('dialogs.manualNavEntry.notifications.error'),
      type: NotificationType.error,
    });
  }
};
</script>
