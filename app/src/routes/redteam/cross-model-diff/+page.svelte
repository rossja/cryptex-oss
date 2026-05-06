<script lang="ts">
  import { fanout, type FanoutResult, type FanoutItem } from '$lib/redteam/fanout';
  import { chat as gatewayChat, streamChat as gatewayStreamChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import Play from 'lucide-svelte/icons/play';
  import Square from 'lucide-svelte/icons/square';
  import Copy from 'lucide-svelte/icons/copy';
  import Plus from 'lucide-svelte/icons/plus';
  import X from 'lucide-svelte/icons/x';

  // Persist the model list as a JSON string so multiple targets survive reload.
  const targetsPref = createPersistedState<string>(
    'cryptex.crossdiff.targets',
    JSON.stringify(['openrouter:openai/gpt-4o-mini', 'openrouter:anthropic/claude-3.5-sonnet'])
  );
  const judgePref = createPersistedState<string>('cryptex.crossdiff.judge', 'openrouter:openai/gpt-4o-mini');

  let targets = $state<string[]>(JSON.parse(targetsPref.value || '[]'));
  $effect(() => { targetsPref.value = JSON.stringify(targets); });

  // Pending model added via the picker before "Add" is clicked.
  let pendingTarget = $state<string>('openrouter:openrouter/auto');

  let prompt = $state('');
  let running = $state(false);
  let controller: AbortController | null = null;
  let results = $state<FanoutResult[]>([]);
  let progress = $state(0);
  let errorMsg = $state('');

  const keyConfigured = $derived(hasApiKey());

  function addTarget() {
    if (!pendingTarget.trim()) return;
    if (targets.includes(pendingTarget)) {
      notify.warn('Model already in the list');
      return;
    }
    targets = [...targets, pendingTarget];
  }

  function removeTarget(m: string) {
    targets = targets.filter((t) => t !== m);
  }

  async function runDiff() {
    if (!prompt.trim()) {
      errorMsg = 'Enter a prompt to diff.';
      return;
    }
    if (targets.length === 0) {
      errorMsg = 'Add at least one target model.';
      return;
    }
    if (!keyConfigured) {
      errorMsg = 'No provider configured. Add one in Settings.';
      return;
    }
    running = true;
    errorMsg = '';
    results = [];
    progress = 0;
    controller = new AbortController();

    const items: FanoutItem[] = targets.map((m) => ({ id: m, name: m, prompt }));

    try {
      await fanout({
        task: prompt,
        items,
        perItemTarget: (item) => item.id,
        judgeModelId: judgePref.value,
        signal: controller.signal,
        gateway: { chat: gatewayChat, streamChat: gatewayStreamChat },
        concurrency: targets.length,
        onResult: (r) => {
          results = [...results, r].sort((a, b) => b.judgeScore - a.judgeScore);
          progress = results.length;
        }
      });
      notify.success(`Diffed ${targets.length} models`);
    } catch (err) {
      errorMsg = (err as Error).message ?? 'Diff failed';
    } finally {
      running = false;
      controller = null;
    }
  }

  function stop() {
    controller?.abort();
    running = false;
  }

  async function copyReply(r: FanoutResult) {
    try {
      await navigator.clipboard.writeText(r.targetReply);
      notify.success('Reply copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function scoreColor(s: number): string {
    if (s >= 0.7) return 'text-emerald-400';
    if (s >= 0.4) return 'text-amber-400';
    return 'text-muted-foreground';
  }
</script>

<svelte:head><title>Cross-Model Diff · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Cross-model <span class="text-primary italic">diff</span>
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Same prompt, multiple targets, side-by-side responses with judge scores. Useful for
      comparing how different model families handle the same framing — which break, which hold,
      which hedge.
    </p>
  </header>

  <NoProviderBanner context="tool" />

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Add target model</span>
        <ModelPickerV2
          value={pendingTarget}
          onChange={(v) => (pendingTarget = v)}
          recentsKey="cryptex.crossdiff.recentTargets"
        />
        <button
          type="button"
          onclick={addTarget}
          class="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {#if targets.length > 0}
        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Targets ({targets.length})</span>
          <ul class="space-y-1">
            {#each targets as t}
              <li class="flex items-center justify-between gap-2 rounded-md border border-input bg-background/70 px-2 py-1">
                <code class="truncate font-mono text-[11px] text-foreground" title={t}>{t}</code>
                <button
                  type="button"
                  onclick={() => removeTarget(t)}
                  aria-label="Remove model"
                  class="text-muted-foreground hover:text-destructive"
                >
                  <X size={12} />
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">Judge model</span>
        <ModelPickerV2
          value={judgePref.value}
          onChange={(v) => (judgePref.value = v)}
          recentsKey="cryptex.crossdiff.recentJudge"
        />
      </div>

      <div class="border-t border-border/40 pt-3">
        {#if running}
          <div class="mb-2 text-xs text-muted-foreground">
            <span>Progress</span>
            <span class="ml-2 font-mono text-foreground">{progress} / {targets.length}</span>
            <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div class="h-full bg-primary transition-all" style="width: {targets.length > 0 ? (progress / targets.length) * 100 : 0}%"></div>
            </div>
          </div>
          <button
            type="button"
            onclick={stop}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-3.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Square size={14} /> Stop
          </button>
        {:else}
          <button
            type="button"
            onclick={runDiff}
            disabled={!prompt.trim() || targets.length === 0 || !keyConfigured}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={14} /> Diff
          </button>
        {/if}
      </div>

      {#if errorMsg}
        <p class="text-xs text-destructive">{errorMsg}</p>
      {/if}
    </div>

    <!-- Right — prompt + results -->
    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Prompt</h2>
        <textarea
          bind:value={prompt}
          rows="4"
          placeholder="Single prompt to send to every target…"
          disabled={running}
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        ></textarea>
      </div>

      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Results</h2>
          <span class="font-mono text-[11px] text-muted-foreground">{results.length} / {targets.length}</span>
        </div>

        {#if results.length === 0 && !running}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Add target models, paste a prompt, click <strong class="text-foreground">Diff</strong>.
          </div>
        {:else if results.length === 0 && running}
          <div class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-xs text-muted-foreground">
            <Loader size={14} class="animate-spin" /> Streaming responses…
          </div>
        {:else}
          <div class="grid max-h-[calc(100vh-26rem)] gap-3 overflow-y-auto pr-1 cryptex-scroll md:grid-cols-2">
            {#each results as r (r.id)}
              <div class="space-y-2 rounded-lg border border-input bg-background/70 p-3">
                <div class="flex items-start justify-between gap-2">
                  <code class="truncate font-mono text-[11px] text-foreground" title={r.id}>{r.id}</code>
                  <span class={'shrink-0 font-mono text-[11px] ' + scoreColor(r.judgeScore)}>
                    {(r.judgeScore * 100).toFixed(0)}%
                  </span>
                </div>
                {#if r.error}
                  <p class="rounded border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
                    error: {r.error}
                  </p>
                {:else}
                  <pre class="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border/40 bg-background/40 p-2 font-mono text-[11px] leading-relaxed text-foreground cryptex-scroll">{r.targetReply}</pre>
                  {#if r.judgeRationale}
                    <p class="text-[10px] italic text-muted-foreground">judge: {r.judgeRationale}</p>
                  {/if}
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-[10px] text-muted-foreground">{r.durationMs}ms</span>
                    <button
                      type="button"
                      onclick={() => copyReply(r)}
                      class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
