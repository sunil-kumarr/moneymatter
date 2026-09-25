<script setup lang="ts">
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import FixedIncomeEventsList from '@/components/forms/fixed-income-events-list.vue';
import FixedIncomePositionForm from '@/components/forms/fixed-income-position-form.vue';
import { Button } from '@/components/lib/ui/button';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import {
  useDeleteFixedIncomePosition,
  useFixedIncomePositionMetrics,
} from '@/composable/data-queries/fixed-income/positions';
import { useFormatCurrency } from '@/composable/formatters';
import { getApiErrorMessage } from '@/js/errors';
import { captureException } from '@/lib/sentry';
import type { FixedIncomePositionModel } from '@bt/shared/types/investments';
import { ListIcon, PencilIcon, Trash2Icon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ position: FixedIncomePositionModel }>();
const emit = defineEmits<{ (e: 'changed'): void }>();

const { t } = useI18n();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const { formatAmountByCurrencyCode } = useFormatCurrency();

const { data: metrics } = useFixedIncomePositionMetrics(computed(() => props.position.id));

const editOpen = ref(false);
const eventsOpen = ref(false);
const deleteConfirmOpen = ref(false);

const deleteMutation = useDeleteFixedIncomePosition();

const confirmDelete = async () => {
  try {
    await deleteMutation.mutateAsync(props.position.id);
    addSuccessNotification('Position deleted');
    emit('changed');
  } catch (err) {
    addErrorNotification(
      getApiErrorMessage({
        e: err,
        t,
        conflictKey: 'common.somethingWentWrong',
        fallbackKey: 'common.somethingWentWrong',
      }),
    );
    captureException({
      error: err,
      context: { source: 'confirmDeleteFixedIncomePosition', positionId: props.position.id },
    });
  } finally {
    deleteConfirmOpen.value = false;
  }
};

const onSaved = () => {
  editOpen.value = false;
  emit('changed');
};
</script>

<template>
  <tr class="hover:bg-muted/30 text-sm transition-colors">
    <td class="px-3 py-2 font-medium">{{ position.name }}</td>
    <td class="text-muted-foreground px-3 py-2 capitalize">{{ position.instrumentType.replace('_', ' ') }}</td>
    <td class="px-3 py-2 text-right tabular-nums">
      {{ formatAmountByCurrencyCode(Number(position.principal), position.currencyCode) }}
    </td>
    <td class="text-app-income-color px-3 py-2 text-right tabular-nums">
      {{ metrics ? formatAmountByCurrencyCode(Number(metrics.accruedUnpaidInterest), position.currencyCode) : '—' }}
    </td>
    <td class="px-3 py-2 text-right font-medium tabular-nums">
      {{ metrics ? formatAmountByCurrencyCode(Number(metrics.currentValue), position.currencyCode) : '—' }}
    </td>
    <td class="text-muted-foreground px-3 py-2 text-right tabular-nums">
      {{ Number(position.interestRatePct).toFixed(2) }}%
    </td>
    <td class="px-3 py-2 text-right">
      <div class="flex justify-end gap-1">
        <Button variant="ghost" size="icon" class="size-8" aria-label="Events" @click="eventsOpen = true">
          <ListIcon class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" class="size-8" aria-label="Edit" @click="editOpen = true">
          <PencilIcon class="size-4" />
        </Button>
        <Button
          variant="ghost-destructive"
          size="icon"
          class="size-8"
          aria-label="Delete"
          @click="deleteConfirmOpen = true"
        >
          <Trash2Icon class="size-4" />
        </Button>
      </div>
    </td>
  </tr>

  <ResponsiveDialog v-model:open="editOpen">
    <template #title>Edit Position</template>
    <FixedIncomePositionForm
      :portfolio-id="position.portfolioId"
      :position="position"
      @saved="onSaved"
      @cancel="editOpen = false"
    />
  </ResponsiveDialog>

  <ResponsiveDialog v-model:open="eventsOpen" dialog-content-class="sm:max-w-[700px]">
    <template #title>{{ position.name }} — Events</template>
    <FixedIncomeEventsList :position="position" @changed="emit('changed')" />
  </ResponsiveDialog>

  <ResponsiveAlertDialog
    v-model:open="deleteConfirmOpen"
    confirm-label="Delete"
    confirm-variant="destructive"
    :confirm-disabled="deleteMutation.isPending.value"
    @confirm="confirmDelete"
  >
    <template #title>Delete Position</template>
    <template #description> Are you sure you want to delete "{{ position.name }}"? This cannot be undone. </template>
  </ResponsiveAlertDialog>
</template>
