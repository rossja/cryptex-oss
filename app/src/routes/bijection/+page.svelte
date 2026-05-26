<script lang="ts">
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import BijectionTool from '$lib/components/tools/bijection/BijectionTool.svelte';
</script>

<!--
  v2.2 (Wave 10.2): /bijection is deprecated. Functionally subsumed by
  /transforms (encode/reverse + 159 transformers covers the same ground
  plus more). Page still works for direct deep-links.
-->
<div class="mx-auto mb-4 max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
  <strong>Deprecated in v2.2.</strong> Bijection was a single encoding pattern
  that <a href="/transforms" class="text-primary hover:underline">/transforms</a>
  already covers (and 158 other ciphers besides). The page still works for direct
  deep-links, but it's been removed from the top nav. The forthcoming stacked-cipher
  attack lab (v2.3) will replace this for the actual red-team use case.
</div>

<ToolShell
  toolId="bijection"
  title="Bijection alphapr"
  accent="alphapr"
  description={'Generate character-to-token substitution mappings and wrap your input in a teaching prompt ("learn my language called alphapr"). Multiple variants per run for research-grade prompt fuzzing.'}
  usage={{
    title: 'Bijection alphapr · Usage',
    bullets: [
      'Generates char→token bijections wrapped in a teaching prompt.',
      'Budget controls how many variants per run.',
      'Larger fixed-size = more leading chars un-mapped (lower noise).',
      'Use Shuffle to permute the same mapping; Regen for a new one.',
      '1 MB input cap — payload size is bounded per pass.'
    ]
  }}
>
  <BijectionTool />
</ToolShell>
