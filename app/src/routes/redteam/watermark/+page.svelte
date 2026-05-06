<script lang="ts">
  import { analyzeResponse, SCHEME_LABELS, type WatermarkAnalysis } from '$lib/redteam/watermark-detector';
  import Droplet from 'lucide-svelte/icons/droplet';
  import UsageHint from '$lib/components/shell/UsageHint.svelte';

  let response = $state('');
  const analysis = $derived<WatermarkAnalysis | null>(response.trim().length > 0 ? analyzeResponse(response) : null);

  function confidenceClass(c: 'high' | 'medium' | 'low'): string {
    if (c === 'high') return 'border-red-500/40 bg-red-500/10 text-red-400';
    if (c === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
    return 'border-border bg-card/60 text-muted-foreground';
  }
</script>

<svelte:head><title>Watermark Detector · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <div class="flex items-center gap-2">
      <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
        Watermark <span class="text-primary italic">detector</span>
      </h1>
      <UsageHint
        title="Watermark detector · Usage"
        bullets={[
          'Paste any model response into the textarea.',
          'Detector scans for ZWSP / role-marker leaks / provider self-ID / low bigram entropy.',
          'Returns flagged signals with confidence (high / medium / low).',
          'Heuristic — a triage signal, not definitive proof.'
        ]}
      />
    </div>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Heuristic pattern-matchers for known LLM watermark schemes (Kirchenbauer green-list,
      Aaronson/OpenAI experimental) plus provider tells (chat-template markers leaking, model
      self-identification, zero-width-character injection). Not definitive — a triage signal.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <div class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <Droplet size={11} class="text-primary" />
          <span class="font-medium text-foreground">What gets flagged</span>
        </p>
        <ul class="mt-1 space-y-0.5">
          <li>• Zero-width / control-char injection (some watermarks use this)</li>
          <li>• EOS / role-marker leaks (LLaMA, DeepSeek, Qwen, Anthropic)</li>
          <li>• Provider self-identification phrases (OpenAI, Claude, Gemini)</li>
          <li>• Low bigram entropy (possible green-list bias)</li>
        </ul>
      </div>
    </div>

    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Response to scan</h2>
        <textarea
          bind:value={response}
          rows="10"
          placeholder="Paste a target model response here…"
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      {#if analysis}
        <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-sm">Analysis</h2>
            <span class={'rounded-full border px-2 py-0.5 text-[11px] ' + (analysis.likelyWatermarked ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400')}>
              {analysis.likelyWatermarked ? 'Likely watermarked' : 'No strong signal'}
            </span>
          </div>

          <div class="grid grid-cols-4 gap-3 text-center">
            <div class="rounded-lg border border-input bg-background/70 p-3">
              <div class="font-mono text-2xl text-foreground">{analysis.stats.length}</div>
              <div class="text-[11px] text-muted-foreground">Length</div>
            </div>
            <div class="rounded-lg border border-input bg-background/70 p-3">
              <div class={'font-mono text-2xl ' + (analysis.stats.zeroWidthChars > 0 ? 'text-red-400' : 'text-foreground')}>{analysis.stats.zeroWidthChars}</div>
              <div class="text-[11px] text-muted-foreground">ZWSP</div>
            </div>
            <div class="rounded-lg border border-input bg-background/70 p-3">
              <div class="font-mono text-2xl text-foreground">{analysis.stats.bigramEntropy.toFixed(2)}</div>
              <div class="text-[11px] text-muted-foreground">Bigram entropy</div>
            </div>
            <div class="rounded-lg border border-input bg-background/70 p-3">
              <div class="font-mono text-2xl text-foreground">{(analysis.stats.punctuationRatio * 100).toFixed(1)}%</div>
              <div class="text-[11px] text-muted-foreground">Punct. density</div>
            </div>
          </div>

          {#if analysis.signals.length > 0}
            <div class="space-y-1">
              <h3 class="text-[11px] uppercase tracking-wider text-muted-foreground">Signals</h3>
              <ul class="space-y-1">
                {#each analysis.signals as s}
                  <li class="flex items-start gap-2 rounded-md border border-input bg-background/70 px-2 py-1.5 text-[11px]">
                    <span class={'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ' + confidenceClass(s.confidence)}>
                      {s.confidence}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="font-mono text-foreground">{SCHEME_LABELS[s.scheme]}</div>
                      <div class="text-[10px] italic text-muted-foreground">{s.detail}</div>
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {:else}
            <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-3 text-center text-xs text-muted-foreground">
              No watermark / tell signals detected.
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>
