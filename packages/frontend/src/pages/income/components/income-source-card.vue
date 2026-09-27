<template>
  <router-link :to="{ name: ROUTES_NAMES.incomeSourceDetail, params: { sourceId: source.id } }" class="block h-full">
    <Card class="group relative h-full overflow-hidden transition-all duration-200 hover:shadow-md">
      <div class="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('income.list.card.moreAriaLabel')"
              @click.stop.prevent
            >
              <MoreVerticalIcon class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" @click.stop.prevent>
            <DropdownMenuItem @select="handleView">
              <EyeIcon class="size-4" />
              {{ $t('income.list.card.view') }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-destructive-text focus:bg-destructive-text/10 focus:text-destructive-text"
              @select="isDeleteDialogOpen = true"
            >
              <Trash2Icon class="size-4" />
              {{ $t('income.list.card.delete') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardHeader class="p-4 pb-2">
        <div class="flex items-start gap-3">
          <div class="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
            <BriefcaseIcon class="text-primary-text size-5" />
          </div>
          <div class="min-w-0 flex-1 pr-6">
            <div class="flex min-w-0 items-center gap-2">
              <h3 class="truncate text-base leading-tight font-semibold tracking-tight">{{ source.name }}</h3>
              <span
                v-if="source.status === INCOME_SOURCE_STATUS.ended"
                class="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium tracking-wider uppercase"
              >
                {{ $t('income.list.endedBadge') }}
              </span>
            </div>
            <p v-if="source.employerName || source.jobTitle" class="text-muted-foreground mt-0.5 truncate text-xs">
              {{ [source.jobTitle, source.employerName].filter(Boolean).join(' · ') }}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent class="p-4 pt-2">
        <div v-if="isLoading" class="space-y-1.5">
          <div class="bg-muted h-7 w-28 animate-pulse rounded" />
          <div class="bg-muted h-4 w-20 animate-pulse rounded" />
        </div>
        <template v-else-if="summary">
          <p class="text-2xl font-semibold tracking-tight">
            {{ formatCurrency(Number(summary.totalNet), summary.currencyCode) }}
          </p>
          <p class="text-muted-foreground mt-0.5 text-xs">{{ $t('income.list.totalIncome') }}</p>
          <p v-if="summary.latestCreditDate" class="text-muted-foreground mt-2 text-xs">
            {{ $t('income.list.lastCredit', { date: summary.latestCreditDate }) }}
          </p>
        </template>
      </CardContent>
    </Card>
  </router-link>

  <DeleteIncomeSourceDialog v-model:open="isDeleteDialogOpen" :source-id="source.id" />
</template>

<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/common/dropdown-menu';
import { useIncomeSourceSummary } from '@/composable/data-queries/income/summary';
import { useFormatCurrency } from '@/composable/formatters';
import { ROUTES_NAMES } from '@/routes/constants';
import { INCOME_SOURCE_STATUS, type IncomeSourceModel } from '@bt/shared/types/income';
import { BriefcaseIcon, EyeIcon, MoreVerticalIcon, Trash2Icon } from '@lucide/vue';
import { ref, toRef } from 'vue';
import { useRouter } from 'vue-router';

import DeleteIncomeSourceDialog from './delete-income-source-dialog.vue';

const props = defineProps<{ source: IncomeSourceModel }>();
const sourceId = toRef(() => props.source.id);

const { data: summary, isLoading } = useIncomeSourceSummary(sourceId);

const { formatAmountByCurrencyCode } = useFormatCurrency();
const formatCurrency = (amount: number, currencyCode: string) => formatAmountByCurrencyCode(amount, currencyCode);

const router = useRouter();
const isDeleteDialogOpen = ref(false);

const handleView = () => {
  router.push({ name: ROUTES_NAMES.incomeSourceDetail, params: { sourceId: props.source.id } });
};
</script>
