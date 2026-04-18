<script lang="ts">
  type SlashEntry = { id: string; name: string; description: string; icon?: string };

  type Props = {
    suggestions: SlashEntry[];
    selectedIndex: number;
    onSelect: (t: SlashEntry) => void;
  };
  let { suggestions, selectedIndex, onSelect }: Props = $props();
</script>

{#if suggestions.length > 0}
  <div
    role="listbox"
    aria-label="Slash command suggestions"
    class="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-lg border border-border/60 bg-popover shadow-lg overflow-hidden"
  >
    {#each suggestions as t, i (t.id)}
      <button
        type="button"
        role="option"
        aria-selected={i === selectedIndex}
        onclick={() => onSelect(t)}
        class="flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors
          {i === selectedIndex ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted/40'}"
      >
        <span class="mt-0.5 text-base leading-none">{t.icon ?? '✦'}</span>
        <span class="flex flex-col min-w-0">
          <span class="font-mono font-semibold">/{t.id}</span>
          <span class="truncate text-[10px] text-muted-foreground">{t.description}</span>
        </span>
      </button>
    {/each}
  </div>
{/if}
