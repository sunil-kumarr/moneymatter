<template>
  <div class="flex flex-wrap items-center gap-1">
    <Button
      v-for="period in INVESTMENT_HISTORY_PERIODS"
      :key="period"
      type="button"
      size="sm"
      :variant="period === modelValue ? 'secondary' : 'ghost'"
      class="px-3"
      @click="emit('update:modelValue', period)"
    >
      {{ $t(`investments.valueHistory.periods.${period}`) }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';

import {
  INVESTMENT_HISTORY_PERIODS,
  type InvestmentHistoryPeriod,
} from '../composables/investment-value-history-period';

defineProps<{
  modelValue: InvestmentHistoryPeriod;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: InvestmentHistoryPeriod];
}>();
</script>
