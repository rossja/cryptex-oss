<script lang="ts">
  import { repo } from '$lib/chat/repo';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Plus from 'lucide-svelte/icons/plus';
  import { lastChatModel } from '$lib/stores/lastChatModel.svelte';

  async function newChat() {
    const chat = await repo.createChat({
      title: 'New chat',
      modelQualifiedId: lastChatModel.value || 'openrouter:openrouter/auto'
    });
    goto(`${base}/chat/${chat.id}`);
  }
</script>

<button type="button" onclick={newChat} class="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border/50 py-2 text-sm text-muted-foreground hover:bg-muted/30">
  <Plus size={14} /> New chat
</button>
