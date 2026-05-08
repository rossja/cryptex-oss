<script lang="ts">
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    description: string;
    value: string;
    onChange: (id: string) => void;
    recentsKey: string;
    tip?: Snippet | null;
    /** Compact horizontal layout (default) — saves ~60% vertical space.
     *  Set false for the original stacked layout. */
    compact?: boolean;
  };
  let { label, description, value, onChange, recentsKey, tip = null, compact = true }: Props = $props();
</script>

{#if compact}
  <!-- Compact: role label on the left, picker fills the rest of the row -->
  <div class="flex flex-col gap-0.5">
    <div class="flex items-center gap-2">
      <span
        class="shrink-0 w-20 text-[11px] font-medium text-foreground"
        title={description}
      >{label}</span>
      <div class="min-w-0 flex-1">
        <ModelPickerV2
          {value}
          {onChange}
          {recentsKey}
          triggerClass="text-xs text-muted-foreground border border-border/40 rounded-md px-2 py-1 hover:border-border/70 hover:text-foreground transition-colors w-full justify-between"
        />
      </div>
    </div>
    {#if tip}{@render tip()}{/if}
  </div>
{:else}
  <div class="flex flex-col gap-1">
    <div class="flex items-baseline gap-2 text-xs">
      <span class="font-medium text-foreground">{label}</span>
      <span class="text-[10px] text-muted-foreground">{description}</span>
    </div>
    <ModelPickerV2
      {value}
      {onChange}
      {recentsKey}
      triggerClass="text-xs text-muted-foreground border border-border/40 rounded-md px-3 py-1 hover:border-border/70 hover:text-foreground transition-colors w-full justify-between"
    />
    {#if tip}{@render tip()}{/if}
  </div>
{/if}
