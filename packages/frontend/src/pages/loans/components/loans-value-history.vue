<template>
  <div class="border-border bg-card @container/loans-value mb-6 space-y-4 rounded-lg border p-4">
    <!-- Top Summary Row -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex flex-wrap items-start gap-8">
        <div>
          <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
            <span class="bg-loan-principal size-2.5 shrink-0 rounded-full" />
            {{
              mode === 'balance' ? $t('loans.valueHistory.remainingBalance') : $t('loans.valueHistory.monthlyPrincipal')
            }}
          </div>
          <div class="text-xl font-semibold @xl/loans-value:text-2xl">{{ formatCurrency(primaryMetricValue) }}</div>
        </div>

        <div>
          <div class="text-muted-foreground mb-1 flex items-center gap-1.5 text-sm">
            <span class="bg-loan-interest size-2.5 shrink-0 rounded-full" />
            {{
              mode === 'balance'
                ? $t('loans.valueHistory.cumulativeInterest')
                : $t('loans.valueHistory.monthlyInterest')
            }}
          </div>
          <div class="text-xl font-semibold @xl/loans-value:text-2xl">
            {{ formatCurrency(secondaryMetricValue) }}
          </div>
        </div>
      </div>

      <div v-if="hasData" class="text-right">
        <div class="text-muted-foreground text-xs">{{ $t('loans.valueHistory.totalCost') }}</div>
        <div class="text-lg font-semibold">
          {{ formatCurrency(summary.totalCost) }}
        </div>
        <div v-if="payoffDateDisplay" class="text-muted-foreground text-xs">
          {{ $t('loans.valueHistory.debtFree', { date: payoffDateDisplay }) }}
        </div>
      </div>
    </div>

    <!-- Controls Row: Loan selector (if multiple), Mode toggles, Period selector -->
    <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
      <div class="flex flex-wrap items-center gap-2">
        <!-- Loan Selector if > 1 loan -->
        <div v-if="loans.length > 1" class="w-48">
          <Select v-model="selectedLoanId">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue :placeholder="$t('loans.valueHistory.allLoans')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"> {{ $t('loans.valueHistory.allLoans') }} ({{ loans.length }}) </SelectItem>
              <SelectItem v-for="loan in loans" :key="loan.id" :value="loan.id">
                {{ loan.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Mode Toggle (Balance vs Monthly Payment) -->
        <div class="bg-muted inline-flex items-center rounded-lg p-0.5 text-xs">
          <button
            type="button"
            class="rounded-md px-2.5 py-1 font-medium transition-colors"
            :class="
              mode === 'balance' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            "
            @click="mode = 'balance'"
          >
            {{ $t('loans.valueHistory.modes.balance') }}
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 font-medium transition-colors"
            :class="
              mode === 'payment' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            "
            @click="mode = 'payment'"
          >
            {{ $t('loans.valueHistory.modes.payment') }}
          </button>
        </div>
      </div>

      <!-- Periods -->
      <div class="flex flex-wrap items-center gap-1">
        <Button
          v-for="p in periods"
          :key="p"
          type="button"
          size="sm"
          :variant="period === p ? 'secondary' : 'ghost'"
          class="h-7 px-2.5 text-xs"
          @click="period = p"
        >
          {{ $t(`loans.valueHistory.periods.${p}`) }}
        </Button>
      </div>
    </div>

    <!-- Chart -->
    <LoansAmortizationChart :points="displayPoints" :mode="mode" :currency-code="activeCurrencyCode" />
  </div>
</template>

<script setup lang="ts">
import type { LoanApi } from '@/api/loans';
import { Button } from '@/components/lib/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/lib/ui/select';
import { useExchangeRates } from '@/composable/data-queries/currencies';
import { useFormatCurrency } from '@/composable/formatters';
import { useDateLocale } from '@/composable/use-date-locale';
import { useCurrenciesStore } from '@/stores';
import { useSessionStorage } from '@vueuse/core';
import { isAfter } from 'date-fns';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import {
  type LoanAmortizationSummary,
  computeAggregateLoanAmortizationSeries,
  computeLoanAmortizationSeries,
} from '../utils/loan-amortization-series';
import LoansAmortizationChart from './loans-amortization-chart.vue';

const props = defineProps<{
  loans: LoanApi[];
}>();

const periods = ['1Y', '3Y', '5Y', 'ALL'] as const;
type LoanAmortizationPeriod = (typeof periods)[number];

const selectedLoanId = ref<string>('all');
const mode = useSessionStorage<'balance' | 'payment'>('loans-amortization-mode', 'balance');
const period = useSessionStorage<LoanAmortizationPeriod>('loans-amortization-period', 'ALL');

const { formatAmountByCurrencyCode } = useFormatCurrency();
const { format: formatDate } = useDateLocale();
const { convert } = useExchangeRates();
const { baseCurrency } = storeToRefs(useCurrenciesStore());

// Reset to 'all' if selected loan disappears
watch(
  () => props.loans,
  (newLoans) => {
    if (selectedLoanId.value !== 'all' && !newLoans.some((l) => l.id === selectedLoanId.value)) {
      selectedLoanId.value = 'all';
    }
  },
);

const selectedLoan = computed(() =>
  selectedLoanId.value === 'all' ? null : props.loans.find((l) => l.id === selectedLoanId.value),
);

const activeCurrencyCode = computed(() => {
  if (selectedLoan.value) return selectedLoan.value.currencyCode;
  return baseCurrency.value?.currencyCode ?? 'USD';
});

const formatCurrency = (amount: number) => formatAmountByCurrencyCode(amount, activeCurrencyCode.value);

const summary = computed<LoanAmortizationSummary>(() => {
  if (selectedLoan.value) {
    const loan = selectedLoan.value;
    return computeLoanAmortizationSeries({
      originalPrincipal: loan.loanDetails.originalPrincipal,
      interestRate: loan.loanDetails.interestRate,
      startDate: loan.loanDetails.startDate,
      termMonths: loan.loanDetails.termMonths,
      plannedPayment: loan.loanDetails.plannedPayment,
      minPayment: loan.loanDetails.minPayment,
      currentBalance: loan.currentBalance,
    });
  }

  return computeAggregateLoanAmortizationSeries({
    loans: props.loans,
    convert,
    baseCode: baseCurrency.value?.currencyCode,
  });
});

const hasData = computed(() => summary.value.points.length > 0 && summary.value.totalPrincipal > 0);

const currentMonthIndex = computed(() => {
  const now = new Date();
  const points = summary.value.points;
  const idx = points.findIndex((p) => isAfter(p.date, now));
  return idx >= 0 ? idx : points.length - 1;
});

const primaryMetricValue = computed(() => {
  if (mode.value === 'balance') {
    return summary.value.currentBalance;
  }
  const currPoint = summary.value.points[currentMonthIndex.value];
  return currPoint?.monthlyPrincipal ?? 0;
});

const secondaryMetricValue = computed(() => {
  if (mode.value === 'balance') {
    return summary.value.totalInterest;
  }
  const currPoint = summary.value.points[currentMonthIndex.value];
  return currPoint?.monthlyInterest ?? 0;
});

const payoffDateDisplay = computed(() => {
  if (!summary.value.payoffDate) return null;
  return formatDate(summary.value.payoffDate, 'MMM yyyy');
});

const displayPoints = computed(() => {
  const all = summary.value.points;
  if (!all.length || period.value === 'ALL') return all;

  const monthsLimit = period.value === '1Y' ? 12 : period.value === '3Y' ? 36 : 60;
  const currentIdx = currentMonthIndex.value;
  const startIdx = Math.max(0, currentIdx - 2);
  const endIdx = Math.min(all.length, startIdx + monthsLimit);

  const sliced = all.slice(startIdx, endIdx);
  return sliced.length >= 2 ? sliced : all;
});
</script>
