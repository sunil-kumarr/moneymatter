<script setup lang="ts">
import AccountSelectField from '@/components/fields/account-select-field.vue';
import DateField from '@/components/fields/date-field.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import InputField from '@/components/fields/input-field.vue';
import TextareaField from '@/components/fields/textarea-field.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import * as Select from '@/components/lib/ui/select';
import { getErrorMessage } from '@/common/utils/error-message';
import { isPercentInputValid } from '@/common/utils/percentage';
import { isPositiveDecimal } from '@/common/utils/validators';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import {
  useCreateFixedIncomePosition,
  useFixedIncomePositionMetrics,
  useUpdateFixedIncomePosition,
} from '@/composable/data-queries/fixed-income/positions';
import { useFormatCurrency } from '@/composable/formatters';
import { useAccountsStore, useCurrenciesStore } from '@/stores';
import { AccountModel } from '@bt/shared/types';
import {
  BOND_TYPE,
  CREDIT_RATING,
  DAY_COUNT_CONVENTION,
  FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  FIXED_INCOME_INSTRUMENT_TYPE,
  INTEREST_COMPOUNDING_FREQUENCY,
  INTEREST_PAYOUT_FREQUENCY,
  type FixedIncomePositionModel,
} from '@bt/shared/types/investments';
import { format, formatDuration, intervalToDuration } from 'date-fns';
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
const { formatAmountByCurrencyCode } = useFormatCurrency();

const { data: metrics } = useFixedIncomePositionMetrics(computed(() => props.position?.id));

const currenciesStore = useCurrenciesStore();
const userCurrencies = computed(() => currenciesStore.currencies);

const accountsStore = useAccountsStore();
const payoutAccountOptions = computed(() => accountsStore.txTargetableAccountsActiveFirst);

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

const interestPayoutOptions = [
  { value: INTEREST_PAYOUT_FREQUENCY.cumulative, label: 'Cumulative (paid at maturity)' },
  { value: INTEREST_PAYOUT_FREQUENCY.monthly, label: 'Monthly' },
  { value: INTEREST_PAYOUT_FREQUENCY.quarterly, label: 'Quarterly' },
  { value: INTEREST_PAYOUT_FREQUENCY.semi_annually, label: 'Half-Yearly' },
  { value: INTEREST_PAYOUT_FREQUENCY.annually, label: 'Annually' },
];

const bondTypeOptions = [
  { value: BOND_TYPE.corporate, label: 'Corporate' },
  { value: BOND_TYPE.government, label: 'Government' },
];

const creditRatingOptions = [
  { value: CREDIT_RATING.AAA, label: 'AAA' },
  { value: CREDIT_RATING.AA_plus, label: 'AA+' },
  { value: CREDIT_RATING.AA, label: 'AA' },
  { value: CREDIT_RATING.AA_minus, label: 'AA-' },
  { value: CREDIT_RATING.A_plus, label: 'A+' },
  { value: CREDIT_RATING.A, label: 'A' },
  { value: CREDIT_RATING.A_minus, label: 'A-' },
  { value: CREDIT_RATING.BBB_plus, label: 'BBB+' },
  { value: CREDIT_RATING.BBB, label: 'BBB' },
  { value: CREDIT_RATING.BBB_minus, label: 'BBB-' },
  { value: CREDIT_RATING.BB_and_below, label: 'BB & below' },
];

const maturityInstructionOptions = [
  { value: FIXED_DEPOSIT_MATURITY_INSTRUCTION.credit_to_account, label: 'Credit to Account' },
  { value: FIXED_DEPOSIT_MATURITY_INSTRUCTION.auto_renew_principal, label: 'Auto-Renew Principal' },
  {
    value: FIXED_DEPOSIT_MATURITY_INSTRUCTION.auto_renew_principal_and_interest,
    label: 'Auto-Renew Principal + Interest',
  },
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
  interestRatePct: '0',
  compoundingFrequency: INTEREST_COMPOUNDING_FREQUENCY.simple as INTEREST_COMPOUNDING_FREQUENCY,
  dayCountConvention: DAY_COUNT_CONVENTION.actual_365 as DAY_COUNT_CONVENTION,
  startDate: new Date() as Date,
  expectedEndDate: null as Date | null,
  counterpartyName: '',
  variantName: '',
  interestPayoutFrequency: INTEREST_PAYOUT_FREQUENCY.cumulative as INTEREST_PAYOUT_FREQUENCY,
  maturityInstruction: FIXED_DEPOSIT_MATURITY_INSTRUCTION.credit_to_account as FIXED_DEPOSIT_MATURITY_INSTRUCTION,
  payoutAccount: null as AccountModel | null,
  bondType: BOND_TYPE.corporate as BOND_TYPE,
  creditRating: null as CREDIT_RATING | null,
  ytmPct: '',
  notes: '',
});

