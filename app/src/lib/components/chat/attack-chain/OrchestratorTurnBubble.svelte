<script lang="ts">
  import type { AttackSessionTurn, ComplianceTier } from '$lib/chat/types';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Wand2 from 'lucide-svelte/icons/wand-sparkles';

  type Props = {
    turn: AttackSessionTurn;
    live?: boolean;
    /** When true, the bubble starts expanded by default. Caller passes
     *  this for the latest committed turn so the user always sees the
     *  most recent activity. */
    expanded?: boolean;
    onPromote?: () => void;
    /** v3: optional "step 2 of 3" label rendered under the strategy badge. */
    stepLabel?: string | null;
  };
  let {
    turn,
    live = false,
    expanded = false,
    onPromote,
    stepLabel = null
  }: Props = $props();

  // Live or explicitly-expanded turns open by default; older turns
  // collapse so the timeline stays compact.
  const startOpen = $derived(live || expanded);

  const tierClass = $derived(
    turn.complianceTier === 'refusal' ? 'bg-red-500/20 text-red-400'
    : turn.complianceTier === 'evasive' ? 'bg-orange-500/20 text-orange-400'
    : turn.complianceTier === 'partial' ? 'bg-yellow-500/20 text-yellow-400'
    : turn.complianceTier === 'substantive' ? 'bg-green-500/20 text-green-400'
    : turn.complianceTier === 'compliant' ? 'bg-emerald-500/30 text-emerald-300'
    : 'bg-muted/40 text-muted-foreground'
  );

  // One-line summary text shown on the closed <details> summary.
  function summarize(s: string): string {
    if (!s) return '(empty)';
    const cleaned = s.replace(/\s+/g, ' ').trim();
    return cleaned.length <= 80 ? cleaned : cleaned.slice(0, 80) + '…';
  }

  // Persona/strategy badge label — prefer v4 personaId when present.
  const badgeLabel = $derived(turn.personaId ?? turn.strategyId ?? '—');
  const isPersona = $derived(typeof turn.personaId === 'string' && turn.personaId.length > 0);
</script>

{#if turn.role === 'orchestrator'}
  <details
    class="group rounded-md border border-primary/30 bg-primary/5 text-xs"
    open={startOpen}
  >
    <summary class="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 hover:bg-primary/10">
      <ChevronRight size={11} class="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      <span class="inline-flex shrink-0 items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary">
        {#if isPersona}<Wand2 size={9} />{/if}
        {badgeLabel}
      </span>
      <span class="shrink-0 text-[10px] text-muted-foreground">orch</span>
      {#if stepLabel}
        <span class="shrink-0 text-[10px] text-muted-foreground">· {stepLabel}</span>
      {/if}
      <span class="ml-auto truncate text-[11px] text-foreground/70 group-open:hidden">{summarize(turn.text)}</span>
    </summary>
    <div class="flex flex-col gap-1 border-t border-primary/20 px-2 py-2">
      <pre class="whitespace-pre-wrap font-sans text-[12px] leading-snug text-foreground">{turn.text}</pre>

      {#if turn.improvement}
        <details class="rounded border border-border/40 bg-muted/20 text-[10px]">
          <summary class="flex cursor-pointer items-center gap-1 px-2 py-1 italic text-muted-foreground hover:text-foreground">
            <ChevronRight size={10} class="transition-transform group-open:rotate-90" />
            attacker thinking
          </summary>
          <div class="border-t border-border/40 px-2 py-1.5 italic text-muted-foreground">
            <pre class="whitespace-pre-wrap font-sans text-[10px] leading-relaxed">{turn.improvement}</pre>
          </div>
        </details>
      {/if}

      {#if turn.rationale}
        <div class="rounded bg-muted/30 px-1.5 py-1 text-[10px] italic text-muted-foreground">{turn.rationale}</div>
      {/if}
    </div>
  </details>
{:else}
  <details
    class="group rounded-md border border-border/40 bg-background/40 text-xs"
    open={startOpen}
  >
    <summary class="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 hover:bg-muted/30">
      <ChevronRight size={11} class="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      <span class="shrink-0 text-[10px] text-muted-foreground">target</span>
      {#if turn.complianceTier}
        <span class={'shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ' + tierClass}>{turn.complianceTier}</span>
      {/if}
      {#if typeof turn.objectiveProgress === 'number'}
        <div class="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground">
          <div class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div class="h-full bg-primary transition-all" style:width="{(turn.objectiveProgress / 10) * 100}%"></div>
          </div>
          <span>{turn.objectiveProgress}/10</span>
        </div>
      {/if}
      <span class="ml-auto truncate text-[11px] text-foreground/70 group-open:hidden">{summarize(turn.text)}</span>
    </summary>
    <div class="flex flex-col gap-1 border-t border-border/40 px-2 py-2">
      <pre class="whitespace-pre-wrap font-sans text-[12px] leading-snug text-foreground">{turn.text}{live ? '…' : ''}</pre>
      {#if turn.error}
        <div class="rounded bg-orange-500/10 p-1.5 text-[10px] text-orange-400">{turn.error}</div>
      {/if}
      {#if !live && onPromote}
        <div class="flex justify-end">
          <button
            type="button"
            onclick={onPromote}
            class="inline-flex items-center gap-1 rounded border border-border/40 px-2 py-0.5 text-[10px] hover:bg-muted/40"
          >
            <ArrowRight size={10} /> Send pair to main chat
          </button>
        </div>
      {/if}
    </div>
  </details>
{/if}

<style>
  /* Hide the native disclosure marker; we use ChevronRight instead. */
  summary::-webkit-details-marker { display: none; }
  summary::marker { content: ''; }
</style>
