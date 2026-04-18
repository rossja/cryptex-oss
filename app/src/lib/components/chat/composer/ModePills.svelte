<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { toasts } from '$lib/stores/toast.svelte';

  type Props = { activeMode: string | null; onModeChange: (id: string | null) => void };
  let { activeMode, onModeChange }: Props = $props();

  const MODE_IDS = ['creative', 'intelligent', 'adaptive'] as const;

  function clickGodmode() {
    toasts.push('Godmode is reserved — coming soon', 'info');
  }
</script>

<div role="radiogroup" aria-label="Composer mode" class="inline-flex items-center gap-1 flex-wrap">
  {#each MODE_IDS as id (id)}
    {@const active = activeMode === id}
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onclick={() => onModeChange(active ? null : id)}
      class={cn(
        'rounded-full border px-2.5 py-0.5 text-xs transition-all duration-200',
        active
          ? 'bg-primary/20 border-primary/40 text-primary ring-1 ring-primary/30 scale-105'
          : 'border-border/50 text-muted-foreground opacity-70 hover:opacity-100 hover:bg-muted/40'
      )}
    >{id}</button>
  {/each}

  <!-- Godmode pill — disabled, coming soon -->
  <button
    type="button"
    onclick={clickGodmode}
    title="Jailbreak chains coming in v2"
    aria-disabled="true"
    class="rounded-full border border-border/40 px-2.5 py-0.5 text-xs text-muted-foreground opacity-40 cursor-not-allowed"
  >godmode</button>
</div>
