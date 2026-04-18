<script lang="ts">
  import GitBranch from 'lucide-svelte/icons/git-branch';
  type Props = { onFork: () => void };
  let { onFork }: Props = $props();
</script>

<button
  type="button"
  onclick={onFork}
  class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
  aria-label="Fork from this message"
>
  <GitBranch size={12} /> Fork
</button>
