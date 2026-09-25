<template>
  <InputField
    :model-value="modelValue"
    :placeholder="placeholder"
    @update:model-value="$emit('update:model-value', ($event as string) ?? '')"
  >
    <template #iconLeading>
      <SearchIcon class="text-muted-foreground size-4" />
    </template>

    <template v-if="modelValue" #iconTrailing>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        :aria-label="$t('common.actions.clear')"
        class="text-muted-foreground hover:text-foreground size-6"
        @click="$emit('update:model-value', '')"
      >
        <XIcon class="size-4" />
      </Button>
    </template>
  </InputField>
</template>

<script lang="ts" setup>
import InputField from '@/components/fields/input-field.vue';
import { Button } from '@/components/lib/ui/button';
import { SearchIcon, XIcon } from '@lucide/vue';

defineProps<{
  modelValue: string;
  placeholder: string;
}>();

defineEmits<{
  'update:model-value': [value: string];
}>();
</script>
