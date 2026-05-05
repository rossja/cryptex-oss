<script lang="ts">
  import type { ChatRow, AttackSessionRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import Pin from 'lucide-svelte/icons/pin';
  import X from 'lucide-svelte/icons/x';

  type Props = { chat: ChatRow };
  let { chat }: Props = $props();

  let session = $state<AttackSessionRow | null>(null);

  $effect(() => {
    const id = chat.settings?.persistedAttackSessionId;
    if (!id) { session = null; return; }
    void repo.getAttackSession(id).then((row) => { session = row; });
  });

  async function unpin() {
    await repo.unpinAttackSession(chat.id);
  }

  function preview(s: string, n = 60): string {
    const t = s.trim();
    return t.length <= n ? t : t.slice(0, n) + '…';
  }
</script>

{#if session}
  <div class="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px]">
    <Pin size={11} class="shrink-0 mt-0.5 text-primary" />
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2">
        <span class="font-medium text-foreground">Pinned</span>
        <span class="truncate text-muted-foreground">{preview(session.objective)}</span>
        <span class="ml-auto text-[10px] text-muted-foreground">{session.turns.length} turns</span>
      </div>
      <p class="mt-0.5 text-[10px] text-muted-foreground">Replies prepended with the won transcript. Unpin to send normally.</p>
    </div>
    <button
      type="button"
      onclick={unpin}
      aria-label="Unpin session"
      class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    ><X size={11} /></button>
  </div>
{/if}
