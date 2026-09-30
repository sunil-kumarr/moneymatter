<script setup lang="ts">
import * as transactionGroupsApi from '@/api/transaction-groups';
import type { TransactionGroupResponse } from '@/api/transaction-groups';
import { Button } from '@/components/lib/ui/button';
import { Card } from '@/components/lib/ui/card';
import InputField from '@/components/fields/input-field.vue';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import { invalidateTransactionGroupQueries } from '@/composable/data-queries/transaction-groups';
import { useNotificationCenter } from '@/components/notification-center';
import { extractApiErrorMessage } from '@/js/errors';
import { useFormatCurrency } from '@/composable/formatters';
import { useQueryClient, useQuery } from '@tanstack/vue-query';
import {
  Trash2Icon,
  CalendarIcon,
  HashIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  PencilIcon,
  ArrowRightIcon,
  LayersIcon,
} from '@lucide/vue';
import { computed, reactive, ref } from 'vue';
import { format } from 'date-fns';

import TransactionGroupDialog from './transaction-group-dialog.vue';
import EditGroupDialog from './edit-group-dialog.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const queryClient = useQueryClient();
const { addErrorNotification } = useNotificationCenter();
const { formatBaseCurrency } = useFormatCurrency();

const { data: groups, isLoading } = useQuery({
  queryKey: VUE_QUERY_CACHE_KEYS.transactionGroupsList,
  queryFn: () => transactionGroupsApi.loadTransactionGroups(),
  initialData: [],
});

const searchQuery = ref('');

const filteredGroups = computed(() => {
  if (!searchQuery.value) return groups.value;
  const query = searchQuery.value.toLowerCase();
  return groups.value.filter((g) => g.name.toLowerCase().includes(query) || g.note?.toLowerCase().includes(query));
});

// Per-group summary helpers
const getNet = (group: TransactionGroupResponse) => (group.incomeAmount ?? 0) - (group.expenseAmount ?? 0);

const hasBothTypes = (group: TransactionGroupResponse) =>
  (group.incomeAmount ?? 0) > 0 && (group.expenseAmount ?? 0) > 0;

const formatDateRange = ({ group }: { group: TransactionGroupResponse }) => {
  if (!group.dateFrom && !group.dateTo) return '';
  const from = group.dateFrom ? format(new Date(group.dateFrom), 'd MMM yyyy') : '';
  const to = group.dateTo ? format(new Date(group.dateTo), 'd MMM yyyy') : '';
  if (from === to) return from;
  return `${from} – ${to}`;
};

// Detail dialog state
const dialogState = reactive({
  isOpen: false,
  key: 0,
  groupId: undefined as string | undefined,
});

const openGroupDialog = ({ groupId }: { groupId: string }) => {
  dialogState.groupId = groupId;
  dialogState.key++;
  dialogState.isOpen = true;
};

// Edit dialog state
const editState = reactive({
  isOpen: false,
  group: null as TransactionGroupResponse | null,
});

const openEdit = (event: Event, group: TransactionGroupResponse) => {
  event.stopPropagation();
  editState.group = group;
  editState.isOpen = true;
};

const handleEditSaved = () => {
  invalidateTransactionGroupQueries({ queryClient });
};

// Delete confirmation
const deleteState = reactive({
  isOpen: false,
  groupId: undefined as string | undefined,
  groupName: '',
});

const confirmDelete = (event: Event, group: TransactionGroupResponse) => {
  event.stopPropagation();
  deleteState.groupId = group.id;
  deleteState.groupName = group.name;
  deleteState.isOpen = true;
};

const handleDelete = async () => {
  if (!deleteState.groupId) return;
  try {
    await transactionGroupsApi.deleteTransactionGroup({ id: deleteState.groupId });
  } catch (error) {
    addErrorNotification(extractApiErrorMessage(error) || t('transactions.transactionGroups.groupsPage.deleteError'));
  } finally {
    deleteState.isOpen = false;
    invalidateTransactionGroupQueries({ queryClient });
  }
};
</script>

