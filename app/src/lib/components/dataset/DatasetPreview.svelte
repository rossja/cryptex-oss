<script lang="ts">
  import type { MessageRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';

  interface Props {
    row: MessageRow | null;
    onupdate: () => void;
  }

  let { row, onupdate }: Props = $props();

  async function setRating(r: 1 | 2 | 3 | 4 | 5) {
    if (!row) return;
    await repo.updateMessage(row.id, { rating: r });
    onupdate();
  }

  async function setThumb(direction: 'up' | 'down') {
    if (!row) return;
    const patch =
      direction === 'up'
        ? { thumbsUp: !row.thumbsUp, thumbsDown: false }
        : { thumbsDown: !row.thumbsDown, thumbsUp: false };
    await repo.updateMessage(row.id, patch);
    onupdate();
  }

  async function setTrainingInclude(val: boolean) {
    if (!row) return;
    await repo.updateMessage(row.id, { trainingInclude: val });
    onupdate();
  }

  let jsonPreview = $derived(row ? JSON.stringify(row, null, 2) : '');
</script>

<div class="flex h-full flex-col gap-4 rounded-lg border border-border/30 bg-card/30 p-4 text-sm overflow-y-auto cryptex-scroll">
  {#if !row}
    <p class="text-center text-muted-foreground text-xs pt-8">Select a row to preview.</p>
  {:else}
    <div class="flex items-start justify-between gap-2">
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-muted-foreground">Role</span>
        <span class="font-medium capitalize">{row.role}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-muted-foreground">Model</span>
        <span class="text-xs">{row.modelReturned ?? row.modelRequested ?? '—'}</span>
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-muted-foreground">Split</span>
        <span class="text-xs capitalize">{row.split ?? '—'}</span>
      </div>
    </div>

    <!-- Rating -->
    <div class="flex flex-col gap-1">
      <span class="text-xs text-muted-foreground">Rating</span>
      <div class="flex gap-1">
        {#each [1, 2, 3, 4, 5] as r}
          <button
            class="text-base transition-opacity {row.rating && row.rating >= r ? 'opacity-100' : 'opacity-30'} hover:opacity-100"
            onclick={() => setRating(r as 1 | 2 | 3 | 4 | 5)}
            title="Rate {r}"
          >★</button>
        {/each}
      </div>
    </div>

    <!-- Thumbs -->
    <div class="flex gap-2">
      <button
        class="rounded border px-2 py-1 text-xs transition-colors {row.thumbsUp ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'}"
        onclick={() => setThumb('up')}
      >👍 {row.thumbsUp ? 'Liked' : 'Like'}</button>
      <button
        class="rounded border px-2 py-1 text-xs transition-colors {row.thumbsDown ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground hover:border-destructive hover:text-destructive'}"
        onclick={() => setThumb('down')}
      >👎 {row.thumbsDown ? 'Disliked' : 'Dislike'}</button>
    </div>

    <!-- Training include toggle -->
    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        id="training-include"
        checked={row.trainingInclude === true}
        onchange={(e) => setTrainingInclude((e.currentTarget as HTMLInputElement).checked)}
        class="h-3.5 w-3.5 rounded border border-border"
      />
      <label for="training-include" class="text-xs text-muted-foreground cursor-pointer">Include in training data</label>
    </div>

    <!-- JSONL preview -->
    <div class="flex flex-col gap-1 flex-1 min-h-0">
      <span class="text-xs text-muted-foreground">JSONL preview</span>
      <pre class="flex-1 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px] leading-relaxed text-foreground/80 min-h-[120px] max-h-[320px]">{jsonPreview}</pre>
    </div>
  {/if}
</div>
