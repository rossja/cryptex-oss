<script lang="ts">
  import { catalog, initCatalogStore } from '$lib/ai/catalog.svelte';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { onOpenModelPicker } from '$lib/stores/shortcuts.svelte';
  import type { Model } from '$lib/ai/types';
  import ModelRow from './ModelRow.svelte';
  import Search from 'lucide-svelte/icons/search';

  type Props = {
    value: string;
    onChange: (qualifiedId: string) => void;
    recentsKey: string;      // e.g. 'cryptex.pc.recentModels'
    defaultOpen?: boolean;
  };
  let { value, onChange, recentsKey, defaultOpen = false }: Props = $props();

  initCatalogStore();

  $effect(() => {
    return onOpenModelPicker(() => { open = true; });
  });

  let open = $state(defaultOpen);
  let query = $state('');
  let filters = $state<Set<'reasoning' | 'vision' | 'tools' | 'jsonSchema' | 'pdf' | 'free'>>(new Set());

  const recents = createPersistedState<string[]>(recentsKey, []);

  function toggleFilter(f: typeof filters extends Set<infer T> ? T : never) {
    const next = new Set(filters);
    if (next.has(f)) next.delete(f); else next.add(f);
    filters = next;
  }

  function matches(m: Model): boolean {
    const q = query.toLowerCase();
    if (q && !`${m.id} ${m.name} ${m.upstreamProvider ?? ''}`.toLowerCase().includes(q)) return false;
    for (const f of filters) {
      if (f === 'free') { if (!m.isFree) return false; }
      else if (!m.capabilities?.[f]) return false;
    }
    return true;
  }

  const filtered = $derived(catalog.list.filter(matches));
  const grouped = $derived.by(() => {
    const out: Record<string, Model[]> = {};
    for (const m of filtered) (out[m.upstreamProvider ?? 'Other'] ||= []).push(m);
    return out;
  });

  const recentModels = $derived(
    recents.value.map((id) => catalog.find(id)).filter((m): m is Model => Boolean(m)).slice(0, 5)
  );

  function choose(m: Model) {
    onChange(m.qualifiedId);
    const next = [m.qualifiedId, ...recents.value.filter((x) => x !== m.qualifiedId)].slice(0, 5);
    recents.value = next;
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
    if (e.key === 'Enter' && filtered.length === 0 && query.trim()) {
      // free-text fallback
      choose({
        id: query.trim(),
        qualifiedId: query.trim().includes(':') ? query.trim() : `openrouter:${query.trim()}`,
        name: query.trim(),
        provider: 'openrouter',
        upstreamProvider: 'Custom'
      });
    }
  }

  const selectedLabel = $derived(catalog.find(value)?.name ?? value ?? 'Select model');
</script>

<button type="button" onclick={() => open = !open}
  class="rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm hover:bg-black/40 hover:border-white/20 transition-colors">
  {selectedLabel}
</button>

{#if open}
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Select model"
    tabindex="-1"
    class="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4"
    onclick={() => open = false}
    onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="glass flex w-full max-w-2xl flex-col rounded-xl border border-white/10 shadow-glass" onclick={(e) => e.stopPropagation()}>
      <!-- Search bar -->
      <div class="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Search class="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          bind:value={query}
          onkeydown={onKeydown}
          placeholder="Search models…"
          class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autofocus
        />
        <kbd class="rounded border border-white/15 bg-black/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">⌘M</kbd>
      </div>

      <!-- Filter chips -->
      <div class="flex flex-wrap gap-1.5 border-b border-white/10 px-4 py-2.5">
        {#each [['reasoning', '🧠 Reasoning'], ['vision', '👁 Vision'], ['tools', '🛠 Tools'], ['jsonSchema', '{ } JSON'], ['pdf', '📄 PDF'], ['free', '🆓 Free']] as const as [k, label]}
          <button
            type="button"
            onclick={() => toggleFilter(k as never)}
            aria-pressed={filters.has(k as never)}
            class="rounded-full border px-2.5 py-1 text-xs transition-colors {filters.has(k as never)
              ? 'bg-primary/20 border-primary/40 text-primary'
              : 'border-white/10 text-muted-foreground hover:bg-white/5'}"
          >
            {label}
          </button>
        {/each}
      </div>

      <!-- Model list -->
      <div class="max-h-[60vh] flex-1 overflow-y-auto">
        {#if recentModels.length > 0 && !query && filters.size === 0}
          <div class="px-2 pt-3 pb-1">
            <div class="mb-1 border-b border-white/5 pb-1 px-2">
              <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Recent</span>
            </div>
            {#each recentModels as m (m.qualifiedId)}
              <ModelRow model={m} active={m.qualifiedId === value} onSelect={choose} />
            {/each}
          </div>
        {/if}

        {#each Object.entries(grouped) as [upstream, list]}
          <div class="px-2 pt-3 pb-1">
            <div class="mb-1 px-2">
              <span class="font-serif text-xs font-semibold tracking-wide text-muted-foreground">{upstream} <span class="font-sans font-normal opacity-60">({list.length})</span></span>
            </div>
            {#each list as m (m.qualifiedId)}
              <ModelRow model={m} active={m.qualifiedId === value} onSelect={choose} />
            {/each}
          </div>
        {/each}

        {#if filtered.length === 0}
          <div class="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            {#if query.trim()}
              <p>No models match <span class="font-mono text-xs text-foreground/80">"{query.trim()}"</span>.</p>
              <p class="text-xs">Press <kbd class="rounded border border-white/15 bg-black/30 px-1.5 py-0.5 text-[10px]">Enter</kbd> to use <span class="font-mono text-xs text-foreground/80">"{query.trim()}"</span> as a custom model id.</p>
            {:else}
              No models match the filters.
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
