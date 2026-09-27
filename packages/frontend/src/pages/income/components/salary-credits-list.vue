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
            <template v-for="credit in credits" :key="credit.id">
              <tr class="hover:bg-muted/30 cursor-pointer" @click="toggleExpanded(credit.id)">
                <td class="px-3 py-2.5 text-sm">{{ credit.creditDate }}</td>
                <td class="px-3 py-2.5 text-sm">
                  <span class="inline-flex items-center gap-1.5">
                    {{ $t(`income.creditTypes.${credit.creditType}`) }}
                    <ResponsiveTooltip v-if="credit.links?.length" :delay-duration="100">
                      <LinkIcon class="text-success-text size-3.5" />
                      <template #content>{{ $t('income.credits.linkedTransactions.tooltip') }}</template>
                    </ResponsiveTooltip>
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right text-sm tabular-nums">
                  {{ formatCurrency(Number(credit.grossAmount)) }}
                </td>
                <td class="px-3 py-2.5 text-right text-sm tabular-nums">
                  {{ formatCurrency(Number(credit.totalDeductions)) }}
                </td>
                <td class="text-app-income-color px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
                  {{ formatCurrency(Number(credit.netAmount)) }}
                </td>
                <td class="px-3 py-2.5 text-right">
                  <ChevronDownIcon
                    class="text-muted-foreground ml-auto size-4 transition-transform"
                    :class="{ 'rotate-180': expandedId === credit.id }"
                  />
                </td>
              </tr>
              <tr v-if="expandedId === credit.id" class="bg-muted/20">
                <td colspan="6" class="px-3 py-3">
                  <div class="grid grid-cols-1 gap-1.5 @sm/income-credits:grid-cols-2">
                    <div
                      v-for="component in credit.components"
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
                    <div v-if="credit.links?.length" class="flex flex-col gap-1">
                      <div
                        v-for="link in credit.links"
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
                          @click.stop="handleUnlink(credit.id, link.transactionId)"
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
                    <LinkTransactionDialog :credit-id="credit.id" :currency-code="currencyCode">
                      <UiButton variant="outline" size="sm" @click.stop>
                        <LinkIcon class="size-3.5" />
                        {{ $t('income.credits.linkedTransactions.linkButton') }}
                      </UiButton>
                    </LinkTransactionDialog>
                    <EditSalaryCreditDialog :credit="credit" :currency-code="currencyCode">
                      <UiButton variant="outline" size="sm" @click.stop>
                        <PencilIcon class="size-3.5" />
                        {{ $t('income.credits.editButton') }}
                      </UiButton>
                    </EditSalaryCreditDialog>
                    <CreateSalaryCreditDialog
                      :source-id="sourceId"
                      :currency-code="currencyCode"
                      :component-template="componentTemplate"
                      :duplicate-from="credit"
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
                      @click.stop="handleDelete(credit.id)"
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
import { ref, toRef } from 'vue';
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
