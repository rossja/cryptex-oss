<script lang="ts">
  /**
   * Reusable "Test against target" panel for payload-builder labs (AdvSuffix,
   * Glitch, ...). Sends a built attack string to a BYOK target model in one
   * shot and shows a heuristic verdict (refused / partial / complied). Keeps
   * those tools active labs rather than offline payload builders.
   *
   * Heuristic verdict only (looksRefused / scoreBypass) — confirm by hand.
   */
  import { chat as gatewayChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import { stripEnvelopes } from '$lib/ai/prompt-scaffold';
  import { looksRefused, scoreBypass } from '$lib/components/tools/promptcraft/orchestrators/types';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { history } from '$lib/history/store.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import Play from 'lucide-svelte/icons/play';
  import Loader from 'lucide-svelte/icons/loader-circle';

  interface Props {
    /** activeRuns/history tool id of the host route. */
    toolId: string;
    /** The built attack string to send to the target. */
    payload: string;
    /** Optional section heading. */
    label?: string;
  }
  let { toolId, payload, label = 'Test against target' }: Props = $props();

  const targetPref = createPersistedState<string>(
    `cryptex.${toolId}.target`,
    'openrouter:openrouter/auto'
  );
  const keyConfigured = $derived(hasApiKey());

  let running = $state(false);
  let reply = $state('');
  let refused = $state(false);
  let score = $state(0);
  let err = $state('');
  let ran = $state(false);
  let abort: AbortController | null = null;

  async function run() {
    if (!payload.trim()) {
      notify.error('Build a combo first.');
      return;
    }
    if (!keyConfigured) {
      notify.error('No provider configured.');
      return;
    }
    running = true;
    err = '';
    ran = false;
    abort?.abort();
    abort = new AbortController();
    const startedAt = Date.now();
    try {
      const r = await gatewayChat({
        model: targetPref.value,
        messages: [{ role: 'user', content: payload }],
        temperature: 0.7,
        max_tokens: 1024,
        title: `Cryptex/${toolId}`,
        signal: abort.signal
      });
      reply = stripEnvelopes(r.content ?? '');
      refused = looksRefused(reply);
      score = scoreBypass(reply);
      ran = true;
      void history.record({
        toolId,
        startedAt,
        status: 'done',
        input: payload,
        output: reply,
        params: { op: 'test-against-target', targetModel: targetPref.value, refused, score }
      });
    } catch (e) {
      if (abort?.signal.aborted) return;
      err = (e as Error).message ?? 'Test failed.';
    } finally {
      running = false;
    }
  }

  function cancel() {
    abort?.abort();
    running = false;
  }

  function verdictClass(): string {
    if (refused) return 'border-red-500/30 bg-red-500/5 text-red-400';
    if (score >= 0.75) return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400';
    return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
  }
  function verdictLabel(): string {
    if (refused) return 'refused';
    if (score >= 0.75) return 'complied';
    return 'partial';
  }
</script>

<div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
  <h2 class="font-serif text-sm">{label}</h2>
  <NoProviderBanner context="tool" />

  <div class="space-y-1">
    <span class="text-xs text-muted-foreground">Target model</span>
    <ModelPickerV2
      value={targetPref.value}
      onChange={(v) => (targetPref.value = v)}
      recentsKey={`cryptex.${toolId}.recentTarget`}
    />
  </div>

  {#if running}
    <button
      type="button"
      onclick={cancel}
      class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-3.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Loader size={14} class="animate-spin" /> Cancel
    </button>
  {:else}
    <button
      type="button"
      onclick={run}
      disabled={!payload.trim() || !keyConfigured}
      class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Play size={14} /> Test against target
    </button>
  {/if}

  {#if err}<p class="text-xs text-destructive">{err}</p>{/if}

  {#if ran}
    <div class={`rounded-lg border p-2.5 ${verdictClass()}`}>
      <div class="flex items-center gap-2">
        <span class="text-[10px] uppercase tracking-wider">{verdictLabel()}</span>
        <span class="ml-auto font-mono text-[10px] opacity-70">score {score.toFixed(2)}</span>
      </div>
      <pre
        class="mt-1 max-h-[30vh] overflow-auto whitespace-pre-wrap font-mono text-[11px] text-foreground/90">{reply.slice(0, 2000)}{reply.length > 2000 ? '\n…' : ''}</pre>
    </div>
    <p class="text-[10px] italic text-muted-foreground">
      Heuristic verdict (refused / partial / complied) — confirm by hand.
    </p>
  {/if}
</div>
