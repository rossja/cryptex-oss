<script lang="ts">
  import { liveQuery } from 'dexie';
  import { repo } from '$lib/chat/repo';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import type { ChatRow } from '$lib/chat/types';
  import NewChatButton from './NewChatButton.svelte';
  import ChatListItem from './ChatListItem.svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import EllipsisVertical from 'lucide-svelte/icons/ellipsis-vertical';
  import SquareCheck from 'lucide-svelte/icons/square-check';

  let chats = $state<ChatRow[]>([]);
  let loading = $state(true);
  let confirmClearOpen = $state(false);
  let selectionMode = $state(false);
  let selected = $state(new Set<string>());

  // liveQuery auto-reacts to any Dexie mutation (rename, delete, new chat)
  $effect(() => {
    const sub = liveQuery(() => repo.listChats()).subscribe({
      next: (list) => {
        chats = list;
        loading = false;
      },
      error: (err) => {
        console.error('[chat list]', err);
        loading = false;
      }
    });
    return () => sub.unsubscribe();
  });

  async function refresh() {
    chats = await repo.listChats();
  }

  const activeId = $derived(
    $page.url.pathname.replace(base, '').match(/^\/chat\/([^/]+)/)?.[1] ?? null
  );

  function select(id: string) { goto(`${base}/chat/${id}`); }

  async function clearAllChats() {
    confirmClearOpen = false;
    for (const c of chats) {
      await repo.deleteChat(c.id);
    }
    await refresh();
    if (activeId) goto(`${base}/chat`);
  }

  function toggleSelectionMode() {
    selectionMode = !selectionMode;
    selected = new Set();
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  async function deleteSelected() {
    for (const id of selected) {
      await repo.deleteChat(id);
    }
    const deletedActive = activeId && selected.has(activeId);
    selected = new Set();
    selectionMode = false;
    await refresh();
    if (deletedActive) goto(`${base}/chat`);
  }
</script>

<div class="flex h-full flex-col gap-2">
  <div class="flex items-center gap-1">
    <div class="flex-1"><NewChatButton /></div>
    <button
      type="button"
      onclick={toggleSelectionMode}
      aria-label={selectionMode ? 'Exit selection mode' : 'Select chats'}
      class="inline-flex h-8 w-8 items-center justify-center rounded transition-colors
        {selectionMode
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'}"
    >
      <SquareCheck size={14} />
    </button>
    {#if !selectionMode}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <button
              type="button"
              {...props}
              class="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Sidebar options"
            >
              <EllipsisVertical size={14} />
            </button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-44">
          <DropdownMenu.Item
            onclick={() => { confirmClearOpen = true; }}
            class="text-destructive focus:text-destructive"
          >
            Clear all chats…
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/if}
  </div>

  {#if confirmClearOpen}
    <div class="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs">
      <p class="mb-2 text-destructive">Delete all chats? This cannot be undone.</p>
      <div class="flex gap-2">
        <button type="button" onclick={clearAllChats} class="rounded bg-destructive px-2 py-0.5 text-destructive-foreground hover:opacity-90">Delete all</button>
        <button type="button" onclick={() => { confirmClearOpen = false; }} class="rounded px-2 py-0.5 hover:bg-muted/40">Cancel</button>
      </div>
    </div>
  {/if}

  <div class="mt-1 flex-1 overflow-y-auto cryptex-scroll">
    {#if loading}
      <p class="px-2 text-xs text-muted-foreground">Loading…</p>
    {:else if chats.length === 0}
      <p class="px-2 text-xs text-muted-foreground">No chats yet.</p>
    {:else}
      <div class="flex flex-col gap-0.5">
        {#each chats as chat (chat.id)}
          <ChatListItem
            {chat}
            active={chat.id === activeId}
            onSelect={() => select(chat.id)}
            onRefresh={refresh}
            {selectionMode}
            selected={selected.has(chat.id)}
            onToggleSelect={() => toggleSelect(chat.id)}
          />
        {/each}
      </div>
    {/if}
  </div>

  {#if selectionMode && selected.size > 0}
    <div class="flex items-center gap-2 border-t border-border/40 pt-2">
      <button
        type="button"
        onclick={deleteSelected}
        class="flex-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:opacity-90"
      >
        Delete {selected.size} chat{selected.size === 1 ? '' : 's'}
      </button>
      <button
        type="button"
        onclick={() => { selected = new Set(); }}
        class="rounded px-2 py-1 text-xs hover:bg-muted/40"
      >
        Clear
      </button>
    </div>
  {/if}
</div>
