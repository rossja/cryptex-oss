<script lang="ts">
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import TokenizerTool from '$lib/components/tools/tokenizer/TokenizerTool.svelte';
</script>

<!--
  v2.2 (Wave 10.2): /tokenizer is deprecated. Token-count + segmentation
  visualization overlaps with /fuzzer + standard LLM dev-tools. Page still
  works; hidden from top nav.
-->
<div class="mx-auto mb-4 max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
  <strong>Deprecated in v2.2.</strong> Tokenizer visualization overlapped with
  /fuzzer and external LLM dev-tools. The page still works for direct deep-links,
  but it's been removed from the top nav. For tokenizer-driven attack design,
  see <a href="/fuzzer" class="text-primary hover:underline">/fuzzer</a> or
  <a href="/redteam/glitch-tokens" class="text-primary hover:underline">/redteam/glitch-tokens</a>.
</div>

<ToolShell
  toolId="tokenizer"
  title="Tokenizer"
  description="Visualize how models segment your text. Toggle between UTF-8 bytes, naive word splits, and the BPE encoders used by GPT-3.5, GPT-4, and GPT-4o."
  usage={{
    title: 'Tokenizer · Usage',
    bullets: [
      'Compare different BPE vocabularies on the same input.',
      'Each token is colored so boundaries are visible.',
      'Useful for verifying token-bomb output and prompt cost.',
      'cl100k = GPT-3.5/4, o200k = GPT-4o, p50k/r50k = older models.'
    ]
  }}
>
  <TokenizerTool />
</ToolShell>
