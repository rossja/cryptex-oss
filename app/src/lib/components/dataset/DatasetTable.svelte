<script lang="ts">
  import type { MessageRow } from '$lib/chat/types';

  interface Props {
    rows: MessageRow[];
    selectedIds: Set<string>;
    onselect: (id: string, multi: boolean) => void;
  }

  let { rows, selectedIds, onselect }: Props = $props();

  // Sorting
  type SortKey = 'createdAt' | 'role' | 'rating' | 'split';
  let sortKey = $state<SortKey>('createdAt');
  let sortAsc = $state(false);

  let sorted = $derived.by(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: unknown = a[sortKey];
      let bv: unknown = b[sortKey];
      if (av === undefined || av === null) av = '';
      if (bv === undefined || bv === null) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
  }

  function handleRowClick(e: MouseEvent, id: string) {
    onselect(id, e.shiftKey || e.ctrlKey || e.metaKey);
    // Move focus to the container so arrow-key nav works immediately
    containerEl?.focus();
  }

  function fmt(ms: number) {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Container element — needed for focus management
  let containerEl = $state<HTMLDivElement | undefined>(undefined);

  // Arrow-key navigation
  function onKeydown(e: KeyboardEvent) {
    // Find any currently selected row to anchor navigation
    const firstSelected = [...selectedIds][0];
    if (!firstSelected) return;
    const idx = sorted.findIndex((r) => r.id === firstSelected);
    if (idx === -1) return;

    let nextIdx = idx;
    if (e.key === 'ArrowDown') nextIdx = Math.min(sorted.length - 1, idx + 1);
    else if (e.key === 'ArrowUp') nextIdx = Math.max(0, idx - 1);
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = sorted.length - 1;
    else if (e.key === 'PageDown') nextIdx = Math.min(sorted.length - 1, idx + 10);
    else if (e.key === 'PageUp') nextIdx = Math.max(0, idx - 10);
    else return;

    e.preventDefault();
    onselect(sorted[nextIdx].id, false);
    // Scroll selected row into view
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-row-id="${sorted[nextIdx].id}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }
</script>

<!-- tabindex="0" so the container can receive keyboard focus for arrow-key nav -->
<div
  class="flex h-full flex-col outline-none"
  bind:this={containerEl}
  tabindex="0"
  role="grid"
  aria-label="Message rows"
  onkeydown={onKeydown}
>
  <!-- Header row — pinned, does not scroll -->
  <div class="flex-none grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-border/60 px-3 pb-2 pt-3 text-xs font-medium text-muted-foreground">
    <button class="text-left hover:text-foreground" onclick={() => toggleSort('createdAt')}>
      Date {sortKey === 'createdAt' ? (sortAsc ? '↑' : '↓') : ''}
    </button>
    <button class="text-left hover:text-foreground" onclick={() => toggleSort('role')}>
      Role {sortKey === 'role' ? (sortAsc ? '↑' : '↓') : ''}
    </button>
    <span>Model</span>
    <button class="text-left hover:text-foreground" onclick={() => toggleSort('rating')}>
      Rating {sortKey === 'rating' ? (sortAsc ? '↑' : '↓') : ''}
    </button>
    <button class="text-left hover:text-foreground" onclick={() => toggleSort('split')}>
      Split {sortKey === 'split' ? (sortAsc ? '↑' : '↓') : ''}
    </button>
    <span>Tags</span>
  </div>

  <!-- Rows — scrollable -->
  <div class="flex-1 overflow-y-auto cryptex-scroll px-3">
    {#if rows.length === 0}
      <p class="py-8 text-center text-sm text-muted-foreground">No messages match the current filters.</p>
    {:else}
      <!-- Plain render — pagination caps at 50 rows so no virtualization needed -->
      <div class="flex flex-col">
        {#each sorted as row (row.id)}
          <button
            data-row-id={row.id}
            class="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 rounded px-1 py-2 text-left text-xs transition-colors hover:bg-muted/40 {selectedIds.has(row.id) ? 'bg-primary/10 font-medium' : ''}"
            onclick={(e) => handleRowClick(e, row.id)}
          >
            <span class="truncate text-muted-foreground">{fmt(row.createdAt)}</span>
            <span class="capitalize">{row.role}</span>
            <span class="truncate text-muted-foreground">{row.modelReturned ?? row.modelRequested ?? '—'}</span>
            <span>{row.rating ? '★'.repeat(row.rating) : '—'}</span>
            <span class="capitalize">{row.split ?? '—'}</span>
            <span class="truncate text-muted-foreground">{(row.tags ?? []).join(', ') || '—'}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
