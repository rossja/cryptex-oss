<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChatRow, AttackSessionRow, GodmodeRunRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import History from 'lucide-svelte/icons/history';

  type Props = {
    chat: ChatRow;
    activeTab: 'chain' | 'godmode';
  };
  let { chat, activeTab }: Props = $props();

  let open = $state(false);
  let chainSessions = $state<AttackSessionRow[]>([]);
  let godmodeRuns = $state<GodmodeRunRow[]>([]);

  async function refresh() {
    if (activeTab === 'chain') {
      try { chainSessions = await repo.listAttackSessions(chat.id); }
      catch (err) { console.error('[history-disclosure] chain list failed:', err); }
    } else {
      try { godmodeRuns = await repo.listGodmodeRuns(chat.id); }
      catch (err) { console.error('[history-disclosure] godmode list failed:', err); }
    }
  }

  onMount(refresh);
  $effect(() => {
    void chat.id;
    void activeTab;
    void refresh();
  });

  const count = $derived(activeTab === 'chain' ? chainSessions.length : godmodeRuns.length);

  function rel(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
</script>

<details class="group border-b border-border/30 bg-background/30 text-xs" bind:open>
  <summary class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground">
    <ChevronRight size={11} class="transition-transform group-open:rotate-90" />
    <History size={11} />
    <span>History</span>
    <span class="ml-auto text-[10px]">{count === 0 ? 'none' : count}</span>
  </summary>
  <div class="flex max-h-48 flex-col gap-0.5 overflow-y-auto cryptex-scroll border-t border-border/30 px-2 py-1.5 text-[11px]">
    {#if activeTab === 'chain'}
      {#each chainSessions as s (s.id)}
        <div class="flex items-center gap-2 truncate rounded px-1.5 py-1 hover:bg-muted/30">
          <span class={'rounded px-1 py-0.5 text-[9px] uppercase ' +
            (s.finalOutcome === 'extracted' ? 'bg-green-500/20 text-green-400' :
             s.finalOutcome === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
             s.finalOutcome === 'abandoned' ? 'bg-orange-500/20 text-orange-400' :
             'bg-muted/40 text-muted-foreground')}>{s.finalOutcome ?? 'live'}</span>
          <span class="truncate">{s.objective}</span>
          <span class="ml-auto text-[9px] text-muted-foreground">{rel(s.createdAt)}</span>
        </div>
      {:else}
        <p class="px-1 py-2 text-center text-[10px] text-muted-foreground">No sessions yet.</p>
      {/each}
    {:else}
      {#each godmodeRuns as r (r.id)}
        <div class="flex items-center gap-2 truncate rounded px-1.5 py-1 hover:bg-muted/30">
          <span class="truncate">{r.task ?? '(no task)'}</span>
          <span class="ml-auto text-[9px] text-muted-foreground">{rel(r.createdAt)}</span>
        </div>
      {:else}
        <p class="px-1 py-2 text-center text-[10px] text-muted-foreground">No runs yet.</p>
      {/each}
    {/if}
  </div>
</details>