<template>
  <div class="flex flex-col gap-6 p-4 md:px-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('transactions.transactionGroups.groupsPage.title') }}</h1>
    </div>

    <!-- Search -->
    <div class="max-w-sm">
      <InputField
        v-model="searchQuery"
        :placeholder="t('transactions.transactionGroups.groupsPage.searchPlaceholder')"
      />
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="i in 6" :key="i" class="bg-muted h-44 animate-pulse rounded-xl" />
    </div>

    <!-- Empty state -->
    <Card v-else-if="filteredGroups.length === 0" class="flex flex-col items-center justify-center gap-2 py-16">
      <LayersIcon class="text-muted-foreground size-10 opacity-40" />
      <p class="text-muted-foreground text-sm font-medium">
        {{
          searchQuery ? 'No groups match your search.' : t('transactions.transactionGroups.groupsPage.noGroupsMessage')
        }}
      </p>
      <p class="text-muted-foreground text-xs">
        {{ t('transactions.transactionGroups.groupsPage.emptyStateHint') }}
      </p>
    </Card>

    <!-- Groups grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="group in filteredGroups"
        :key="group.id"
        class="hover:border-primary/30 group relative flex cursor-pointer flex-col gap-0 overflow-hidden p-0 transition-all duration-150 hover:shadow-sm"
        @click="openGroupDialog({ groupId: group.id })"
      >
        <!-- Card header -->
        <div class="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
          <div class="min-w-0 flex-1">
            <h3 class="truncate leading-tight font-semibold">{{ group.name }}</h3>
            <p v-if="group.note" class="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{{ group.note }}</p>
          </div>
          <!-- Quick actions -->
          <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon" class="size-7" @click="openEdit($event, group)">
              <PencilIcon class="size-3.5" />
            </Button>
            <Button variant="ghost-destructive" size="icon" class="size-7" @click="confirmDelete($event, group)">
              <Trash2Icon class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Financial stats -->
        <div class="bg-muted/40 border-t px-4 py-3">
          <!-- Net amount — always shown -->
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-muted-foreground text-xs font-medium">Net</span>
            <span
              class="text-base font-bold tabular-nums"
              :class="getNet(group) >= 0 ? 'text-app-income-color' : 'text-app-expense-color'"
            >
              {{ formatBaseCurrency(getNet(group)) }}
            </span>
          </div>

          <!-- Income / Expense breakdown — only when both exist -->
          <template v-if="hasBothTypes(group)">
            <div class="mt-2 grid grid-cols-2 gap-2">
              <div class="bg-background rounded-md px-2.5 py-1.5">
                <div class="text-muted-foreground mb-0.5 flex items-center gap-1 text-xs">
                  <TrendingUpIcon class="text-app-income-color size-3" />
                  <span>Income</span>
                </div>
                <p class="text-app-income-color text-sm font-semibold tabular-nums">
                  {{ formatBaseCurrency(group.incomeAmount ?? 0) }}
                </p>
              </div>
              <div class="bg-background rounded-md px-2.5 py-1.5">
                <div class="text-muted-foreground mb-0.5 flex items-center gap-1 text-xs">
                  <TrendingDownIcon class="text-app-expense-color size-3" />
                  <span>Expenses</span>
                </div>
                <p class="text-app-expense-color text-sm font-semibold tabular-nums">
                  {{ formatBaseCurrency(group.expenseAmount ?? 0) }}
                </p>
              </div>
            </div>
          </template>

          <!-- Expense-only summary -->
          <template v-else-if="(group.expenseAmount ?? 0) > 0 && !(group.incomeAmount ?? 0)">
            <div class="mt-2">
              <div class="bg-background rounded-md px-2.5 py-1.5">
                <div class="text-muted-foreground mb-0.5 flex items-center gap-1 text-xs">
                  <TrendingDownIcon class="text-app-expense-color size-3" />
                  <span>Total expenses</span>
                </div>
                <p class="text-app-expense-color text-sm font-semibold tabular-nums">
                  {{ formatBaseCurrency(group.expenseAmount ?? 0) }}
                </p>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer meta -->
        <div class="text-muted-foreground flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs">
          <div class="flex items-center gap-3">
            <span v-if="group.transactionCount !== undefined" class="flex items-center gap-1">
              <HashIcon class="size-3" />
              {{ group.transactionCount }} {{ t('transactions.transactionGroups.groupsPage.transactionCountLabel') }}
            </span>
            <span v-if="group.dateFrom" class="flex items-center gap-1">
              <CalendarIcon class="size-3" />
              {{ formatDateRange({ group }) }}
            </span>
          </div>
          <ArrowRightIcon class="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
        </div>
      </Card>
    </div>

    <!-- Group detail dialog -->
    <TransactionGroupDialog
      v-model:open="dialogState.isOpen"
      :key="dialogState.key"
      :group-id="dialogState.groupId"
      @deleted="invalidateTransactionGroupQueries({ queryClient })"
      @updated="invalidateTransactionGroupQueries({ queryClient })"
    />

    <!-- Edit dialog -->
    <EditGroupDialog v-model:open="editState.isOpen" :group="editState.group" @saved="handleEditSaved" />

    <!-- Delete confirmation dialog -->
    <ResponsiveAlertDialog
      v-model:open="deleteState.isOpen"
      confirm-label="Delete"
      confirm-variant="destructive"
      @confirm="handleDelete"
    >
      <template #title>{{ t('transactionGroups.groupDialog.deleteGroupTitle') }}</template>
      <template #description>
        {{ t('transactionGroups.groupDialog.deleteGroupDescription', { groupName: deleteState.groupName }) }}
      </template>
    </ResponsiveAlertDialog>
  </div>
</template>
