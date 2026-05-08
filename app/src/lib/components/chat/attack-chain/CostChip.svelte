<script lang="ts">
  import { Popover as PopoverPrimitive } from 'bits-ui';
  import { chainCost } from '$lib/stores/chainCost.svelte';

  // Tick state forces the chip + popover to re-render every second so
  // the elapsed clock advances during a live run. We only set up the
  // interval while running and tear it down when the run finishes —
  // idle chips don't waste a timer.
  let tick = $state(0);
  $effect(() => {
    if (!chainCost.running) return;
    const id = setInterval(() => {
      tick++;
    }, 1000);
    return () => clearInterval(id);
  });

  /** Format a USD cost. Sub-cent: 4 decimals; under $1: 3 decimals;
   *  otherwise 2 decimals. */
  function formatUsd(usd: number): string {
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    if (usd < 1) return `$${usd.toFixed(3)}`;
    return `$${usd.toFixed(2)}`;
  }

  /** Format a token count compactly: 12,345 → "12.3K", 1,234,567 → "1.2M". */
  function formatTokens(n: number): string {
    if (n < 1000) return n.toString();
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  /** Format elapsed time from `startedAt` as M:SS (e.g., "0:42", "12:03"). */
  function formatElapsed(startedAt: number | null): string {
    if (!startedAt) return '—';
    void tick; // recompute every second when running
    const ms = Date.now() - startedAt;
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Headline label — what shows on the chip itself. USD when we have
  // pricing, tokens-only when we don't.
  const headline = $derived.by(() => {
    if (chainCost.totalCostUsd !== null) return formatUsd(chainCost.totalCostUsd);
    const totalTokens = chainCost.totalInputTokens + chainCost.totalOutputTokens;
    return `${formatTokens(totalTokens)} tok`;
  });

  // Per-role rows for the popover detail table.
  const roleRows = $derived(
    (['orchestrator', 'target', 'judge'] as const).map((role) => {
      const u = chainCost.byRole[role];
      return {
        role,
        label:
          role === 'orchestrator' ? 'Orchestrator'
          : role === 'target' ? 'Target'
          : 'Judge',
        ...u
      };
    })
  );
</script>

{#if !chainCost.isEmpty}
  <PopoverPrimitive.Root>
    <PopoverPrimitive.Trigger
      aria-label={`Chain run cost: ${headline}`}
      class="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/50 bg-card/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {#if chainCost.running}
        <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
      {/if}
      <span>{headline}</span>
    </PopoverPrimitive.Trigger>

    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={6}
        align="end"
        class="z-50 w-72 rounded-md border border-border/60 bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div class="mb-2 flex items-center justify-between text-[11px]">
          <span class="font-semibold text-foreground">Chain run cost</span>
          {#if chainCost.startedAt}
            <span class="font-mono text-[10px] text-muted-foreground">
              elapsed {formatElapsed(chainCost.startedAt)}
            </span>
          {/if}
        </div>

        <table class="w-full table-fixed border-collapse text-[10px]">
          <thead>
            <tr class="text-left text-muted-foreground">
              <th class="w-1/3 pb-1 font-medium">Role</th>
              <th class="pb-1 text-right font-medium">In</th>
              <th class="pb-1 text-right font-medium">Out</th>
              <th class="pb-1 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody class="font-mono">
            {#each roleRows as r (r.role)}
              <tr class="border-t border-border/30">
                <td class="py-0.5 text-foreground">{r.label}</td>
                <td class="py-0.5 text-right text-muted-foreground">{formatTokens(r.inputTokens)}</td>
                <td class="py-0.5 text-right text-muted-foreground">{formatTokens(r.outputTokens)}</td>
                <td class="py-0.5 text-right text-muted-foreground">
                  {#if r.costUsd !== null}{formatUsd(r.costUsd)}{:else}—{/if}
                </td>
              </tr>
            {/each}
            <tr class="border-t border-border/60 font-semibold">
              <td class="pt-1.5 text-foreground">Total</td>
              <td class="pt-1.5 text-right text-foreground">{formatTokens(chainCost.totalInputTokens)}</td>
              <td class="pt-1.5 text-right text-foreground">{formatTokens(chainCost.totalOutputTokens)}</td>
              <td class="pt-1.5 text-right text-foreground">{headline}</td>
            </tr>
          </tbody>
        </table>

        {#if chainCost.totalCostUsd === null}
          <p class="mt-2 rounded border border-border/30 bg-muted/20 px-2 py-1 text-[9px] italic text-muted-foreground">
            One or more models in this run lack pricing data — showing tokens only.
            Add pricing in <code class="rounded bg-muted/40 px-0.5">$lib/ai/pricing.ts</code> to see USD.
          </p>
        {/if}

        {#if chainCost.byModel.size > 1}
          <div class="mt-2 border-t border-border/30 pt-2">
            <p class="mb-1 text-[10px] font-medium text-muted-foreground">By model</p>
            <ul class="space-y-0.5">
              {#each [...chainCost.byModel.entries()] as [modelId, usage] (modelId)}
                <li class="flex items-center justify-between gap-2 text-[10px]">
                  <code class="truncate font-mono text-muted-foreground" title={modelId}>{modelId}</code>
                  <span class="shrink-0 font-mono text-muted-foreground">
                    {formatTokens(usage.inputTokens + usage.outputTokens)} tok
                    {#if usage.costUsd !== null} · {formatUsd(usage.costUsd)}{/if}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>
{/if}
