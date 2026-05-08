<script lang="ts">
  import { Popover as PopoverPrimitive } from 'bits-ui';
  import { liveQuery } from 'dexie';
  import { db } from '$lib/chat/db';
  import { friendlyModelName } from '$lib/ai/model-label';
  import type { ChatRow, MessageRow } from '$lib/chat/types';
  import { onMount } from 'svelte';

  type Props = { chat: ChatRow };
  let { chat }: Props = $props();

  // Reactive message list — refetches via Dexie liveQuery whenever
  // any message in this chat is added / updated / tombstoned. The
  // chip's totals recompute automatically on every gateway response
  // because dispatch.ts persists `tokenUsage` on the assistant
  // message inside saveMessage.
  let messages = $state<MessageRow[]>([]);

  onMount(() => {
    const sub = liveQuery(() =>
      db.messages
        .where('[chatId+createdAt]')
        .between([chat.id, -Infinity], [chat.id, Infinity])
        .toArray()
    ).subscribe((rows) => {
      messages = rows.filter((m) => !m.tombstoned);
    });
    return () => sub.unsubscribe();
  });

  // Aggregate tokenUsage across all assistant messages.
  type ModelTotals = {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    reasoningTokens: number;
    calls: number;
    unreportedCalls: number;
  };

  function emptyTotals(): ModelTotals {
    return {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      calls: 0,
      unreportedCalls: 0
    };
  }

  const aggregate = $derived.by(() => {
    const byModel = new Map<string, ModelTotals>();
    const total = emptyTotals();
    for (const m of messages) {
      if (m.role !== 'assistant') continue;
      total.calls += 1;
      const u = m.tokenUsage;
      const reported = u && (u.inputTokens !== undefined || u.outputTokens !== undefined);
      if (!reported) total.unreportedCalls += 1;
      const inT = u?.inputTokens ?? 0;
      const outT = u?.outputTokens ?? 0;
      const cachedT = u?.cachedInputTokens ?? 0;
      const reasonT = u?.reasoningTokens ?? 0;
      total.inputTokens += inT;
      total.outputTokens += outT;
      total.cachedInputTokens += cachedT;
      total.reasoningTokens += reasonT;

      const modelId = m.modelReturned ?? m.modelRequested ?? 'unknown';
      const prev = byModel.get(modelId) ?? emptyTotals();
      prev.inputTokens += inT;
      prev.outputTokens += outT;
      prev.cachedInputTokens += cachedT;
      prev.reasoningTokens += reasonT;
      prev.calls += 1;
      if (!reported) prev.unreportedCalls += 1;
      byModel.set(modelId, prev);
    }
    return { total, byModel };
  });

  const isEmpty = $derived(
    aggregate.total.calls === 0 ||
      (aggregate.total.inputTokens === 0 &&
        aggregate.total.outputTokens === 0 &&
        aggregate.total.unreportedCalls === aggregate.total.calls)
  );

  /** Compact token formatter: 12,345 → "12.3K", 1.2M → "1.2M". */
  function formatTokens(n: number): string {
    if (n < 1000) return n.toString();
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  const headline = $derived.by(() => {
    const t = aggregate.total.inputTokens + aggregate.total.outputTokens;
    return `${formatTokens(t)} tok`;
  });
</script>

{#if !isEmpty}
  <PopoverPrimitive.Root>
    <PopoverPrimitive.Trigger
      aria-label={`Chat usage: ${headline}`}
      class="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/50 bg-card/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>{headline}</span>
    </PopoverPrimitive.Trigger>

    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={6}
        align="end"
        class="z-50 w-80 rounded-md border border-border/60 bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div class="mb-2 flex items-center justify-between text-[11px]">
          <span class="font-semibold text-foreground">Chat usage</span>
          <span class="font-mono text-[10px] text-muted-foreground">
            {aggregate.total.calls} message{aggregate.total.calls === 1 ? '' : 's'}
          </span>
        </div>

        <table class="w-full table-fixed border-collapse text-[10px]">
          <thead>
            <tr class="text-left text-muted-foreground">
              <th class="pb-1 font-medium">In</th>
              <th class="pb-1 text-right font-medium">Out</th>
              <th class="pb-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody class="font-mono">
            <tr class="border-t border-border/30 font-semibold">
              <td class="py-0.5 text-foreground">{formatTokens(aggregate.total.inputTokens)}</td>
              <td class="py-0.5 text-right text-foreground">{formatTokens(aggregate.total.outputTokens)}</td>
              <td class="py-0.5 text-right text-foreground">
                {formatTokens(aggregate.total.inputTokens + aggregate.total.outputTokens)}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Cached + reasoning sub-row -->
        {#if aggregate.total.cachedInputTokens > 0 || aggregate.total.reasoningTokens > 0}
          <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {#if aggregate.total.cachedInputTokens > 0}
              <span class="font-mono">Cached in: <span class="text-foreground">{formatTokens(aggregate.total.cachedInputTokens)}</span></span>
            {/if}
            {#if aggregate.total.reasoningTokens > 0}
              <span class="font-mono">Reasoning: <span class="text-foreground">{formatTokens(aggregate.total.reasoningTokens)}</span></span>
            {/if}
          </div>
        {/if}

        {#if aggregate.total.unreportedCalls > 0}
          <p class="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[9px] italic leading-relaxed text-amber-300">
            <span class="font-mono">{aggregate.total.unreportedCalls}</span> message{aggregate.total.unreportedCalls === 1 ? '' : 's'}
            had no token usage reported by the upstream — actual count is higher than shown.
          </p>
        {/if}

        {#if aggregate.byModel.size > 0}
          <div class="mt-2 border-t border-border/30 pt-2">
            <p class="mb-1 text-[10px] font-medium text-muted-foreground">By model</p>
            <ul class="space-y-0.5">
              {#each [...aggregate.byModel.entries()] as [modelId, totals] (modelId)}
                <li class="flex items-center justify-between gap-2 text-[10px]">
                  <code class="truncate font-mono text-muted-foreground" title={modelId}>{friendlyModelName(modelId)}</code>
                  <span class="shrink-0 font-mono text-muted-foreground">
                    {formatTokens(totals.inputTokens + totals.outputTokens)} tok · {totals.calls} msg{totals.calls === 1 ? '' : 's'}
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
