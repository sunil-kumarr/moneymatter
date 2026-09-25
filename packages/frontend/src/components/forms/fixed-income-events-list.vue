<script setup lang="ts">
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import FixedIncomeEventForm from '@/components/forms/fixed-income-event-form.vue';
import { Button } from '@/components/lib/ui/button';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useDeleteFixedIncomeEvent, useFixedIncomePositionEvents } from '@/composable/data-queries/fixed-income/events';
import { useFormatCurrency } from '@/composable/formatters';
import { getApiErrorMessage } from '@/js/errors';
import { captureException } from '@/lib/sentry';
import {
  FIXED_INCOME_EVENT_TYPE,
  type FixedIncomeEventModel,
  type FixedIncomePositionModel,
} from '@bt/shared/types/investments';
import { ArrowDownLeftIcon, ArrowUpRightIcon, HistoryIcon, PlusIcon, Trash2Icon } from '@lucide/vue';
import { format } from 'date-fns';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ position: FixedIncomePositionModel }>();
const emit = defineEmits<{ (e: 'changed'): void }>();

const { t } = useI18n();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const { formatAmountByCurrencyCode } = useFormatCurrency();

const { data: events, isLoading, invalidate } = useFixedIncomePositionEvents(computed(() => props.position.id));

const sortedEvents = computed(() =>
  [...(events.value ?? [])].sort(
    (a, b) => a.eventDate.localeCompare(b.eventDate) || a.createdAt.getTime() - b.createdAt.getTime(),
  ),
);

const EVENT_TYPE_LABELS: Record<FIXED_INCOME_EVENT_TYPE, string> = {
  [FIXED_INCOME_EVENT_TYPE.initial_investment]: 'Initial Investment',
  [FIXED_INCOME_EVENT_TYPE.interest_accrual_payout]: 'Interest Payout',
  [FIXED_INCOME_EVENT_TYPE.partial_repayment]: 'Partial Repayment',
  [FIXED_INCOME_EVENT_TYPE.full_repayment]: 'Full Repayment',
  [FIXED_INCOME_EVENT_TYPE.maturity]: 'Maturity',
  [FIXED_INCOME_EVENT_TYPE.writedown]: 'Writedown',
  [FIXED_INCOME_EVENT_TYPE.fee]: 'Fee',
};

// 'credit' = cash flowing out of the position to the user (interest/principal paid
// out); 'debit' = cash flowing into the position (funding it) or a recognized loss.
type EventDirection = 'credit' | 'debit';

const EVENT_TYPE_DIRECTION: Record<FIXED_INCOME_EVENT_TYPE, EventDirection> = {
  [FIXED_INCOME_EVENT_TYPE.initial_investment]: 'debit',
  [FIXED_INCOME_EVENT_TYPE.interest_accrual_payout]: 'credit',
  [FIXED_INCOME_EVENT_TYPE.partial_repayment]: 'credit',
  [FIXED_INCOME_EVENT_TYPE.full_repayment]: 'credit',
  [FIXED_INCOME_EVENT_TYPE.maturity]: 'credit',
  [FIXED_INCOME_EVENT_TYPE.writedown]: 'debit',
  [FIXED_INCOME_EVENT_TYPE.fee]: 'debit',
};

const DIRECTION_COLOR_CLASS: Record<EventDirection, string> = {
  credit: 'text-app-income-color',
  debit: 'text-app-expense-color',
};

const parseApiDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const formatEventDate = (s: string): string => format(parseApiDate(s), 'dd MMM yyyy');

const addEventOpen = ref(false);
const eventPendingDelete = ref<FixedIncomeEventModel | null>(null);

const deleteMutation = useDeleteFixedIncomeEvent();

const confirmDelete = async () => {
  const event = eventPendingDelete.value;
  if (!event) return;
  try {
    await deleteMutation.mutateAsync(event.id);
    addSuccessNotification('Event deleted');
    invalidate();
    emit('changed');
  } catch (err) {
    addErrorNotification(
      getApiErrorMessage({
        e: err,
        t,
        conflictKey: 'common.somethingWentWrong',
        fallbackKey: 'common.somethingWentWrong',
      }),
    );
    captureException({ error: err, context: { source: 'confirmDeleteFixedIncomeEvent', eventId: event.id } });
  } finally {
    eventPendingDelete.value = null;
  }
};

