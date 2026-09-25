<script setup lang="ts">
import DateField from '@/components/fields/date-field.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import InputField from '@/components/fields/input-field.vue';
import TextareaField from '@/components/fields/textarea-field.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import * as Select from '@/components/lib/ui/select';
import { getErrorMessage } from '@/common/utils/error-message';
import { fractionToPercentInput, isPercentInputValid, percentInputToFraction } from '@/common/utils/percentage';
import { isPositiveDecimal } from '@/common/utils/validators';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import {
  useCreateFixedIncomePosition,
  useUpdateFixedIncomePosition,
} from '@/composable/data-queries/fixed-income/positions';
import { useCurrenciesStore } from '@/stores';
import {
  DAY_COUNT_CONVENTION,
  FIXED_INCOME_INSTRUMENT_TYPE,
  INTEREST_COMPOUNDING_FREQUENCY,
  type FixedIncomePositionModel,
} from '@bt/shared/types/investments';
import { format } from 'date-fns';
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { addNotification } = useNotificationCenter();

interface Emit {
  (e: 'saved', position: FixedIncomePositionModel): void;
  (e: 'cancel'): void;
}

const props = defineProps<{
  portfolioId: string;
  position?: FixedIncomePositionModel | null;
}>();

const emit = defineEmits<Emit>();

const createMutation = useCreateFixedIncomePosition();
const updateMutation = useUpdateFixedIncomePosition();

const currenciesStore = useCurrenciesStore();
const userCurrencies = computed(() => currenciesStore.currencies);

const instrumentTypeOptions = [
  { value: FIXED_INCOME_INSTRUMENT_TYPE.fixed_deposit, label: 'Fixed Deposit' },
  { value: FIXED_INCOME_INSTRUMENT_TYPE.bond, label: 'Bond' },
  { value: FIXED_INCOME_INSTRUMENT_TYPE.peer_loan, label: 'Peer Loan' },
];

const compoundingOptions = [
  { value: INTEREST_COMPOUNDING_FREQUENCY.simple, label: 'Simple' },
  { value: INTEREST_COMPOUNDING_FREQUENCY.annually, label: 'Annually' },
  { value: INTEREST_COMPOUNDING_FREQUENCY.semi_annually, label: 'Semi-annually' },
  { value: INTEREST_COMPOUNDING_FREQUENCY.quarterly, label: 'Quarterly' },
  { value: INTEREST_COMPOUNDING_FREQUENCY.monthly, label: 'Monthly' },
];

const dayCountOptions = [
  { value: DAY_COUNT_CONVENTION.actual_365, label: 'Actual/365' },
  { value: DAY_COUNT_CONVENTION.actual_360, label: 'Actual/360' },
  { value: DAY_COUNT_CONVENTION.thirty_360, label: '30/360' },
];

const parseApiDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const formatApiDate = (d: Date): string => format(d, 'yyyy-MM-dd');

const isEditing = computed(() => !!props.position);

const form = reactive({
  instrumentType: FIXED_INCOME_INSTRUMENT_TYPE.fixed_deposit as FIXED_INCOME_INSTRUMENT_TYPE,
  name: '',
  currencyCode: currenciesStore.baseCurrency?.currencyCode ?? 'USD',
  principal: '',
  interestRatePctPercent: '0',
  compoundingFrequency: INTEREST_COMPOUNDING_FREQUENCY.simple as INTEREST_COMPOUNDING_FREQUENCY,
  dayCountConvention: DAY_COUNT_CONVENTION.actual_365 as DAY_COUNT_CONVENTION,
  startDate: new Date() as Date,
  expectedEndDate: null as Date | null,
  counterpartyName: '',
  notes: '',
});

// Peer loans only support simple interest — the backend rejects any other
// compounding frequency for this instrument type.
watch(
  () => form.instrumentType,
  (type) => {
    if (type === FIXED_INCOME_INSTRUMENT_TYPE.peer_loan) {
      form.compoundingFrequency = INTEREST_COMPOUNDING_FREQUENCY.simple;
    }
  },
);

watch(
  () => props.position,
  (p) => {
    if (!p) return;
    form.instrumentType = p.instrumentType;
    form.name = p.name;
    form.currencyCode = p.currencyCode;
    form.principal = String(p.principal);
    form.interestRatePctPercent = fractionToPercentInput(p.interestRatePct);
    form.compoundingFrequency = p.compoundingFrequency ?? INTEREST_COMPOUNDING_FREQUENCY.simple;
    form.dayCountConvention = p.dayCountConvention;
    form.startDate = parseApiDate(p.startDate);
    form.expectedEndDate = p.expectedEndDate ? parseApiDate(p.expectedEndDate) : null;
    form.counterpartyName = p.counterpartyName ?? '';
    form.notes = p.notes ?? '';
  },
  { immediate: true },
);

const isPending = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

const isFormValid = computed(
  () =>
    form.name.trim().length > 0 &&
    form.currencyCode.length === 3 &&
    (isEditing.value || isPositiveDecimal(form.principal)) &&
    form.startDate instanceof Date &&
    !Number.isNaN(form.startDate.getTime()) &&
    isPercentInputValid(form.interestRatePctPercent),
);

