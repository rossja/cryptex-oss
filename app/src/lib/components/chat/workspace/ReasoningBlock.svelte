<script lang="ts">
  import ChevronRight from 'lucide-svelte/icons/chevron-right';

  type Props = { text: string; live?: boolean };
  let { text, live = false }: Props = $props();

  let open = $state(false);

  // Open while streaming, close when done
  $effect(() => {
    open = live;
  });
</script>

{#if text || live}
  <details
    class="group mb-2 rounded-md border border-border/60 bg-muted/20 text-xs"
    bind:open
  >
    <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground">
      <ChevronRight size={12} class="transition-transform group-open:rotate-90" />
      {#if live}
        <span class="flex items-center gap-1">
          Thinking
          <span class="inline-flex gap-0.5">
            <span class="animate-bounce" style="animation-delay:0ms">·</span>
            <span class="animate-bounce" style="animation-delay:150ms">·</span>
            <span class="animate-bounce" style="animation-delay:300ms">·</span>
          </span>
        </span>
      {:else}
        <span>Reasoning · {text.length} chars</span>
      {/if}
    </summary>
    <div class="max-h-60 overflow-y-auto cryptex-scroll border-t border-border/40 px-3 py-2">
      <pre class="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">{text}</pre>
    </div>
  </details>
{/if}
