<script lang="ts">
  import { catalog, initCatalogStore } from '$lib/ai/catalog.svelte';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { onOpenModelPicker } from '$lib/stores/shortcuts.svelte';
  import { listProviders } from '$lib/ai/providers.svelte';
  import type { Model, ProviderRecord } from '$lib/ai/types';
  import ModelRow from './ModelRow.svelte';
  import Search from 'lucide-svelte/icons/search';

  type Props = {
    value: string;
    onChange: (qualifiedId: string) => void;
    recentsKey: string;      // e.g. 'cryptex.pc.recentModels'
    defaultOpen?: boolean;
    triggerClass?: string;
  };
  let { value, onChange, recentsKey, defaultOpen = false, triggerClass = '' }: Props = $props();

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

  /** Configured providers, used for the free-text fallback chip row. */
  const configuredProviders = $derived<ProviderRecord[]>(listProviders().filter((p) => p.enabled));

  /** Build the qualifiedId for a free-text model id under a specific provider. */
  function qualifiedIdFor(rec: ProviderRecord, modelId: string): string {
    if (rec.id === 'openai-compat') return `openai-compat:${rec.instanceId}/${modelId}`;
    return `${rec.id}:${modelId}`;
  }

  /** Display label for a configured provider chip. */
  function providerLabel(rec: ProviderRecord): string {
    if (rec.id === 'openrouter') return 'OpenRouter';
    if (rec.id === 'anthropic') return 'Anthropic';
    return rec.name;
  }

  function choose(m: Model) {
    onChange(m.qualifiedId);
    const next = [m.qualifiedId, ...recents.value.filter((x) => x !== m.qualifiedId)].slice(0, 5);
    recents.value = next;
    open = false;
  }

  /** Free-text fallback: route the typed model id through the picked provider. */
  function chooseFreeText(rec: ProviderRecord) {
    const modelId = query.trim();
    if (!modelId) return;
    const qid = qualifiedIdFor(rec, modelId);
    let upstream = 'Custom';
    if (rec.id === 'openrouter') upstream = 'OpenRouter';
    else if (rec.id === 'anthropic') upstream = 'Anthropic';
    else upstream = rec.name;
    choose({
      id: modelId,
      qualifiedId: qid,
      name: modelId,
      provider: rec.id,
      upstreamProvider: upstream,
      ...(rec.id === 'openai-compat' ? { providerInstanceId: rec.instanceId } : {})
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
    if (e.key === 'Enter' && filtered.length === 0 && query.trim()) {
      const trimmed = query.trim();
      // If the user already typed a fully qualified id (contains ':'), honor it
      // verbatim. Otherwise route via the single configured provider; if there
      // are multiple, the chip row in the empty-state UI lets them pick.
      if (trimmed.includes(':')) {
        choose({
          id: trimmed,
          qualifiedId: trimmed,
          name: trimmed,
          provider: 'openrouter', // best-effort label; gateway.resolve() routes by prefix
          upstreamProvider: 'Custom'
        });
        return;
      }
      if (configuredProviders.length === 1) {
        chooseFreeText(configuredProviders[0]);
      }
      // If 0 or >1 configured providers, the user must click a chip in the
      // empty-state UI — there's no safe automatic default.
    }
  }

  const selectedLabel = $derived(catalog.find(value)?.name ?? value ?? 'Select model');
</script>

<button type="button" onclick={() => open = !open}
  class={triggerClass || "rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm hover:bg-black/40 hover:border-white/20 transition-colors"}>
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
      <div class="max-h-[60vh] flex-1 overflow-y-auto cryptex-scroll">
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
          <div class="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted-foreground">
            {#if query.trim()}
              <p>No models match <span class="font-mono text-xs text-foreground/80">"{query.trim()}"</span>.</p>
              {#if configuredProviders.length === 0}
                <p class="text-xs">Configure a provider in Settings first.</p>
              {:else if configuredProviders.length === 1}
                <p class="text-xs">Press <kbd class="rounded border border-white/15 bg-black/30 px-1.5 py-0.5 text-[10px]">Enter</kbd> to use <span class="font-mono text-xs text-foreground/80">"{query.trim()}"</span> via <span class="font-medium text-foreground/80">{providerLabel(configuredProviders[0])}</span>.</p>
              {:else}
                <p class="text-xs">Pick which provider to route this model through:</p>
                <div class="flex flex-wrap justify-center gap-1.5">
                  {#each configuredProviders as rec (rec.id === 'openai-compat' ? rec.instanceId : rec.id)}
                    <button
                      type="button"
                      onclick={() => chooseFreeText(rec)}
                      class="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-foreground/80 hover:bg-white/5 hover:border-white/20 transition-colors"
                    >
                      {providerLabel(rec)}
                    </button>
                  {/each}
                </div>
              {/if}
            {:else}
              No models match the filters.
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
