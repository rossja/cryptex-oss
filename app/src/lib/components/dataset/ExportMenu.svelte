<script lang="ts">
  import type { MessageRow } from '$lib/chat/types';
  import type { DatasetFilters } from '$lib/dataset/queries';
  import { shareGPTToJsonl } from '$lib/dataset/export-sharegpt';
  import { withManifest } from '$lib/dataset/export-raw';
  import { downloadBlob } from '$lib/dataset/download';

  interface Props {
    rows: MessageRow[];
    filters: DatasetFilters;
  }

  let { rows, filters }: Props = $props();

  let open = $state(false);

  function exportShareGPT() {
    const jsonl = shareGPTToJsonl(rows);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    downloadBlob(`cryptex-sharegpt-${ts}.jsonl`, jsonl);
    open = false;
  }

  function exportRaw() {
    const jsonl = withManifest(rows, filters);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    downloadBlob(`cryptex-raw-${ts}.jsonl`, jsonl);
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative">
  <button
    class="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-haspopup="menu"
  >
    Export
    <span class="text-[10px]">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <!-- Backdrop -->
    <button
      class="fixed inset-0 z-10"
      aria-label="Close export menu"
      onclick={() => (open = false)}
    ></button>

    <div
      class="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-popover shadow-lg"
      role="menu"
    >
      <div class="flex flex-col p-1">
        <button
          class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-foreground hover:bg-muted/40 transition-colors"
          role="menuitem"
          onclick={exportShareGPT}
          disabled={rows.length === 0}
        >
          <span class="font-medium">ShareGPT</span>
          <span class="text-muted-foreground ml-auto">.jsonl</span>
        </button>
        <button
          class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-foreground hover:bg-muted/40 transition-colors"
          role="menuitem"
          onclick={exportRaw}
          disabled={rows.length === 0}
        >
          <span class="font-medium">Raw</span>
          <span class="text-muted-foreground ml-auto">.jsonl</span>
        </button>
      </div>
      {#if rows.length === 0}
        <p class="px-3 pb-2 text-[10px] text-muted-foreground">No rows to export</p>
      {:else}
        <p class="px-3 pb-2 text-[10px] text-muted-foreground">{rows.length} rows</p>
      {/if}
    </div>
  {/if}
</div>
