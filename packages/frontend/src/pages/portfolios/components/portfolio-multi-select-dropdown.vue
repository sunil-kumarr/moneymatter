<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        type="button"
        :disabled="disabled || isLoading || enabledPortfolios.length === 0"
        class="border-input bg-input-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-8 max-w-56 min-w-36 items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-start text-xs font-normal transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span class="truncate">{{ triggerLabel }}</span>
        <ChevronDownIcon
          class="size-3.5 shrink-0 opacity-50 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
        />
      </button>
    </PopoverTrigger>

    <PopoverContent
      class="bg-popover text-popover-foreground z-(--z-dialog) max-h-80 w-56 overflow-hidden rounded-md border p-1 shadow-md"
      align="start"
      :side-offset="4"
    >
      <div class="space-y-1">
        <!-- Select All Option -->
        <div
          role="checkbox"
          :aria-checked="isAllSelected"
          class="hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs select-none"
          @click="toggleSelectAll"
        >
          <Checkbox :model-value="isAllSelected" @click.stop @update:model-value="toggleSelectAll" />
          <span class="font-medium">
            {{
              $te('portfolioDetail.realizedPnlChart.allPortfolios')
                ? $t('portfolioDetail.realizedPnlChart.allPortfolios')
                : 'All Portfolios'
            }}
          </span>
        </div>

        <div class="bg-border my-1 h-px" />

        <!-- Portfolios List with Checkboxes -->
        <ScrollArea class="max-h-56" viewport-class="max-h-56">
          <div class="space-y-0.5">
            <div
              v-for="p in enabledPortfolios"
              :key="p.id"
              role="checkbox"
              :aria-checked="isPortfolioSelected(p.id)"
              :class="
                cn(
                  'hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs select-none',
                  isPortfolioSelected(p.id) && 'bg-primary/5',
                )
              "
              @click="togglePortfolio(p.id)"
            >
              <Checkbox
                :model-value="isPortfolioSelected(p.id)"
                @click.stop
                @update:model-value="togglePortfolio(p.id)"
              />
              <span class="min-w-0 flex-1 truncate text-xs">{{ p.name }}</span>
            </div>
          </div>
        </ScrollArea>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { Checkbox } from '@/components/lib/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/lib/ui/popover';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { usePortfolios } from '@/composable/data-queries/portfolios';
import { cn } from '@/lib/utils';
import { ChevronDownIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    modelValue?: string[];
    disabled?: boolean;
  }>(),
  {
    modelValue: () => [],
    disabled: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const { t, te } = useI18n();
const { data: portfolios, isLoading } = usePortfolios();

const isOpen = ref(false);

const enabledPortfolios = computed(() => (portfolios.value ?? []).filter((p) => p.isEnabled));
const enabledIds = computed(() => enabledPortfolios.value.map((p) => p.id));

const isAllSelected = computed(
  () =>
    !props.modelValue || props.modelValue.length === 0 || props.modelValue.length === enabledPortfolios.value.length,
);

const isPortfolioSelected = (id: string) => {
  if (isAllSelected.value) return true;
  return props.modelValue.includes(id);
};

const triggerLabel = computed(() => {
  if (isAllSelected.value) {
    return te('portfolioDetail.realizedPnlChart.allPortfolios')
      ? t('portfolioDetail.realizedPnlChart.allPortfolios')
      : 'All Portfolios';
  }
  const count = props.modelValue.length;
  if (count === 1) {
    const p = enabledPortfolios.value.find((item) => item.id === props.modelValue[0]);
    return (
      p?.name ??
      (te('portfolioDetail.realizedPnlChart.selectedPortfolios')
        ? t('portfolioDetail.realizedPnlChart.selectedPortfolios', { count: 1 })
        : '1 Portfolio')
    );
  }
  return te('portfolioDetail.realizedPnlChart.selectedPortfolios')
    ? t('portfolioDetail.realizedPnlChart.selectedPortfolios', { count })
    : `${count} Portfolios`;
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // If all are selected, uncheck down to first portfolio
    if (enabledPortfolios.value.length > 1) {
      emit('update:modelValue', [enabledPortfolios.value[0]!.id]);
    } else {
      emit('update:modelValue', []);
    }
  } else {
    emit('update:modelValue', []);
  }
};

const togglePortfolio = (portfolioId: string) => {
  if (isAllSelected.value) {
    // Transition from all selected -> all except this one
    const remaining = enabledIds.value.filter((id) => id !== portfolioId);
    emit('update:modelValue', remaining.length > 0 ? remaining : []);
    return;
  }

  const set = new Set(props.modelValue);
  if (set.has(portfolioId)) {
    set.delete(portfolioId);
  } else {
    set.add(portfolioId);
  }

  const result = Array.from(set);
  if (result.length === 0 || result.length === enabledIds.value.length) {
    emit('update:modelValue', []);
  } else {
    emit('update:modelValue', result);
  }
};
</script>
