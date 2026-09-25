<script setup lang="ts">
import DateField from '@/components/fields/date-field.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import InputField from '@/components/fields/input-field.vue';
import TextareaField from '@/components/fields/textarea-field.vue';
import { Checkbox } from '@/components/lib/ui/checkbox';
import UiButton from '@/components/lib/ui/button/Button.vue';
import * as Select from '@/components/lib/ui/select';
import { getErrorMessage } from '@/common/utils/error-message';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useCreateFixedIncomeEvent, useFixedIncomePositionEvents } from '@/composable/data-queries/fixed-income/events';
import {
  FIXED_INCOME_CASH_FLOW_MODE,
  FIXED_INCOME_EVENT_TYPE,
  type FixedIncomeEventModel,
  type FixedIncomePositionModel,
} from '@bt/shared/types/investments';
import { format } from 'date-fns';
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { addNotification } = useNotificationCenter();

const props = defineProps<{
  position: FixedIncomePositionModel;
}>();

const emit = defineEmits<{
  (e: 'saved', event: FixedIncomeEventModel): void;
  (e: 'cancel'): void;
}>();

const { data: existingEvents } = useFixedIncomePositionEvents(computed(() => props.position.id));
const hasInitialInvestment = computed(() =>
  (existingEvents.value ?? []).some((ev) => ev.type === FIXED_INCOME_EVENT_TYPE.initial_investment),
);

const availableEventTypes = computed(() => {
  const all = [
    { value: FIXED_INCOME_EVENT_TYPE.initial_investment, label: 'Initial Investment' },
    { value: FIXED_INCOME_EVENT_TYPE.interest_accrual_payout, label: 'Interest Payout' },
    { value: FIXED_INCOME_EVENT_TYPE.partial_repayment, label: 'Partial Repayment' },
    { value: FIXED_INCOME_EVENT_TYPE.full_repayment, label: 'Full Repayment' },
    { value: FIXED_INCOME_EVENT_TYPE.maturity, label: 'Maturity' },
    { value: FIXED_INCOME_EVENT_TYPE.writedown, label: 'Writedown' },
    { value: FIXED_INCOME_EVENT_TYPE.fee, label: 'Fee' },
  ];
  return hasInitialInvestment.value ? all.filter((o) => o.value !== FIXED_INCOME_EVENT_TYPE.initial_investment) : all;
});

const createMutation = useCreateFixedIncomeEvent();

const form = reactive({
  type: FIXED_INCOME_EVENT_TYPE.interest_accrual_payout as FIXED_INCOME_EVENT_TYPE,
  eventDate: new Date() as Date,
  grossAmount: '',
  principalComponent: '',
  interestComponent: '',
  resetsAccrualClock: true,
  notes: '',
});

const formatApiDate = (d: Date): string => format(d, 'yyyy-MM-dd');

// A writedown records a loss with no cash movement, so it never carries an amount.
const isWritedown = computed(() => form.type === FIXED_INCOME_EVENT_TYPE.writedown);
const isInterestAccrualPayout = computed(() => form.type === FIXED_INCOME_EVENT_TYPE.interest_accrual_payout);

const isFormValid = computed(
  () =>
    form.eventDate instanceof Date &&
    !Number.isNaN(form.eventDate.getTime()) &&
    (isWritedown.value || Number(form.grossAmount) > 0),
);

const isPending = computed(() => createMutation.isPending.value);

const onSubmit = async () => {
  if (!isFormValid.value) return;
  try {
    const saved = await createMutation.mutateAsync({
      positionId: props.position.id,
      payload: {
        type: form.type,
        eventDate: formatApiDate(form.eventDate),
        currencyCode: props.position.currencyCode,
        grossAmount: isWritedown.value ? null : form.grossAmount || null,
        principalComponent: form.principalComponent || null,
        interestComponent: form.interestComponent || null,
        cashFlowMode: FIXED_INCOME_CASH_FLOW_MODE.out_of_wallet,
        resetsAccrualClock: isInterestAccrualPayout.value ? form.resetsAccrualClock : undefined,
        notes: form.notes || null,
      },
    });

    addNotification({ text: 'Event recorded', type: NotificationType.success });
    emit('saved', saved);
  } catch (err) {
    addNotification({ text: getErrorMessage(err, t('common.somethingWentWrong')), type: NotificationType.error });
  }
};
</script>

<template>
  <form class="grid w-full max-w-[500px] gap-4" @submit.prevent="onSubmit">
    <FieldLabel label="Event Type">
      <Select.Select v-model="form.type" :disabled="isPending">
        <Select.SelectTrigger>
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem v-for="o in availableEventTypes" :key="o.value" :value="o.value">
            {{ o.label }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </FieldLabel>

    <DateField v-model="form.eventDate" label="Event Date" :disabled="isPending" />

    <InputField
      v-if="!isWritedown"
      v-model="form.grossAmount"
      type="number"
      step="any"
      :label="`Amount (${position.currencyCode})`"
      :disabled="isPending"
      :error-message="!(Number(form.grossAmount) > 0) ? 'Enter a positive amount' : undefined"
    />

    <div v-if="!isWritedown" class="grid grid-cols-2 gap-4">
      <InputField
        v-model="form.principalComponent"
        type="number"
        step="any"
        label="Principal Portion"
        placeholder="Optional"
        :disabled="isPending"
      />
      <InputField
        v-model="form.interestComponent"
        type="number"
        step="any"
        label="Interest Portion"
        placeholder="Optional"
        :disabled="isPending"
      />
    </div>

    <label v-if="isInterestAccrualPayout" class="flex items-start gap-2 text-sm">
      <Checkbox v-model="form.resetsAccrualClock" :disabled="isPending" class="mt-0.5" />
      <span>
        <span class="font-medium">Counts as a real payout</span>
        <span class="text-muted-foreground block">
          Resets the accrual clock at this date. Turn off for a credit that never actually reached cash you control
          (e.g. an internal bank sweep) — it stays in the history below but interest keeps compounding straight through
          it.
        </span>
      </span>
    </label>

    <TextareaField v-model="form.notes" label="Notes" placeholder="Optional" :disabled="isPending" />

    <div class="flex justify-end gap-2">
      <UiButton type="button" variant="secondary" :disabled="isPending" @click="emit('cancel')">Cancel</UiButton>
      <UiButton type="submit" :disabled="isPending || !isFormValid">
        {{ isPending ? 'Saving...' : 'Add Event' }}
      </UiButton>
    </div>
  </form>
</template>
