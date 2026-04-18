<script lang="ts">
  import type { MessageRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';

  interface Props {
    selectedIds: Set<string>;
    rows: MessageRow[];
    onrefresh: () => void;
  }

  let { selectedIds, rows, onrefresh }: Props = $props();

  let tagsInput = $state('');
  let busy = $state(false);

  function selectedRows(): MessageRow[] {
    return rows.filter((r) => selectedIds.has(r.id));
  }

  async function bulkDelete() {
    if (!selectedIds.size) return;
    busy = true;
    try {
      for (const id of selectedIds) {
        await repo.updateMessage(id, { tombstoned: true });
      }
      onrefresh();
    } finally {
      busy = false;
    }
  }

  async function bulkStar() {
    if (!selectedIds.size) return;
    busy = true;
    try {
      for (const row of selectedRows()) {
        const newRating: 5 = 5;
        await repo.updateMessage(row.id, { rating: newRating, thumbsUp: true });
      }
      onrefresh();
    } finally {
      busy = false;
    }
  }

  async function bulkRetag() {
    if (!selectedIds.size || !tagsInput.trim()) return;
    const newTags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    busy = true;
    try {
      for (const row of selectedRows()) {
        const merged = Array.from(new Set([...(row.tags ?? []), ...newTags]));
        await repo.updateMessage(row.id, { tags: merged });
      }
      tagsInput = '';
      onrefresh();
    } finally {
      busy = false;
    }
  }

  async function bulkSetSplit(split: 'train' | 'val') {
    if (!selectedIds.size) return;
    busy = true;
    try {
      for (const id of selectedIds) {
        await repo.updateMessage(id, { split });
      }
      onrefresh();
    } finally {
      busy = false;
    }
  }
</script>

{#if selectedIds.size > 0}
  <div class="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-xs">
    <span class="font-medium text-foreground">{selectedIds.size} selected</span>

    <button
      class="rounded border border-destructive/60 px-2 py-1 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
      onclick={bulkDelete}
      disabled={busy}
    >Delete</button>

    <button
      class="rounded border border-amber-400/60 px-2 py-1 text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
      onclick={bulkStar}
      disabled={busy}
    >★ Star all</button>

    <div class="flex items-center gap-1">
      <input
        type="text"
        bind:value={tagsInput}
        placeholder="Add tags…"
        class="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-28"
      />
      <button
        class="rounded border border-border px-2 py-1 hover:bg-muted/40 transition-colors disabled:opacity-50"
        onclick={bulkRetag}
        disabled={busy || !tagsInput.trim()}
      >Tag</button>
    </div>

    <span class="text-muted-foreground">Split:</span>
    <button
      class="rounded border border-border px-2 py-1 hover:bg-muted/40 transition-colors disabled:opacity-50"
      onclick={() => bulkSetSplit('train')}
      disabled={busy}
    >Train</button>
    <button
      class="rounded border border-border px-2 py-1 hover:bg-muted/40 transition-colors disabled:opacity-50"
      onclick={() => bulkSetSplit('val')}
      disabled={busy}
    >Val</button>
  </div>
{/if}