const onEventSaved = () => {
  addEventOpen.value = false;
  invalidate();
  emit('changed');
};
</script>

<template>
  <div class="grid gap-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium">Events</h3>
      <Button size="sm" variant="secondary" @click="addEventOpen = true">
        <PlusIcon class="mr-1 size-4" />
        Add Event
      </Button>
    </div>

    <div v-if="isLoading" class="text-muted-foreground py-6 text-center text-sm">Loading…</div>
    <div v-else-if="sortedEvents.length === 0" class="text-muted-foreground py-6 text-center text-sm">
      No events recorded yet.
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-125 text-sm">
        <thead class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          <tr>
            <th class="px-3 py-2 text-left">Date</th>
            <th class="px-3 py-2 text-left">Type</th>
            <th class="px-3 py-2 text-right">Amount</th>
            <th class="px-3 py-2 text-left">Notes</th>
            <th class="px-3 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody class="divide-border divide-y">
          <tr v-for="event in sortedEvents" :key="event.id" class="hover:bg-muted/30 transition-colors">
            <td class="px-3 py-2 whitespace-nowrap">{{ formatEventDate(event.eventDate) }}</td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-1.5" :class="DIRECTION_COLOR_CLASS[EVENT_TYPE_DIRECTION[event.type]]">
                <ArrowDownLeftIcon v-if="EVENT_TYPE_DIRECTION[event.type] === 'credit'" class="size-3.5 shrink-0" />
                <ArrowUpRightIcon v-else class="size-3.5 shrink-0" />
                <span class="text-foreground">{{ EVENT_TYPE_LABELS[event.type] }}</span>
                <DesktopOnlyTooltip
                  v-if="!event.resetsAccrualClock"
                  content="History only — doesn't reset the accrual clock; interest keeps compounding through this date"
                >
                  <HistoryIcon class="text-muted-foreground size-3.5 shrink-0" />
                </DesktopOnlyTooltip>
              </div>
            </td>
            <td
              class="px-3 py-2 text-right tabular-nums"
              :class="DIRECTION_COLOR_CLASS[EVENT_TYPE_DIRECTION[event.type]]"
            >
              <template v-if="event.grossAmount">
                {{ EVENT_TYPE_DIRECTION[event.type] === 'credit' ? '+' : '−' }}
                {{ formatAmountByCurrencyCode(Number(event.grossAmount), event.currencyCode) }}
              </template>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="text-muted-foreground max-w-50 truncate px-3 py-2">{{ event.notes ?? '' }}</td>
            <td class="px-3 py-2 text-right">
              <Button
                variant="ghost-destructive"
                size="icon"
                class="size-8"
                aria-label="Delete event"
                :disabled="event.type === FIXED_INCOME_EVENT_TYPE.initial_investment"
                @click="eventPendingDelete = event"
              >
                <Trash2Icon class="size-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <ResponsiveDialog v-model:open="addEventOpen">
    <template #title>Record Event</template>
    <FixedIncomeEventForm :position="position" @saved="onEventSaved" @cancel="addEventOpen = false" />
  </ResponsiveDialog>

  <ResponsiveAlertDialog
    :open="!!eventPendingDelete"
    confirm-label="Delete"
    confirm-variant="destructive"
    :confirm-disabled="deleteMutation.isPending.value"
    @update:open="(v) => !v && (eventPendingDelete = null)"
    @confirm="confirmDelete"
  >
    <template #title>Delete Event</template>
    <template #description>
      Are you sure you want to delete this {{ eventPendingDelete ? EVENT_TYPE_LABELS[eventPendingDelete.type] : '' }}
      event? This cannot be undone.
    </template>
  </ResponsiveAlertDialog>
</template>
