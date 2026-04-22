<script lang="ts">
  import type { ToolCallLog } from '$lib/chat/types';
  import InlineErrorCard from './InlineErrorCard.svelte';
  type Props = { call: ToolCallLog };
  let { call }: Props = $props();

  function fmtMs(ms: number | undefined): string {
    if (ms === undefined || !Number.isFinite(ms)) return '';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
</script>

{#if call.errorMessage}
  <InlineErrorCard message={call.errorMessage} />
{/if}

<details class="mb-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs" open>
  <summary class="flex cursor-pointer items-center gap-2 text-primary">
    <span class="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">{call.source}</span>
    <span class="font-medium">{call.toolName}</span>
    {#if call.durationMs !== undefined}
      <span class="ml-auto text-[10px] text-muted-foreground">{fmtMs(call.durationMs)}</span>
    {/if}
  </summary>
  <div class="mt-2 space-y-1">
    <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Input</p>
    <pre class="whitespace-pre-wrap break-all rounded bg-muted/50 p-1.5 font-mono text-[11px] leading-relaxed">{JSON.stringify(call.input, null, 2)}</pre>
    <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Output</p>
    <pre class="whitespace-pre-wrap break-all rounded bg-muted/50 p-1.5 font-mono text-[11px] leading-relaxed">{JSON.stringify(call.output, null, 2)}</pre>
    {#if call.toolCallId}
      <p class="text-[10px] text-muted-foreground/70">id: <code class="font-mono">{call.toolCallId}</code></p>
    {/if}
  </div>
</details>
