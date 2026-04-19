<script lang="ts">
  import { allTechniques } from '$lib/chat/techniques/registry';
  import type { Technique } from '$lib/chat/techniques/types';
  import { Combobox, type ComboboxOption } from '$lib/components/ui/combobox';
  import LayerParamEditor from './LayerParamEditor.svelte';
  import X from 'lucide-svelte/icons/x';

  type Props = {
    index: number;
    value: string;
    params?: Record<string, unknown>;
    onChange: (id: string) => void;
    onParamsChange?: (p: Record<string, unknown>) => void;
    onRemove: () => void;
  };
  let { index, value, params = {}, onChange, onParamsChange = () => {}, onRemove }: Props = $props();

  const CHAIN_CATEGORIES = new Set(['mutate', 'classifier', 'composite']);
  const CATEGORY_LABELS: Record<string, string> = {
    mutate: 'Mutators',
    classifier: 'Classifiers',
    composite: 'Composites'
  };

  const options = $derived<ComboboxOption[]>(
    allTechniques()
      .filter((t: Technique) => CHAIN_CATEGORIES.has(t.category))
      .sort((a: Technique, b: Technique) =>
        a.category === b.category
          ? a.name.localeCompare(b.name)
          : a.category.localeCompare(b.category)
      )
      .map((t) => ({
        id: t.id,
        label: t.name,
        group: CATEGORY_LABELS[t.category] ?? t.category,
        description: t.description
      }))
  );
</script>

<div class="flex flex-col rounded-md border border-border/50 bg-card px-3 py-2">
  <div class="flex items-center gap-2">
    <span class="shrink-0 w-14 text-[10px] font-semibold text-muted-foreground">
      Layer {index + 1}
    </span>

    <div class="min-w-0 flex-1">
      <Combobox
        value={value}
        {options}
        placeholder="— pick technique —"
        onChange={onChange}
      />
    </div>

    <button
      type="button"
      onclick={onRemove}
      aria-label="Remove layer {index + 1}"
      class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <X size={13} />
    </button>
  </div>

  {#if value}
    <LayerParamEditor techniqueId={value} {params} onChange={onParamsChange} />
  {/if}
</div>
