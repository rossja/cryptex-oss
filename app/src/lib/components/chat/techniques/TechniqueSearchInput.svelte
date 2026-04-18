<script lang="ts">
  import Search from 'lucide-svelte/icons/search';
  type Props = { value: string; onChange: (v: string) => void; inputRef?: (el: HTMLInputElement | null) => void };
  let { value, onChange, inputRef }: Props = $props();

  let el = $state<HTMLInputElement | null>(null);
  $effect(() => { inputRef?.(el); });
</script>

<div class="flex items-center gap-2 border-b border-border/50 pb-2">
  <Search size={14} class="text-muted-foreground" />
  <input
    type="text"
    placeholder="Search techniques…"
    {value}
    oninput={(e) => onChange((e.target as HTMLInputElement).value)}
    class="flex-1 bg-transparent text-xs outline-none"
    bind:this={el}
  />
</div>
