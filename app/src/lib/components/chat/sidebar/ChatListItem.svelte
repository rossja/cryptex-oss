<script lang="ts">
  import { repo } from '$lib/chat/repo';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import type { ChatRow } from '$lib/chat/types';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Trash2 from 'lucide-svelte/icons/trash-2';

  type Props = {
    chat: ChatRow;
    active: boolean;
    onSelect: () => void;
    onRefresh: () => Promise<void>;
    selectionMode?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
  };

  let { chat, active, onSelect, onRefresh, selectionMode = false, selected = false, onToggleSelect }: Props = $props();

  // Rename state
  let renaming = $state(false);
  let renamingValue = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  function startRename(e: MouseEvent) {
    e.stopPropagation();
    renamingValue = chat.title || '';
    renaming = true;
    // Focus after DOM update
    setTimeout(() => inputEl?.focus(), 0);
  }

  async function commitRename() {
    const trimmed = renamingValue.trim();
    renaming = false;
    if (trimmed && trimmed !== chat.title) {
      await repo.updateChat(chat.id, { title: trimmed });
      await onRefresh();
    }
  }

  function cancelRename() {
    renaming = false;
    renamingValue = '';
  }

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    const wasActive = active;
    await repo.deleteChat(chat.id);
    await onRefresh();
    if (wasActive) goto(`${base}/chat`);
  }
</script>

{#if selectionMode}
  <label
    class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors
      {selected
        ? 'bg-primary/15 text-foreground font-medium'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
  >
    <input
      type="checkbox"
      checked={selected}
      onchange={onToggleSelect}
      class="h-3.5 w-3.5 shrink-0 accent-primary"
    />
    <span class="truncate">{chat.title || 'Untitled chat'}</span>
  </label>
{:else}
  <div
    role="listitem"
    class="group flex w-full items-center gap-1 rounded transition-colors duration-150
      {active
        ? 'bg-muted text-foreground'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
  >
    {#if renaming}
      <!-- Inline rename input — takes full row width, no navigation -->
      <input
        bind:this={inputEl}
        bind:value={renamingValue}
        onkeydown={onRenameKeydown}
        onblur={commitRename}
        class="min-w-0 flex-1 rounded bg-background px-2 py-1.5 text-sm text-foreground outline-none ring-1 ring-primary/60 focus:ring-primary"
        aria-label="Rename chat"
      />
    {:else}
      <button
        type="button"
        onclick={onSelect}
        class="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm font-medium leading-snug
          {active ? '' : 'font-normal'}"
      >
        {chat.title || 'Untitled chat'}
      </button>
    {/if}

    <!-- Action icons — hidden until row hover, hidden while renaming -->
    {#if !renaming}
      <button
        type="button"
        onclick={startRename}
        aria-label="Rename chat"
        class="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100
          hover:bg-muted/70 hover:text-foreground focus-visible:opacity-100"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onclick={handleDelete}
        aria-label="Delete chat"
        class="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100
          hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 mr-0.5"
      >
        <Trash2 size={13} />
      </button>
    {/if}
  </div>
{/if}
