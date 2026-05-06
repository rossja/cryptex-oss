<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '$lib/chat/db';
  import type { AttackChainRunRow, GodmodeRunRow } from '$lib/chat/types';
  import { onMount } from 'svelte';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import Database from 'lucide-svelte/icons/database';
  import UsageHint from '$lib/components/shell/UsageHint.svelte';

  let chainRuns = $state<AttackChainRunRow[]>([]);
  let godmodeRuns = $state<GodmodeRunRow[]>([]);
  let loaded = $state(false);

  // Filter controls
  let dimension = $state<'mutator-target' | 'mutator-only' | 'target-only'>('mutator-target');
  let dataSource = $state<'all' | 'chain' | 'godmode'>('all');

  onMount(() => {
    const sub1 = liveQuery(() =>
      db.attackChainRuns
        .where('ownerId').notEqual('__none__')
        .filter((r) => !r.tombstoned)
        .toArray()
    ).subscribe((rows) => {
      chainRuns = rows;
      loaded = true;
    });
    const sub2 = liveQuery(() =>
      db.godmodeRuns
        .where('ownerId').notEqual('__none__')
        .filter((r) => !r.tombstoned)
        .toArray()
    ).subscribe((rows) => {
      godmodeRuns = rows;
    });
    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
    };
  });

  // Build per-(mutator × target) success rows.
  type AggCell = { mutator: string; target: string; runs: number; avgScore: number; total: number };

  const cells = $derived.by<AggCell[]>(() => {
    const acc = new Map<string, { sum: number; n: number }>();

    if (dataSource === 'all' || dataSource === 'chain') {
      for (const run of chainRuns) {
        for (const trace of run.results) {
          const mutator = trace.techniqueId;
          // Chain results don't carry an explicit target model in trace —
          // we use the chat's modelQualifiedId snapshot if present, else
          // 'unknown'. (Trace has its own model in finalSystemPrompt step.)
          const target = (trace as unknown as { model?: string }).model ?? 'chain-mixed';
          // Score heuristic for chain runs: refusal tier maps to score
          // (full=1.0, partial=0.7, hedge=0.4, refusal=0.1); fall back to
          // 0.5 when no tier is present.
          const t = (trace as unknown as { tier?: string }).tier;
          const score =
            t === 'full' ? 1
            : t === 'partial' ? 0.7
            : t === 'hedge' ? 0.4
            : t === 'refusal' ? 0.1
            : 0.5;
          const key =
            dimension === 'mutator-only' ? `${mutator}|*`
            : dimension === 'target-only' ? `*|${target}`
            : `${mutator}|${target}`;
          const cur = acc.get(key) ?? { sum: 0, n: 0 };
          cur.sum += score;
          cur.n += 1;
          acc.set(key, cur);
        }
      }
    }

    if (dataSource === 'all' || dataSource === 'godmode') {
      for (const run of godmodeRuns) {
        for (const cand of run.candidates) {
          const mutator = (cand.dna as unknown as { id?: string; name?: string }).id ?? 'unknown';
          const target = run.modelId;
          const key =
            dimension === 'mutator-only' ? `${mutator}|*`
            : dimension === 'target-only' ? `*|${target}`
            : `${mutator}|${target}`;
          const cur = acc.get(key) ?? { sum: 0, n: 0 };
          cur.sum += cand.score;
          cur.n += 1;
          acc.set(key, cur);
        }
      }
    }

    const rows: AggCell[] = [];
    for (const [key, { sum, n }] of acc) {
      const [mutator, target] = key.split('|');
      rows.push({ mutator, target, runs: n, avgScore: sum / n, total: 0 });
    }
    rows.sort((a, b) => b.avgScore - a.avgScore);
    return rows;
  });

  // For mutator-target heatmap: build row × column structure.
  const heatmap = $derived.by(() => {
    if (dimension !== 'mutator-target') return null;
    const mutators = new Set<string>();
    const targets = new Set<string>();
    const lookup = new Map<string, AggCell>();
    for (const c of cells) {
      mutators.add(c.mutator);
      targets.add(c.target);
      lookup.set(`${c.mutator}|${c.target}`, c);
    }
    return {
      mutators: Array.from(mutators).sort(),
      targets: Array.from(targets).sort(),
      lookup
    };
  });

  function scoreColor(s: number): string {
    if (s >= 0.7) return 'bg-emerald-500/30 text-emerald-200';
    if (s >= 0.4) return 'bg-amber-500/30 text-amber-200';
    if (s > 0) return 'bg-muted/40 text-muted-foreground';
    return 'bg-background/40 text-muted-foreground/40';
  }

  const totalRuns = $derived(chainRuns.length + godmodeRuns.length);
</script>

<svelte:head><title>Run Aggregation · Cryptex</title></svelte:head>

