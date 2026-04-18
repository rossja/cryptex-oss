<script lang="ts">
  import { onMount } from 'svelte';
  import { queryMessages, countMessages } from '$lib/dataset/queries';
  import { shareGPTToJsonl } from '$lib/dataset/export-sharegpt';
  import { withManifest } from '$lib/dataset/export-raw';
  import { downloadBlob } from '$lib/dataset/download';
  import { session } from '$lib/auth/session.svelte';
  import type { MessageRow } from '$lib/chat/types';

  let messageCount = $state(0);
  let exportOpen = $state(false);

  async function refreshCount() {
    messageCount = await countMessages();
  }

  onMount(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 5000);
    return () => clearInterval(interval);
  });

  async function exportShareGPT() {
    exportOpen = false;
    const rows: MessageRow[] = await queryMessages({ ownerId: session.currentUser.id });
    const jsonl = shareGPTToJsonl(rows);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    downloadBlob(`cryptex-sharegpt-${ts}.jsonl`, jsonl);
  }

  async function exportRaw() {
    exportOpen = false;
    const rows: MessageRow[] = await queryMessages({ ownerId: session.currentUser.id });
    const jsonl = withManifest(rows, {});
    const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    downloadBlob(`cryptex-raw-${ts}.jsonl`, jsonl);
  }
</script>

<footer class="mt-3 flex items-center justify-between rounded-lg border border-border/50 bg-card/40 px-4 py-2 text-xs text-muted-foreground">
  <span>Dataset · {messageCount.toLocaleString()} {messageCount === 1 ? 'message' : 'messages'}</span>
  <span class="flex items-center gap-3">
    <a
      href="/dataset"
      class="hover:text-foreground hover:underline underline-offset-2 transition-colors"
      title="Open Dataset Inspector"
    >Inspector</a>

    <!-- Export dropdown -->
    <div class="relative">
      <button
        class="hover:text-foreground transition-colors"
        onclick={() => (exportOpen = !exportOpen)}
        aria-expanded={exportOpen}
        aria-haspopup="menu"
        title="Export dataset"
      >Export {exportOpen ? '▲' : '▼'}</button>

      {#if exportOpen}
        <!-- Backdrop -->
        <button
          class="fixed inset-0 z-10"
          aria-label="Close export menu"
          onclick={() => (exportOpen = false)}
        ></button>

        <div
          class="absolute right-0 bottom-6 z-20 w-40 rounded-lg border border-border bg-popover shadow-lg"
          role="menu"
        >
          <div class="flex flex-col p-1">
            <button
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-foreground hover:bg-muted/40 transition-colors"
              role="menuitem"
              onclick={exportShareGPT}
            >
              <span class="font-medium">ShareGPT</span>
              <span class="text-muted-foreground ml-auto">.jsonl</span>
            </button>
            <button
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-foreground hover:bg-muted/40 transition-colors"
              role="menuitem"
              onclick={exportRaw}
            >
              <span class="font-medium">Raw</span>
              <span class="text-muted-foreground ml-auto">.jsonl</span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </span>
</footer>
