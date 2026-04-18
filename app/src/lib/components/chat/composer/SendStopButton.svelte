<script lang="ts">
  import ArrowUp from 'lucide-svelte/icons/arrow-up';
  import Square from 'lucide-svelte/icons/square';

  type Props = { streaming: boolean; disabled: boolean; onSend: () => void; onStop: () => void };
  let { streaming, disabled, onSend, onStop }: Props = $props();
</script>

{#if streaming}
  <button
    type="button"
    onclick={onStop}
    class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-destructive text-destructive-foreground transition-transform hover:scale-105 active:scale-95"
    aria-label="Stop"
  >
    <Square size={14} />
  </button>
{:else}
  <button
    type="button"
    onclick={onSend}
    {disabled}
    class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40 transition-transform hover:scale-105 active:scale-95"
    aria-label="Send"
  >
    <ArrowUp size={14} />
  </button>
{/if}
