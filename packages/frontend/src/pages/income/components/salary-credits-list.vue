<template>
  <Card class="@container/income-credits min-w-0">
    <CardHeader class="pb-4">
      <div class="flex items-center justify-between gap-3">
        <CardTitle class="text-lg">{{ $t('income.credits.title') }}</CardTitle>
        <CreateSalaryCreditDialog
          :source-id="sourceId"
          :currency-code="currencyCode"
          :component-template="componentTemplate"
        >
          <UiButton size="sm">
            <PlusIcon class="mr-1 size-4" />
            {{ $t('income.credits.addButton') }}
          </UiButton>
        </CreateSalaryCreditDialog>
      </div>
    </CardHeader>
    <CardContent class="pt-0">
      <div v-if="isLoading" class="text-muted-foreground py-8 text-center text-sm">
        {{ $t('income.credits.loading') }}
      </div>
      <div v-else-if="!credits || credits.length === 0" class="text-muted-foreground py-4 text-center text-sm">
        {{ $t('income.credits.empty') }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-150">
          <thead class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            <tr>
              <th class="px-3 py-2 text-left">{{ $t('income.credits.columns.date') }}</th>
              <th class="px-3 py-2 text-left">{{ $t('income.credits.columns.type') }}</th>
              <th class="px-3 py-2 text-right">{{ $t('income.credits.columns.gross') }}</th>
              <th class="px-3 py-2 text-right">{{ $t('income.credits.columns.deductions') }}</th>
              <th class="px-3 py-2 text-right">{{ $t('income.credits.columns.net') }}</th>
              <th class="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody class="divide-border divide-y">
            <template v-for="item in groupedCredits" :key="item.credit.id">
              <tr v-if="item.isFirstInFY" class="bg-muted/40">
                <td colspan="6" class="px-3 py-1.5">
                  <div class="flex items-center justify-between gap-4">
                    <span class="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                      {{ item.financialYear }}
                    </span>
                    <span class="text-app-income-color text-[11px] font-semibold tabular-nums">
                      {{ formatCurrency(fyTotals.get(item.financialYear)?.net ?? 0) }}
                    </span>
                  </div>
                </td>
              </tr>
              <tr class="hover:bg-muted/30 cursor-pointer" @click="toggleExpanded(item.credit.id)">
                <td class="px-3 py-2.5 text-sm">{{ item.credit.creditDate }}</td>
                <td class="px-3 py-2.5 text-sm">
                  <span class="inline-flex items-center gap-1.5">
                    {{ $t(`income.creditTypes.${item.credit.creditType}`) }}
                    <ResponsiveTooltip v-if="item.credit.links?.length" :delay-duration="100">
                      <LinkIcon class="text-success-text size-3.5" />
                      <template #content>{{ $t('income.credits.linkedTransactions.tooltip') }}</template>
                    </ResponsiveTooltip>
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right text-sm tabular-nums">
                  {{ formatCurrency(Number(item.credit.grossAmount)) }}
                </td>
                <td class="px-3 py-2.5 text-right text-sm tabular-nums">
                  {{ formatCurrency(Number(item.credit.totalDeductions)) }}
                </td>
                <td class="text-app-income-color px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
                  {{ formatCurrency(Number(item.credit.netAmount)) }}
                </td>
                <td class="px-3 py-2.5 text-right">
                  <ChevronDownIcon
                    class="text-muted-foreground ml-auto size-4 transition-transform"
                    :class="{ 'rotate-180': expandedId === item.credit.id }"
                  />
                </td>
              </tr>
              <tr v-if="expandedId === item.credit.id" class="bg-muted/20">
                <td colspan="6" class="px-3 py-3">
                  <div class="grid grid-cols-1 gap-1.5 @sm/income-credits:grid-cols-2">
                    <div
                      v-for="component in item.credit.components"
                      :key="component.id"
                      class="flex items-center justify-between text-xs"
                    >
                      <span class="text-muted-foreground">
                        {{ component.name }}
                        <span class="ml-1 opacity-70">({{ $t(`income.componentKinds.${component.kind}`) }})</span>
                      </span>
                      <span class="tabular-nums">{{ formatCurrency(Number(component.amount)) }}</span>
                    </div>
                  </div>
                  <div class="border-border/60 mt-3 border-t pt-3">
                    <p class="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wider uppercase">
                      {{ $t('income.credits.linkedTransactions.title') }}
                    </p>
                    <div v-if="item.credit.links?.length" class="flex flex-col gap-1">
                      <div
                        v-for="link in item.credit.links"
                        :key="link.id"
                        class="bg-background flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs"
                      >
                        <span class="min-w-0 flex-1 truncate">
                          {{ link.transaction?.note || $t('income.credits.linkDialog.noNote') }}
                          <span class="text-muted-foreground ml-1">
                            {{ link.transaction ? format(new Date(link.transaction.time), 'd MMM yyyy') : '' }}
                          </span>
                        </span>
                        <span class="text-app-income-color shrink-0 font-semibold tabular-nums">
                          {{ formatCurrency(Number(link.amount)) }}
                        </span>
                        <UiButton
                          variant="ghost"
                          size="icon-sm"
                          class="shrink-0"
                          :disabled="unlinkMutation.isPending.value"
                          :aria-label="$t('income.credits.linkedTransactions.unlinkButton')"
                          @click.stop="handleUnlink(item.credit.id, link.transactionId)"
                        >
                          <UnlinkIcon class="size-3.5" />
                        </UiButton>
                      </div>
                    </div>
                    <p v-else class="text-muted-foreground text-xs">
                      {{ $t('income.credits.linkedTransactions.empty') }}
                    </p>
                  </div>

                  <div class="mt-3 flex items-center justify-end gap-2">
                    <LinkTransactionDialog :credit-id="item.credit.id" :currency-code="currencyCode">
                      <UiButton variant="outline" size="sm" @click.stop>
                        <LinkIcon class="size-3.5" />
                        {{ $t('income.credits.linkedTransactions.linkButton') }}
                      </UiButton>
                    </LinkTransactionDialog>
                    <EditSalaryCreditDialog :credit="item.credit" :currency-code="currencyCode">
                      <UiButton variant="outline" size="sm" @click.stop>
                        <PencilIcon class="size-3.5" />
                        {{ $t('income.credits.editButton') }}
                      </UiButton>
                    </EditSalaryCreditDialog>
                    <CreateSalaryCreditDialog
                      :source-id="sourceId"
                      :currency-code="currencyCode"
                      :component-template="componentTemplate"
                      :duplicate-from="item.credit"
                    >
                      <UiButton variant="outline" size="sm" @click.stop>
                        <CopyIcon class="size-3.5" />
                        {{ $t('income.credits.duplicateButton') }}
                      </UiButton>
                    </CreateSalaryCreditDialog>
                    <UiButton
                      variant="outline"
                      size="sm"
                      class="text-destructive-text"
                      :disabled="deleteMutation.isPending.value"
                      @click.stop="handleDelete(item.credit.id)"
                    >
                      <Trash2Icon class="size-3.5" />
                      {{ $t('income.credits.deleteButton') }}
                    </UiButton>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import ResponsiveTooltip from '@/components/common/responsive-tooltip.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lib/ui/card';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import {
  useDeleteIncomeCredit,
  useIncomeCredits,
  useUnlinkTransactionFromCredit,
} from '@/composable/data-queries/income/credits';
import { useFormatCurrency } from '@/composable/formatters';
import { captureException } from '@/lib/sentry';
import type { IncomeComponentTemplateItem } from '@bt/shared/types/income';
import { ChevronDownIcon, CopyIcon, LinkIcon, PencilIcon, PlusIcon, Trash2Icon, UnlinkIcon } from '@lucide/vue';
import { format } from 'date-fns';
import { ref, computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';

import CreateSalaryCreditDialog from './create-salary-credit-dialog.vue';
import EditSalaryCreditDialog from './edit-salary-credit-dialog.vue';
import LinkTransactionDialog from './link-transaction-dialog.vue';

const props = defineProps<{
  sourceId: string;
  currencyCode: string;
  componentTemplate?: IncomeComponentTemplateItem[] | null;
}>();

const sourceId = toRef(props, 'sourceId');
const { data: credits, isLoading } = useIncomeCredits(sourceId);

/** Returns the Indian Financial Year string (e.g. 'FY 2024-25') for a YYYY-MM-DD date string. */
const getCreditFinancialYear = (creditDate: string): string => {
  const [yearStr, monthStr] = creditDate.split('-');
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10); // 1-based
  if (month >= 4) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  }
  return `FY ${year - 1}-${String(year).slice(-2)}`;
};

