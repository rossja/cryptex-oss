<script lang="ts">
  import { repo } from '$lib/chat/repo';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { hasAnyKey } from '$lib/ai/gateway';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';

  let empty = $state(false);
  const keyConfigured = $derived(hasAnyKey());

  onMount(async () => {
    const list = await repo.listChats();
    if (list.length > 0) {
      goto(`${base}/chat/${list[0].id}`, { replaceState: true });
    } else {
      empty = true;
    }
  });
</script>

{#if empty}
  <div class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
    <div class="w-full max-w-xl">
      <NoProviderBanner context="chat" />
    </div>
    {#if keyConfigured}
      <p class="font-serif text-lg">No chats yet</p>
      <p class="text-sm text-muted-foreground">
        Click <kbd class="rounded border px-1 py-0.5 text-xs">+ New chat</kbd> to begin.
      </p>
    {:else}
      <p class="text-sm text-muted-foreground">
        Once a provider is configured, click <kbd class="rounded border px-1 py-0.5 text-xs">+ New chat</kbd> to start.
      </p>
    {/if}
  </div>
{/if}
