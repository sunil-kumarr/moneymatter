<template>
  <form :id="formId" class="@container/income-form grid gap-6" @submit.prevent="submit">
    <InputField
      v-model="form.name"
      :label="$t('forms.incomeSource.nameLabel')"
      :placeholder="$t('forms.incomeSource.namePlaceholder')"
      :error-message="getFieldErrorMessage('form.name')"
      @blur="touchField('form.name')"
    />

    <div class="grid grid-cols-1 items-end gap-4 @sm/income-form:grid-cols-2">
      <InputField
        v-model="form.employerName"
        :label="$t('forms.incomeSource.employerNameLabel')"
        :placeholder="$t('forms.incomeSource.employerNamePlaceholder')"
      />
      <InputField
        v-model="form.jobTitle"
        :label="$t('forms.incomeSource.jobTitleLabel')"
        :placeholder="$t('forms.incomeSource.jobTitlePlaceholder')"
      />
    </div>

    <div class="grid grid-cols-1 items-end gap-4 @sm/income-form:grid-cols-2">
      <SelectField
        :model-value="selectedSourceType"
        :values="sourceTypeOptions"
        label-key="label"
        value-key="value"
        :label="$t('forms.incomeSource.sourceTypeLabel')"
        @update:model-value="(v) => v && (form.sourceType = v.value)"
      />
      <SelectField
        :model-value="selectedPayCadence"
        :values="payCadenceOptions"
        label-key="label"
        value-key="value"
        :label="$t('forms.incomeSource.payCadenceLabel')"
        @update:model-value="(v) => v && (form.payCadence = v.value)"
      />
    </div>

    <div v-if="!isEdit" class="grid grid-cols-1 items-end gap-4 @sm/income-form:grid-cols-2">
      <SelectField
        :model-value="selectedCurrency"
        :values="systemCurrenciesVerbose.linked"
        :label-key="currencyLabel"
        value-key="code"
        :label="$t('forms.incomeSource.currencyLabel')"
        @update:model-value="(v) => v && (form.currencyCode = v.code)"
      />
      <DateField
        v-model="form.startDate"
        :label="$t('forms.incomeSource.startDateLabel')"
        :calendar-options="{ maxDate: new Date() }"
      />
    </div>

    <FormattedAmountField
      v-model="form.expectedAnnualCtc"
      :label="$t('forms.incomeSource.expectedAnnualCtcLabel')"
      :placeholder="$t('forms.incomeSource.expectedAnnualCtcPlaceholder')"
    />

    <AccountSelectField
      v-model="selectedPayoutAccount"
      :accounts="accounts"
      clearable
      :label="$t('forms.incomeSource.payoutAccountLabel')"
      :placeholder="$t('forms.incomeSource.payoutAccountPlaceholder')"
    />

    <div class="grid grid-cols-1 items-end gap-4 @sm/income-form:grid-cols-2">
      <InputField
        v-model="form.taxRegime"
        :label="$t('forms.incomeSource.taxRegimeLabel')"
        :placeholder="$t('forms.incomeSource.taxRegimePlaceholder')"
      />
      <InputField
        v-model="form.employerIdentifier"
        :label="$t('forms.incomeSource.employerIdentifierLabel')"
        :placeholder="$t('forms.incomeSource.employerIdentifierPlaceholder')"
      />
    </div>

    <TextareaField
      v-model="form.notes"
      :label="$t('forms.incomeSource.notesLabel')"
      :placeholder="$t('forms.incomeSource.notesPlaceholder')"
    />
  </form>
</template>

<script setup lang="ts">
import type { CreateIncomeSourcePayload, UpdateIncomeSourcePayload } from '@/api/income/sources';
import AccountSelectField from '@/components/fields/account-select-field.vue';
import DateField from '@/components/fields/date-field.vue';
import FormattedAmountField from '@/components/fields/formatted-amount-field.vue';
import InputField from '@/components/fields/input-field.vue';
import SelectField from '@/components/fields/select-field.vue';
import TextareaField from '@/components/fields/textarea-field.vue';
import { useCurrencyName } from '@/composable';
import { useFormValidation } from '@/composable/form-validator';
import { useAccountsStore } from '@/stores/accounts';
import { useCurrenciesStore } from '@/stores/currencies';
import type { AccountModel, CurrencyModel } from '@bt/shared/types';
import { INCOME_SOURCE_TYPE, PAY_CADENCE, type IncomeSourceModel } from '@bt/shared/types/income';
import { helpers, maxLength, required } from '@vuelidate/validators';
import { format, parseISO } from 'date-fns';
import { storeToRefs } from 'pinia';
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit';
    initialSource?: IncomeSourceModel | null;
    submitting?: boolean;
    formId?: string;
  }>(),
  { mode: 'create', initialSource: null, submitting: false, formId: undefined },
);

