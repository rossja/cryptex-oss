<script lang="ts">
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import BookOpen from 'lucide-svelte/icons/book-open';
  import ExternalLink from 'lucide-svelte/icons/external-link';

  type Props = {
    dossier: string | null;
    citations: string[];
  };
  let { dossier, citations }: Props = $props();

  let open = $state(false);
</script>

{#if dossier}
  <details class="group rounded-md border border-primary/30 bg-primary/5 text-xs" bind:open>
    <summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-foreground hover:bg-primary/10">
      <ChevronRight size={12} class="transition-transform group-open:rotate-90" />
      <BookOpen size={12} class="text-primary" />
      <span class="font-medium">Research dossier</span>
      <span class="text-[10px] text-muted-foreground">({citations.length} {citations.length === 1 ? 'source' : 'sources'})</span>
    </summary>
    <div class="flex flex-col gap-2 border-t border-primary/20 px-3 py-2">
      <pre class="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-muted-foreground">{dossier}</pre>
      {#if citations.length > 0}
        <div class="flex flex-col gap-0.5 border-t border-border/30 pt-2">
          <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Citations</span>
          {#each citations as url (url)}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 truncate text-[11px] text-primary hover:underline"
            >
              <ExternalLink size={10} class="shrink-0" />
              <span class="truncate">{url}</span>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </details>
{/if}