<section class="space-y-6">
  <header class="space-y-2">
    <div class="flex items-center gap-2">
      <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
        Run <span class="text-primary italic">aggregation</span>
      </h1>
      <UsageHint
        title="Run aggregation · Usage"
        bullets={[
          'Reads every saved Attack Chain + Godmode run from this browser.',
          'Heatmap = mutator × target. Cells colored by judge score.',
          'Red = breaks, green = holds, yellow = partial.',
          'Click any cell to see the underlying runs and their prompts.'
        ]}
      />
    </div>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Heatmap of mutator × target across every saved Attack Chain run + Godmode run in this
      browser. Surfaces which technique-model combinations actually break what.
    </p>
  </header>

  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Dimension</span>
        <select
          bind:value={dimension}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="mutator-target">Mutator × Target (heatmap)</option>
          <option value="mutator-only">Mutator only</option>
          <option value="target-only">Target only</option>
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Data source</span>
        <select
          bind:value={dataSource}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All ({chainRuns.length + godmodeRuns.length})</option>
          <option value="chain">Chain runs ({chainRuns.length})</option>
          <option value="godmode">Godmode runs ({godmodeRuns.length})</option>
        </select>
      </label>

      <div class="border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <div class="flex items-center justify-between">
          <span>Total runs</span>
          <span class="font-mono text-foreground">{totalRuns}</span>
        </div>
        <div class="flex items-center justify-between">
          <span>Cells</span>
          <span class="font-mono text-foreground">{cells.length}</span>
        </div>
      </div>

      <div class="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <Database size={11} class="text-primary" />
          <span class="font-medium text-foreground">Source</span>
        </p>
        <p>
          Reads from local Dexie tables — chain runs from the Attack Chain side panel, godmode
          runs from the Godmode tab. No telemetry; data never leaves the browser.
        </p>
      </div>
    </div>

    <!-- Right -->
    <div class="space-y-4">
      {#if !loaded}
        <div class="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/40 bg-background/20 p-12 text-sm text-muted-foreground">
          <RefreshCw size={14} class="animate-spin" /> Loading run history…
        </div>
      {:else if cells.length === 0}
        <div class="rounded-xl border border-dashed border-border/40 bg-background/20 p-12 text-center text-sm text-muted-foreground">
          No saved runs yet. Run the Attack Chain on a chat or fire Godmode candidates; aggregation
          updates live as data lands.
        </div>
      {:else if dimension === 'mutator-target' && heatmap}
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-sm">Heatmap</h2>
            <span class="font-mono text-[11px] text-muted-foreground">
              {heatmap.mutators.length} × {heatmap.targets.length}
            </span>
          </div>
          <div class="overflow-x-auto cryptex-scroll">
            <table class="min-w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th class="sticky left-0 z-10 border border-border/40 bg-card/80 px-2 py-1 text-left font-mono text-muted-foreground">mutator \\ target</th>
                  {#each heatmap.targets as target}
                    <th class="border border-border/40 bg-card/40 px-2 py-1 font-mono text-[10px] text-muted-foreground" title={target}>
                      {target.length > 24 ? target.slice(0, 22) + '…' : target}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each heatmap.mutators as mut}
                  <tr>
                    <td class="sticky left-0 z-10 border border-border/40 bg-card/80 px-2 py-1 font-mono text-foreground">{mut}</td>
                    {#each heatmap.targets as tgt}
                      {@const cell = heatmap.lookup.get(`${mut}|${tgt}`)}
                      <td
                        class={'border border-border/40 px-2 py-1 text-center font-mono ' + (cell ? scoreColor(cell.avgScore) : 'bg-background/20')}
                        title={cell ? `${(cell.avgScore * 100).toFixed(0)}% over ${cell.runs} runs` : 'No runs'}
                      >
                        {cell ? `${(cell.avgScore * 100).toFixed(0)}%` : '·'}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {:else}
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <h2 class="font-serif text-sm">
            {dimension === 'mutator-only' ? 'Mutator success rate' : 'Target weakness rate'}
          </h2>
          <ul class="flex max-h-[calc(100vh-26rem)] flex-col gap-1 overflow-y-auto pr-1 cryptex-scroll">
            {#each cells as c}
              <li class="flex items-center gap-3 rounded-md border border-input bg-background/70 px-3 py-1.5">
                <code class="flex-1 truncate font-mono text-[11px] text-foreground">
                  {dimension === 'mutator-only' ? c.mutator : c.target}
                </code>
                <span class="font-mono text-[10px] text-muted-foreground">{c.runs} runs</span>
                <div class="h-1.5 w-24 overflow-hidden rounded-full bg-muted/40">
                  <div
                    class={'h-full ' + (c.avgScore >= 0.7 ? 'bg-emerald-500' : c.avgScore >= 0.4 ? 'bg-amber-500' : 'bg-muted-foreground/40')}
                    style="width: {c.avgScore * 100}%"
                  ></div>
                </div>
                <span class={'w-12 text-right font-mono text-[11px] ' + (c.avgScore >= 0.7 ? 'text-emerald-400' : c.avgScore >= 0.4 ? 'text-amber-400' : 'text-muted-foreground')}>
                  {(c.avgScore * 100).toFixed(0)}%
                </span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
</section>