const emit = defineEmits<{
  submit: [payload: CreateIncomeSourcePayload | UpdateIncomeSourcePayload];
}>();

const isEdit = computed(() => props.mode === 'edit');

const { t } = useI18n();
const currenciesStore = useCurrenciesStore();
const { formatCurrencyLabel } = useCurrencyName();
const { baseCurrency, systemCurrenciesVerbose } = storeToRefs(currenciesStore);
const { txTargetableAccountsActiveFirst: accounts } = storeToRefs(useAccountsStore());

const defaultCurrency = computed(
  () =>
    systemCurrenciesVerbose.value.linked.find((i) => i.code === baseCurrency.value?.currencyCode)?.code ??
    systemCurrenciesVerbose.value.linked[0]?.code ??
    '',
);

interface FormState {
  name: string;
  employerName: string;
  jobTitle: string;
  sourceType: INCOME_SOURCE_TYPE;
  currencyCode: string;
  startDate: Date;
  payCadence: PAY_CADENCE;
  expectedAnnualCtc: number | null;
  payoutAccountId: string | null;
  taxRegime: string;
  employerIdentifier: string;
  notes: string;
}

const buildInitialState = (): FormState => {
  if (props.initialSource) {
    const source = props.initialSource;
    return {
      name: source.name,
      employerName: source.employerName ?? '',
      jobTitle: source.jobTitle ?? '',
      sourceType: source.sourceType,
      currencyCode: source.currencyCode,
      startDate: parseISO(source.startDate),
      payCadence: source.payCadence,
      expectedAnnualCtc: source.expectedAnnualCtc === null ? null : Number(source.expectedAnnualCtc),
      payoutAccountId: source.payoutAccountId,
      taxRegime: source.taxRegime ?? '',
      employerIdentifier: source.employerIdentifier ?? '',
      notes: source.notes ?? '',
    };
  }
  return {
    name: '',
    employerName: '',
    jobTitle: '',
    sourceType: INCOME_SOURCE_TYPE.salaried,
    currencyCode: String(defaultCurrency.value),
    startDate: new Date(),
    payCadence: PAY_CADENCE.monthly,
    expectedAnnualCtc: null,
    payoutAccountId: null,
    taxRegime: '',
    employerIdentifier: '',
    notes: '',
  };
};

const form = reactive<FormState>(buildInitialState());

const sourceTypeOptions = computed(() =>
  Object.values(INCOME_SOURCE_TYPE).map((value) => ({ label: t(`income.sourceTypes.${value}`), value })),
);
const selectedSourceType = computed(() => sourceTypeOptions.value.find((o) => o.value === form.sourceType) ?? null);

const payCadenceOptions = computed(() =>
  Object.values(PAY_CADENCE).map((value) => ({ label: t(`income.payCadences.${value}`), value })),
);
const selectedPayCadence = computed(() => payCadenceOptions.value.find((o) => o.value === form.payCadence) ?? null);

const selectedCurrency = computed(
  () => systemCurrenciesVerbose.value.linked.find((item) => item.code === form.currencyCode) ?? null,
);
const currencyLabel = (item: CurrencyModel): string =>
  formatCurrencyLabel({ code: item.code, fallbackName: item.currency });

const selectedPayoutAccount = computed<AccountModel | null>({
  get: () => accounts.value.find((a) => a.id === form.payoutAccountId) ?? null,
  set: (account) => {
    form.payoutAccountId = account?.id ?? null;
  },
});

const validationRules = {
  name: {
    required: helpers.withMessage(() => t('forms.incomeSource.errors.required'), required),
    maxLength: maxLength(255),
  },
  employerName: { maxLength: maxLength(255) },
  jobTitle: { maxLength: maxLength(255) },
  taxRegime: { maxLength: maxLength(64) },
  employerIdentifier: { maxLength: maxLength(128) },
};

const { isFormValid, getFieldErrorMessage, touchField } = useFormValidation({ form }, { form: validationRules });

const submit = () => {
  if (props.submitting) return;
  if (!isFormValid()) return;

  const commonFields = {
    name: form.name.trim(),
    employerName: form.employerName.trim() || null,
    jobTitle: form.jobTitle.trim() || null,
    sourceType: form.sourceType,
    payCadence: form.payCadence,
    expectedAnnualCtc: form.expectedAnnualCtc,
    payoutAccountId: form.payoutAccountId,
    taxRegime: form.taxRegime.trim() || null,
    employerIdentifier: form.employerIdentifier.trim() || null,
    notes: form.notes.trim() || null,
  };

  if (isEdit.value) {
    emit('submit', commonFields as UpdateIncomeSourcePayload);
    return;
  }

  const payload: CreateIncomeSourcePayload = {
    ...commonFields,
    currencyCode: form.currencyCode,
    startDate: format(form.startDate, 'yyyy-MM-dd'),
  };

  emit('submit', payload);
};
</script>