const toStr = (val: unknown): string => (val == null ? '' : String(val).trim());

const onSubmit = async () => {
  if (!isFormValid.value) return;
  try {
    let saved: FixedIncomePositionModel;
    if (props.position) {
      saved = await updateMutation.mutateAsync({
        positionId: props.position.id,
        payload: {
          name: toStr(form.name),
          interestRatePct: percentInputToFraction(form.interestRatePctPercent),
          compoundingFrequency: form.compoundingFrequency,
          dayCountConvention: form.dayCountConvention,
          expectedEndDate: form.expectedEndDate ? formatApiDate(form.expectedEndDate) : null,
          counterpartyName: toStr(form.counterpartyName) || null,
          notes: toStr(form.notes) || null,
        },
      });
    } else {
      saved = await createMutation.mutateAsync({
        portfolioId: props.portfolioId,
        instrumentType: form.instrumentType,
        name: toStr(form.name),
        currencyCode: form.currencyCode,
        principal: form.principal,
        interestRatePct: percentInputToFraction(form.interestRatePctPercent),
        compoundingFrequency: form.compoundingFrequency,
        dayCountConvention: form.dayCountConvention,
        startDate: formatApiDate(form.startDate),
        expectedEndDate: form.expectedEndDate ? formatApiDate(form.expectedEndDate) : null,
        counterpartyName: toStr(form.counterpartyName) || null,
        notes: toStr(form.notes) || null,
      });
    }

    addNotification({
      text: props.position ? 'Position updated' : 'Position created',
      type: NotificationType.success,
    });
    emit('saved', saved);
  } catch (err) {
    addNotification({ text: getErrorMessage(err, t('common.somethingWentWrong')), type: NotificationType.error });
  }
};
</script>

<template>
  <form class="grid w-full max-w-[600px] gap-4" @submit.prevent="onSubmit">
    <FieldLabel label="Instrument Type">
      <Select.Select v-model="form.instrumentType" :disabled="isPending || isEditing">
        <Select.SelectTrigger>
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem v-for="o in instrumentTypeOptions" :key="o.value" :value="o.value">
            {{ o.label }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </FieldLabel>

    <InputField
      v-model="form.name"
      label="Name"
      placeholder="e.g. HDFC 1-year FD"
      :disabled="isPending"
      :error-message="!form.name.trim() ? 'Name is required' : undefined"
    />

    <div class="grid grid-cols-2 gap-4">
      <FieldLabel label="Currency">
        <Select.Select v-model="form.currencyCode" :disabled="isPending || isEditing">
          <Select.SelectTrigger>
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem v-for="c in userCurrencies" :key="c.currencyCode" :value="c.currencyCode">
              {{ c.currencyCode }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </FieldLabel>
      <InputField
        v-model="form.principal"
        type="number"
        step="any"
        label="Principal"
        :disabled="isPending || isEditing"
        :error-message="!isEditing && !isPositiveDecimal(form.principal) ? 'Enter a positive amount' : undefined"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <DateField v-model="form.startDate" label="Start Date" :disabled="isPending || isEditing" />
      <DateField
        :model-value="form.expectedEndDate ?? undefined"
        label="Expected End Date"
        :calendar-options="{ minDate: form.startDate }"
        :disabled="isPending"
        @update:model-value="(v: Date | null) => (form.expectedEndDate = v)"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <InputField
        v-model="form.interestRatePctPercent"
        type="number"
        step="0.01"
        label="Interest Rate (%)"
        :disabled="isPending"
        :error-message="
          !isPercentInputValid(form.interestRatePctPercent) ? 'Enter a value between 0 and 100' : undefined
        "
      />
      <FieldLabel label="Compounding">
        <Select.Select
          v-model="form.compoundingFrequency"
          :disabled="isPending || form.instrumentType === FIXED_INCOME_INSTRUMENT_TYPE.peer_loan"
        >
          <Select.SelectTrigger>
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem v-for="o in compoundingOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </FieldLabel>
    </div>

    <FieldLabel label="Day Count Convention">
      <Select.Select v-model="form.dayCountConvention" :disabled="isPending">
        <Select.SelectTrigger>
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem v-for="o in dayCountOptions" :key="o.value" :value="o.value">
            {{ o.label }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </FieldLabel>

    <InputField
      v-model="form.counterpartyName"
      label="Counterparty / Borrower Name"
      placeholder="Optional"
      :disabled="isPending"
    />

    <TextareaField v-model="form.notes" label="Notes" placeholder="Optional" :disabled="isPending" />

    <div class="flex justify-end gap-2">
      <UiButton type="button" variant="secondary" :disabled="isPending" @click="emit('cancel')">Cancel</UiButton>
      <UiButton type="submit" :disabled="isPending || !isFormValid">
        {{ isPending ? 'Saving...' : props.position ? 'Save' : 'Create' }}
      </UiButton>
    </div>
  </form>
</template>
