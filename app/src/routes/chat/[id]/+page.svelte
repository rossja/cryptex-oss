<script lang="ts">
  import { page } from '$app/stores';
  import { repo } from '$lib/chat/repo';
  import { liveQuery } from 'dexie';
  import type { ChatRow } from '$lib/chat/types';
  import ChatWorkspace from '$lib/components/chat/workspace/ChatWorkspace.svelte';

  let chat = $state<ChatRow | null>(null);
  let loading = $state(true);
  let missing = $state(false);

  $effect(() => {
    const id = $page.params.id ?? '';
    loading = true; missing = false;
    const subscription = liveQuery(() => repo.getChat(id)).subscribe({
      next: (row) => {
        if (!row) { missing = true; chat = null; } else { chat = row; missing = false; }
        loading = false;
      },
      error: (err) => { console.error('[chat liveQuery]', err); loading = false; }
    });
    return () => subscription.unsubscribe();
  });
</script>

{#if loading}
  <p class="m-auto text-sm text-muted-foreground">Loading…</p>
{:else if missing}
  <p class="m-auto text-sm text-muted-foreground">Chat not found.</p>
{:else if chat}
  <ChatWorkspace {chat} />
{/if}
