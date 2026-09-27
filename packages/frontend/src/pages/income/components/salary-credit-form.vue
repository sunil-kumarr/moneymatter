<template>
  <form :id="formId" class="@container/credit-form grid gap-6" @submit.prevent="submit">
    <div class="grid grid-cols-1 items-end gap-4 @sm/credit-form:grid-cols-2">
      <SelectField
        :model-value="selectedCreditType"
        :values="creditTypeOptions"
        label-key="label"
        value-key="value"
        :label="$t('forms.salaryCredit.creditTypeLabel')"
        @update:model-value="(v) => v && (form.creditType = v.value)"
      />
      <DateField
        v-model="form.creditDate"
        :label="$t('forms.salaryCredit.creditDateLabel')"
        :calendar-options="{ maxDate: new Date() }"
      />
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium">{{ $t('forms.salaryCredit.componentsLabel') }}</p>
        <UiButton type="button" variant="outline" size="sm" @click="addComponent">
          <PlusIcon class="size-3.5" />
          {{ $t('forms.salaryCredit.addComponent') }}
        </UiButton>
      </div>

      <div
        v-for="(component, index) in form.components"
        :key="index"
        class="grid grid-cols-[1fr_9rem_7rem_auto] items-end gap-2"
      >
        <InputField
          v-model="component.name"
          :label="index === 0 ? $t('forms.salaryCredit.componentNameLabel') : undefined"
        />
        <SelectField
          :model-value="componentKindOptions.find((o) => o.value === component.kind) ?? null"
          :values="componentKindOptions"
          label-key="label"
          value-key="value"
          :label="index === 0 ? $t('forms.salaryCredit.componentKindLabel') : undefined"
          @update:model-value="(v) => v && (component.kind = v.value)"
        />
        <FormattedAmountField
          v-model="component.amount"
          :label="index === 0 ? $t('forms.salaryCredit.componentAmountLabel') : undefined"
        />
        <UiButton type="button" variant="ghost" size="icon" class="mb-0.5" @click="removeComponent(index)">
          <Trash2Icon class="text-muted-foreground size-4" />
        </UiButton>
      </div>

      <p v-if="form.components.length === 0" class="text-muted-foreground text-xs">
        {{ $t('forms.salaryCredit.noComponents') }}
      </p>
    </div>

    <div class="border-border/60 flex items-center justify-between border-t pt-3 text-sm">
      <span class="text-muted-foreground">{{ $t('forms.salaryCredit.netPreview') }}</span>
      <span class="font-semibold tabular-nums">{{ netPreviewLabel }}</span>
    </div>

    <TextareaField v-model="form.notes" :label="$t('forms.salaryCredit.notesLabel')" />

    <LinkTransactionField v-if="!isEdit" v-model="linkedTransaction" :currency-code="currencyCode" />
  </form>
</template>

<script setup lang="ts">
import type { CreateIncomeCreditPayload, UpdateIncomeCreditPayload } from '@/api/income/credits';
import DateField from '@/components/fields/date-field.vue';
import FormattedAmountField from '@/components/fields/formatted-amount-field.vue';
import InputField from '@/components/fields/input-field.vue';
import SelectField from '@/components/fields/select-field.vue';
import TextareaField from '@/components/fields/textarea-field.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { useFormatCurrency } from '@/composable/formatters';
import type { TransactionModel } from '@bt/shared/types/db-models';
import {
  INCOME_COMPONENT_KIND,
  INCOME_CREDIT_TYPE,
  type IncomeComponentTemplateItem,
  type IncomeCreditModel,
} from '@bt/shared/types/income';
import { PlusIcon, Trash2Icon } from '@lucide/vue';
import { format, parseISO } from 'date-fns';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import LinkTransactionField from './link-transaction-field.vue';

const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit';
    initialCredit?: IncomeCreditModel | null;
    componentTemplate?: IncomeComponentTemplateItem[] | null;
    currencyCode: string;
    submitting?: boolean;
    formId?: string;
  }>(),
  { mode: 'create', initialCredit: null, componentTemplate: null, submitting: false, formId: undefined },
);

const emit = defineEmits<{
  submit: [payload: CreateIncomeCreditPayload | UpdateIncomeCreditPayload, linkedTransactionId: string | null];
}>();

const isEdit = computed(() => props.mode === 'edit');
const { t } = useI18n();
const { formatAmountByCurrencyCode } = useFormatCurrency();

const linkedTransaction = ref<TransactionModel | null>(null);

interface ComponentRow {
  name: string;
  kind: INCOME_COMPONENT_KIND;
  amount: number | null;
}

interface FormState {
  creditType: INCOME_CREDIT_TYPE;
  creditDate: Date;
  components: ComponentRow[];
  notes: string;
}

const buildComponentsFromTemplate = (): ComponentRow[] => {
  if (!props.componentTemplate || props.componentTemplate.length === 0) return [];
  return props.componentTemplate
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      name: item.name,
      kind: item.kind,
      amount: item.defaultAmount === null ? null : Number(item.defaultAmount),
    }));
};

const buildInitialState = (): FormState => {
  if (props.initialCredit) {
    const credit = props.initialCredit;
    return {
      creditType: credit.creditType,
      // Editing keeps the original date; duplicating starts from today since it's meant to seed a new entry.
      creditDate: isEdit.value ? parseISO(credit.creditDate) : new Date(),
      components: (credit.components ?? []).map((c) => ({ name: c.name, kind: c.kind, amount: Number(c.amount) })),
      notes: credit.notes ?? '',
    };
  }
  return {
    creditType: INCOME_CREDIT_TYPE.regular_salary,
    creditDate: new Date(),
    components: buildComponentsFromTemplate(),
    notes: '',
  };
};

const form = reactive<FormState>(buildInitialState());

const creditTypeOptions = computed(() =>
  Object.values(INCOME_CREDIT_TYPE).map((value) => ({ label: t(`income.creditTypes.${value}`), value })),
);
const selectedCreditType = computed(() => creditTypeOptions.value.find((o) => o.value === form.creditType) ?? null);

const componentKindOptions = computed(() =>
  Object.values(INCOME_COMPONENT_KIND).map((value) => ({ label: t(`income.componentKinds.${value}`), value })),
);

const addComponent = () => {
  form.components.push({ name: '', kind: INCOME_COMPONENT_KIND.earning, amount: null });
};

const removeComponent = (index: number) => {
  form.components.splice(index, 1);
};

const netPreview = computed(() => {
  let net = 0;
  for (const component of form.components) {
    const amount = component.amount ?? 0;
    if (component.kind === INCOME_COMPONENT_KIND.earning) net += amount;
    if (component.kind === INCOME_COMPONENT_KIND.deduction) net -= amount;
  }
  return net;
});

const netPreviewLabel = computed(() => formatAmountByCurrencyCode(netPreview.value, props.currencyCode));

const submit = () => {
  if (props.submitting) return;

  const components = form.components
    .filter((c) => c.name.trim().length > 0 && c.amount !== null)
    .map((c, index) => ({
      name: c.name.trim(),
      kind: c.kind,
      amount: Number(c.amount),
      sortOrder: index,
    }));

  const payload: CreateIncomeCreditPayload | UpdateIncomeCreditPayload = {
    creditType: form.creditType,
    creditDate: format(form.creditDate, 'yyyy-MM-dd'),
    components,
    notes: form.notes.trim() || null,
  };

  emit('submit', isEdit.value ? payload : (payload as CreateIncomeCreditPayload), linkedTransaction.value?.id ?? null);
};
</script>
