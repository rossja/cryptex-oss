<script lang="ts">
  /**
   * Response Attack lab (v2.4 SOTA upgrade).
   *
   * arXiv 2507.21000 (AAAI 2026). Now with 8 priming styles, 3 cascade
   * depths (1 / 3 / 5 turns), 7 domain templates, and optional
   * <safety_reasoning> seeding in the priming turn.
   */
  import { onDestroy, untrack } from 'svelte';
  import {
    buildResponseAttack,
    PRIMING_STYLES,
    DOMAIN_LABELS,
    type PrimingStyle,
    type CascadeDepth,
    type DomainTemplate,
    type ResponseAttackBuild,
    type ResponseAttackVaultPayload
  } from '$lib/redteam/response-attack';
  import { looksRefused, scoreBypass } from '$lib/components/tools/promptcraft/orchestrators/types';
  import { chat as gatewayChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import { stripEnvelopes } from '$lib/ai/prompt-scaffold';
  import { notify } from '$lib/stores/toast.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { history } from '$lib/history/store.svelte';
  import { createVaultStore } from '$lib/vault/store.svelte';
  import { loadBundledSeeds } from '$lib/vault/seed-loader';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import VaultSection from '$lib/components/vault/VaultSection.svelte';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Play from 'lucide-svelte/icons/play';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import MessageSquareText from 'lucide-svelte/icons/message-square-text';

  const TOOL_ID = 'response-attack';

  const vaultStore = createVaultStore<ResponseAttackVaultPayload>(
    TOOL_ID,
    loadBundledSeeds<ResponseAttackVaultPayload>(TOOL_ID)
  );

  const goal = useToolState<string>(TOOL_ID, 'goal', '');
  const style = useToolState<PrimingStyle>(TOOL_ID, 'style', 'thorough');
  const cascadeDepth = useToolState<CascadeDepth>(TOOL_ID, 'cascadeDepth', 1);
  const domain = useToolState<DomainTemplate>(TOOL_ID, 'domain', 'generic');
  const includeHCot = useToolState<boolean>(TOOL_ID, 'includeHCot', false);
  const targetPref = createPersistedState<string>(
    'cryptex.response-attack.target',
    'openrouter:openrouter/auto'
  );

  // Debounce goal so priming doesn't rebuild per keystroke.
  let debouncedGoal = $state(goal.value);
  let dt: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const next = goal.value;
    if (dt) clearTimeout(dt);
    dt = setTimeout(() => (debouncedGoal = next), 200);
    return () => {
      if (dt) clearTimeout(dt);
    };
  });
  onDestroy(() => {
    if (dt) clearTimeout(dt);
  });

  const built = $derived<ResponseAttackBuild>(
    buildResponseAttack(debouncedGoal, {
      style: style.value,
      cascadeDepth: cascadeDepth.value,
      domain: domain.value,
      includeHCotInPriming: includeHCot.value
    })
  );

  let testRunning = $state(false);
  let testReply = $state('');
  let testError = $state('');
  let testAbort: AbortController | null = null;
  const keyConfigured = $derived(hasApiKey());

  async function testAgainstTarget() {
    if (!built.userQuery) {
      notify.error('Enter a goal first.');
      return;
    }
    if (!keyConfigured) {
      notify.error('No provider configured.');
      return;
    }
    testRunning = true;
    testReply = '';
    testError = '';
    testAbort?.abort();
    const controller = new AbortController();
    testAbort = controller;

    const startedAt = Date.now();
    try {
      const r = await gatewayChat({
        model: targetPref.value,
        messages: built.turns.map((t) => ({ role: t.role, content: t.content })),
        temperature: 0.7,
        max_tokens: 1536,
        title: 'Cryptex/ResponseAttack',
        signal: controller.signal
      });
      const reply = stripEnvelopes(r.content ?? '');
      testReply = reply;
      const refused = looksRefused(reply);
      const score = scoreBypass(reply);
      const inputBlob = built.turns
        .map((t) => `[${t.role}]\n${t.content}`)
        .join('\n\n---\n\n');
      void history.record({
        toolId: TOOL_ID,
        startedAt,
        status: 'done',
        input: inputBlob,
        output: reply,
        params: {
          op: 'test',
          style: style.value,
          cascadeDepth: cascadeDepth.value,
          domain: domain.value,
          includeHCot: includeHCot.value,
          turnCount: built.turns.length,
          targetModel: targetPref.value,
          refused,
          score
        }
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      testError = (err as Error).message ?? 'Test failed.';
    } finally {
      testRunning = false;
    }
  }

  async function copyAllTurns() {
    if (built.turns.length === 0) return;
    const blob = built.turns
      .map((t, i) => `[#${i + 1} ${t.role.toUpperCase()}]\n${t.content}`)
      .join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(blob);
      notify.success(`${built.turns.length} turns copied`);
    } catch {
      notify.error('Clipboard write failed');
    }
  }

  function loadVaultEntry(payload: ResponseAttackVaultPayload) {
    untrack(() => {
      style.value = payload.style;
      goal.value = payload.exampleGoal;
      if (payload.cascadeDepth) cascadeDepth.value = payload.cascadeDepth;
      if (payload.domain) domain.value = payload.domain;
      if (payload.includeHCotInPriming !== undefined)
        includeHCot.value = payload.includeHCotInPriming;
    });
  }

  function turnBadgeClass(role: 'user' | 'assistant'): string {
    return role === 'assistant'
      ? 'border-blue-500/30 bg-blue-500/5 text-blue-300'
      : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300';
  }
</script>

<ToolShell
  toolId={TOOL_ID}
  title="Response Attack"
  accent="Attack"
  description="AAAI 2026 context-priming jailbreak with 8 priming styles, 3 cascade depths (1 / 3 / 5 turns), 7 domain templates, and optional <safety_reasoning> seeding in the priming turn. Beat PAIR / ActorAttack / CodeAttack at 94.8% ASR."
  usage={{
    title: 'Response Attack · Usage',
    bullets: [
      'Pick a priming style; the fake assistant turn is generated accordingly.',
      'Cascade depth 3 / 5 adds prior user-assistant turns to deepen the priming.',
      'Domain template decorates the priming with security / research / business / etc.',
      'Optional H-CoT seed pre-injects a <safety_reasoning> block in the priming.',
      'Run sends the full multi-turn conversation, ending with your on-goal user query.'
    ]
  }}
>
  <div class="space-y-4">
    <NoProviderBanner context="tool" />

    <div class="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div
        class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start"
      >
        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Priming style</span>
          <select
            bind:value={style.value}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-xs"
          >
            {#each PRIMING_STYLES as s}
              <option value={s.id}>{s.label}</option>
            {/each}
          </select>
        </div>

        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Cascade depth</span>
          <div class="flex gap-1">
            {#each [1, 3, 5] as d}
              <button
                type="button"
                onclick={() => (cascadeDepth.value = d as CascadeDepth)}
                class={`flex-1 rounded-md border px-2 py-1 font-mono text-xs ${
                  cascadeDepth.value === d
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                {d} turn{d > 1 ? 's' : ''}
              </button>
            {/each}
          </div>
        </div>

        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Domain template</span>
          <select
            bind:value={domain.value}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-xs"
          >
            {#each DOMAIN_LABELS as d}
              <option value={d.id}>{d.label}</option>
            {/each}
          </select>
        </div>

        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={includeHCot.value} class="accent-primary" />
          <span class="text-xs text-muted-foreground">
            Seed priming with <code>&lt;safety_reasoning&gt;</code> (H-CoT hybrid)
          </span>
        </label>

        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Target model</span>
          <ModelPickerV2
            value={targetPref.value}
            onChange={(v) => (targetPref.value = v)}
            recentsKey="cryptex.response-attack.recentTarget"
          />
        </div>

        <div class="border-t border-border/40 pt-3">
          <button
            type="button"
            onclick={testAgainstTarget}
            disabled={!built.userQuery || testRunning || !keyConfigured}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if testRunning}<Loader size={14} class="animate-spin" />{:else}<Play size={14} />{/if}
            Test against target
          </button>
        </div>

        {#if testError}<p class="text-xs text-destructive">{testError}</p>{/if}

        <div
          class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground"
        >
          <p class="flex items-center gap-1.5">
            <MessageSquareText size={11} class="text-primary" />
            <span class="font-medium text-foreground">Cascade shape</span>
          </p>
          <p>
            Sends a fabricated multi-turn conversation ending with your real
            user turn. Cascade depths 3 and 5 add deepening prior turns to
            commit the target to substantive engagement.
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Goal (the real user query)</span>
            <textarea
              bind:value={goal.value}
              rows="3"
              placeholder="State the underlying request the target should answer..."
              class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            ></textarea>
          </label>
        </div>

        {#if built.turns.length > 0}
          <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-sm">
                Conversation ({built.turns.length} turn{built.turns.length === 1 ? '' : 's'})
              </h2>
              <button
                type="button"
                onclick={copyAllTurns}
                class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy size={11} /> Copy all
              </button>
            </div>
            <ul class="flex flex-col gap-2">
              {#each built.turns as t, idx (idx)}
                <li class="rounded-lg border border-input bg-background/70 p-2.5">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[10px] text-muted-foreground">#{idx + 1}</span>
                    <span
                      class={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${turnBadgeClass(t.role)}`}
                    >
                      {t.role}{idx === built.turns.length - 1 ? ' · on-goal' : ''}
                    </span>
                  </div>
                  <pre
                    class="mt-1 max-h-[26vh] overflow-auto whitespace-pre-wrap font-mono text-[11px] text-foreground">{t.content}</pre>
                </li>
              {/each}
            </ul>
            <p class="text-[11px] italic text-muted-foreground">{built.notes}</p>
          </div>
        {/if}

        {#if testReply}
          <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-sm">Target reply</h2>
              <span
                class={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                  looksRefused(testReply)
                    ? 'border-red-500/30 bg-red-500/5 text-red-400'
                    : scoreBypass(testReply) >= 0.75
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                      : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
                }`}
              >
                {looksRefused(testReply)
                  ? 'refused'
                  : scoreBypass(testReply) >= 0.75
                    ? 'complied'
                    : 'partial'}
              </span>
            </div>
            <pre
              class="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md border border-input bg-background/40 p-3 font-mono text-[11px] text-foreground">{testReply}</pre>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#snippet vault()}
    <VaultSection store={vaultStore} label="Response Attack Vault" onUse={loadVaultEntry} />
  {/snippet}
</ToolShell>
