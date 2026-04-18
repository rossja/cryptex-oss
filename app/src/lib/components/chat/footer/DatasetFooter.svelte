<script lang="ts">
  import { db } from '$lib/chat/db';
  import { onMount } from 'svelte';

  let messageCount = $state(0);

  async function refreshCount() {
    messageCount = await db.messages.count();
  }

  onMount(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 5000);
    return () => clearInterval(interval);
  });
</script>

<footer class="mt-3 flex items-center justify-between rounded-lg border border-border/50 bg-card/40 px-4 py-2 text-xs text-muted-foreground">
  <span>Dataset · {messageCount.toLocaleString()} {messageCount === 1 ? 'message' : 'messages'}</span>
  <span class="flex items-center gap-3">
    <span class="cursor-not-allowed opacity-40" title="Coming soon">Inspector (soon)</span>
    <span class="cursor-not-allowed opacity-40" title="Coming soon">Export (soon)</span>
  </span>
</footer>