/** Net / gross / deduction totals keyed by FY string, e.g. 'FY 2024-25'. */
const fyTotals = computed(() => {
  const map = new Map<string, { net: number; gross: number; deductions: number }>();
  for (const credit of credits.value ?? []) {
    const fy = getCreditFinancialYear(credit.creditDate);
    const existing = map.get(fy) ?? { net: 0, gross: 0, deductions: 0 };
    map.set(fy, {
      net: existing.net + Number(credit.netAmount),
      gross: existing.gross + Number(credit.grossAmount),
      deductions: existing.deductions + Number(credit.totalDeductions),
    });
  }
  return map;
});

const groupedCredits = computed(() => {
  if (!credits.value) return [];
  let lastFY = '';
  return credits.value.map((credit) => {
    const financialYear = getCreditFinancialYear(credit.creditDate);
    const isFirstInFY = financialYear !== lastFY;
    lastFY = financialYear;
    return { credit, financialYear, isFirstInFY };
  });
});

const { t } = useI18n();
const { addNotification } = useNotificationCenter();
const deleteMutation = useDeleteIncomeCredit();
const unlinkMutation = useUnlinkTransactionFromCredit();

const expandedId = ref<string | null>(null);
const toggleExpanded = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id;
};

const { formatAmountByCurrencyCode } = useFormatCurrency();
const formatCurrency = (amount: number) => formatAmountByCurrencyCode(amount, props.currencyCode);

const handleDelete = async (creditId: string) => {
  try {
    await deleteMutation.mutateAsync(creditId);
    addNotification({ text: t('income.credits.deleteSuccess'), type: NotificationType.success });
    if (expandedId.value === creditId) expandedId.value = null;
  } catch (error) {
    addNotification({ text: t('income.credits.deleteError'), type: NotificationType.error });
    captureException({ error, context: { source: 'salaryCreditsList' } });
  }
};

const handleUnlink = async (creditId: string, transactionId: string) => {
  try {
    await unlinkMutation.mutateAsync({ creditId, transactionId });
    addNotification({ text: t('income.credits.linkedTransactions.unlinkSuccess'), type: NotificationType.success });
  } catch (error) {
    addNotification({ text: t('income.credits.linkedTransactions.unlinkError'), type: NotificationType.error });
    captureException({ error, context: { source: 'salaryCreditsList' } });
  }
};
</script>
