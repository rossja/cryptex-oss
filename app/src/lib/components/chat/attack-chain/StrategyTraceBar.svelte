<script lang="ts">
  import type { StrategyLogEntry } from '$lib/chat/types';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';

  type Props = { log: StrategyLogEntry[] };
  let { log }: Props = $props();
</script>

{#if log.length > 0}
  <div class="flex items-center gap-1 overflow-x-auto cryptex-scroll rounded-md border border-border/40 bg-background/30 px-2 py-1 text-[10px]">
    {#each log as entry, i (i + entry.iteration)}
      {#if entry.action === 'pivot'}
        <RefreshCw size={10} class="shrink-0 text-orange-400" />
      {/if}
      <span
        title={entry.rationale}
        class="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-mono uppercase tracking-wide text-primary"
      >{entry.personaId ?? entry.strategyId ?? '—'}</span>
      {#if i < log.length - 1}
        <ArrowRight size={10} class="shrink-0 text-muted-foreground" />
      {/if}
    {/each}
  </div>
{/if}
