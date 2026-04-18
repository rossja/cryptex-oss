<script lang="ts">
  import type { Technique } from '$lib/chat/techniques/types';
  import TechniqueRow from './TechniqueRow.svelte';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  type Props = { label: string; items: Technique[]; onClick: (t: Technique) => void };
  let { label, items, onClick }: Props = $props();

  // Small groups (≤ 10 items) open by default; big groups are collapsed.
  const defaultOpen = $derived(items.length <= 10);
</script>

{#if items.length > 0}
  <details class="group mb-2 border-b border-border/30 pb-2" open={defaultOpen}>
    <summary class="flex cursor-pointer select-none items-center justify-between px-2 py-1 font-serif text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground">
      <span>{label} <span class="opacity-60">({items.length})</span></span>
      <ChevronRight size={12} class="transition-transform group-open:rotate-90" />
    </summary>
    <div class="mt-0.5 cryptex-scroll max-h-64 overflow-y-auto">
      {#each items as t (t.id)}
        <TechniqueRow technique={t} {onClick} />
      {/each}
    </div>
  </details>
{/if}