const isFixedDeposit = computed(() => form.instrumentType === FIXED_INCOME_INSTRUMENT_TYPE.fixed_deposit);
const isBond = computed(() => form.instrumentType === FIXED_INCOME_INSTRUMENT_TYPE.bond);

// Read-only, derived purely from the dates already in the form — never sent to the API.
const tenureLabel = computed(() => {
  if (!(form.startDate instanceof Date) || !form.expectedEndDate) return null;
  const duration = intervalToDuration({ start: form.startDate, end: form.expectedEndDate });
  const label = formatDuration(duration, { format: ['years', 'months', 'days'] });
  return label || '0 days';
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
    // interestRatePct is stored and returned as a plain 0-100 percent number (matching
    // the backend's compute-accrued-interest.ts, which divides by 100 internally) — not
    // a fraction, unlike the Venture domain's *Pct fields.
    form.interestRatePct = String(p.interestRatePct);
    form.compoundingFrequency = p.compoundingFrequency ?? INTEREST_COMPOUNDING_FREQUENCY.simple;
    form.dayCountConvention = p.dayCountConvention;
    form.startDate = parseApiDate(p.startDate);
    form.expectedEndDate = p.expectedEndDate ? parseApiDate(p.expectedEndDate) : null;
    form.counterpartyName = p.counterpartyName ?? '';
    form.variantName = p.variantName ?? '';
    form.interestPayoutFrequency = p.interestPayoutFrequency;
    form.maturityInstruction = p.maturityInstruction;
    form.payoutAccount = (p.payoutAccountId && accountsStore.accountsRecord[p.payoutAccountId]) || null;
    form.bondType = p.bondType ?? BOND_TYPE.corporate;
    form.creditRating = p.creditRating;
    form.ytmPct = p.ytmPct != null ? String(p.ytmPct) : '';
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
    isPercentInputValid(form.interestRatePct),
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
          interestRatePct: form.interestRatePct,
          compoundingFrequency: form.compoundingFrequency,
          dayCountConvention: form.dayCountConvention,
          expectedEndDate: form.expectedEndDate ? formatApiDate(form.expectedEndDate) : null,
          counterpartyName: toStr(form.counterpartyName) || null,
          variantName: toStr(form.variantName) || null,
          interestPayoutFrequency: form.interestPayoutFrequency,
          maturityInstruction: form.maturityInstruction,
          payoutAccountId: form.payoutAccount?.id ?? null,
          bondType: isBond.value ? form.bondType : null,
          creditRating: isBond.value ? form.creditRating : null,
          ytmPct: isBond.value ? toStr(form.ytmPct) || null : null,
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
        interestRatePct: form.interestRatePct,
        compoundingFrequency: form.compoundingFrequency,
        dayCountConvention: form.dayCountConvention,
        startDate: formatApiDate(form.startDate),
        expectedEndDate: form.expectedEndDate ? formatApiDate(form.expectedEndDate) : null,
        counterpartyName: toStr(form.counterpartyName) || null,
        variantName: toStr(form.variantName) || null,
        interestPayoutFrequency: form.interestPayoutFrequency,
        maturityInstruction: form.maturityInstruction,
        payoutAccountId: form.payoutAccount?.id ?? null,
        bondType: isBond.value ? form.bondType : null,
        creditRating: isBond.value ? form.creditRating : null,
        ytmPct: isBond.value ? toStr(form.ytmPct) || null : null,
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

    <InputField
      v-if="isFixedDeposit"
      v-model="form.variantName"
      label="FD Variant / Scheme"
      placeholder="e.g. Tax Saver FD"
      :disabled="isPending"
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

    <div v-if="isBond" class="grid grid-cols-2 gap-4">
      <FieldLabel label="Bond Type">
        <Select.Select v-model="form.bondType" :disabled="isPending">
          <Select.SelectTrigger>
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem v-for="o in bondTypeOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </FieldLabel>
      <FieldLabel label="Credit Rating">
        <Select.Select
          :model-value="form.creditRating ?? undefined"
          :disabled="isPending"
          @update:model-value="(v) => (form.creditRating = (v as CREDIT_RATING) ?? null)"
        >
          <Select.SelectTrigger>
            <Select.SelectValue placeholder="Not rated" />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem v-for="o in creditRatingOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </FieldLabel>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <DateField
        v-model="form.startDate"
        :label="isBond ? 'Invested On' : 'Start Date'"
        :disabled="isPending || isEditing"
      />
      <DateField
        :model-value="form.expectedEndDate ?? undefined"
        :label="isBond ? 'Maturing On' : 'Expected End Date'"
        :calendar-options="{ minDate: form.startDate }"
        :disabled="isPending"
        @update:model-value="(v: Date | null) => (form.expectedEndDate = v)"
      />
    </div>

    <p v-if="tenureLabel" class="text-muted-foreground text-sm">Tenure: {{ tenureLabel }}</p>

    <div class="grid grid-cols-2 gap-4">
      <InputField
        v-model="form.interestRatePct"
        type="number"
        step="0.01"
        :label="isBond ? 'Coupon Rate (%)' : 'Interest Rate (%)'"
        :disabled="isPending"
        :error-message="!isPercentInputValid(form.interestRatePct) ? 'Enter a value between 0 and 100' : undefined"
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

    <InputField
      v-if="isBond"
      v-model="form.ytmPct"
      type="number"
      step="0.01"
      label="YTM (%)"
      placeholder="Yield to maturity"
      :disabled="isPending"
      :error-message="form.ytmPct && !isPercentInputValid(form.ytmPct) ? 'Enter a value between 0 and 100' : undefined"
    />

    <FieldLabel v-if="!isFixedDeposit" label="Day Count Convention">
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

    <div v-if="isFixedDeposit || isBond" class="grid grid-cols-2 gap-4">
      <FieldLabel :label="isBond ? 'Payout Schedule' : 'Interest Payout'">
        <Select.Select v-model="form.interestPayoutFrequency" :disabled="isPending">
          <Select.SelectTrigger>
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem v-for="o in interestPayoutOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </FieldLabel>
      <FieldLabel v-if="isFixedDeposit" label="Maturity Instructions">
        <Select.Select v-model="form.maturityInstruction" :disabled="isPending">
          <Select.SelectTrigger>
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem v-for="o in maturityInstructionOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </FieldLabel>
    </div>

    <div v-if="isEditing && metrics" class="bg-muted/50 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md p-3 text-sm">
      <span class="text-muted-foreground">Current Value</span>
      <span class="text-right font-medium">{{
        formatAmountByCurrencyCode(Number(metrics.currentValue), form.currencyCode)
      }}</span>
      <span class="text-muted-foreground">Gains</span>
      <span class="text-app-income-color text-right font-medium">{{
        formatAmountByCurrencyCode(Number(metrics.pnlAbsolute), form.currencyCode)
      }}</span>
      <template v-if="metrics.nextPayoutDate">
        <span class="text-muted-foreground">Next Payout Date</span>
        <span class="text-right font-medium">{{ format(parseApiDate(metrics.nextPayoutDate), 'MMM d, yyyy') }}</span>
      </template>
    </div>

    <AccountSelectField
      v-if="isFixedDeposit"
      v-model="form.payoutAccount"
      :accounts="payoutAccountOptions"
      label="Payout Account"
      placeholder="Where interest / maturity proceeds land"
      clearable
      :disabled="isPending"
    />

    <InputField
      v-if="!isFixedDeposit"
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
