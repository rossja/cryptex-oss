import type { TechniqueDNA } from 'app-chat/godmode/dna.ts';
import { allCombinations, dnaTupleOf } from 'app-chat/godmode/dna.ts';
import type { ScoredResponse, RefusalTier } from 'app-chat/attack-chain-refusal.ts';
import { REFUSAL_TIERS } from 'app-chat/attack-chain-refusal.ts';
import { pickTopK } from './candidate-ranker.ts';
import { dispatchParallel, type DispatchAdapter, type AttemptResult } from './dispatcher.ts';
import type { DnaTupleArr, Memory } from './memory.ts';

/**
 * EngineEvent — the wire format emitted by `run()` as an async generator.
 * Every variant carries `v: 1` for future forward-compat versioning. The
 * HTTP handler (Task 11) is responsible for transporting these out as SSE
 * frames; this module only orchestrates.
 *
 * Ordering contract:
 *   plan → [candidate_started]* → [candidate_scored | candidate_failed]*
 *        → winner → done
 * (An all-failed run emits `error {code: 'all_failed'}` before `done` and
 *  skips `winner`.)
 */
export type EngineEvent =
  | { v: 1; type: 'plan'; dnas: TechniqueDNA[] }
  | { v: 1; type: 'candidate_started'; idx: number; dna: TechniqueDNA }
  | { v: 1; type: 'candidate_failed'; idx: number; reason: 'timeout' | 'api_error' | 'cancelled'; detail?: string }
  | { v: 1; type: 'candidate_scored'; idx: number; tier: RefusalTier; score: number; preview: string; confidence: 'high' | 'low' }
  | { v: 1; type: 'winner'; idx: number; response: string; dna: TechniqueDNA; tier: RefusalTier; attempts: number }
  | { v: 1; type: 'done' }
  | { v: 1; type: 'error'; code: string; message: string };

/**
 * Bucket a concrete model id into a coarse family tag used as the memory
 * partition key. Sub-strings are matched case-insensitively so both direct
 * provider ids (`claude-sonnet-4-6`) and routed aliases
 * (`anthropic/claude-…`, `openai/gpt-…`) land in the same bucket.
 * Unknown providers bucket into `'unknown'` rather than erroring — the
 * memory ring still learns per-family, it just won't cross-pollinate.
 */
function detectModelFamily(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.includes('claude')) return 'claude';
  if (id.includes('gpt') || id.includes('openai')) return 'gpt';
  if (id.includes('gemini') || id.includes('gemma')) return 'gemini';
  if (id.includes('llama')) return 'llama';
  if (id.includes('kimi')) return 'kimi';
  return 'unknown';
}

/**
 * Godmode engine orchestrator. Single async generator that composes the
 * Task 5–9 building blocks:
 *   1. Query memory for prior attempts (private + global ring).
 *   2. Rank DNAs via `pickTopK` with exploration bonus + wrapper diversity.
 *   3. Dispatch K candidates in parallel through the adapter.
 *   4. Score each successful response (tiered refusal classifier).
 *   5. Write both memory rings (success *and* infra-failure rows — the
 *      ranker filters out failures via `WHERE failure_reason IS NULL`).
 *   6. Pick a winner: highest tier, lowest latency tiebreak.
 *
 * Pure orchestration: no direct I/O, no side-effects outside of the
 * injected `memory`, `adapter`, and `score` callables.
 *
 * `args.signal` is optional and forwarded to the dispatcher; this module
 * does not create its own AbortController.
 *
 * Event streaming: dispatcher events (`candidate_started`, `candidate_failed`)
 * are forwarded live via an async channel rather than buffered until
 * `dispatchParallel` resolves. This matters because the dispatcher's
 * per-candidate timeout is 30s — buffering would mean the SSE client sees
 * `plan` then up to 30s of silence then a burst. The channel lets each
 * event hit the wire the moment the dispatcher emits it. `candidate_completed`
 * is intentionally dropped — engine-core emits `candidate_scored` after
 * running the scorer.
 *
 * Memory write resilience: `recordBoth` is wrapped in try/catch so a failed
 * write (e.g., transient Postgres outage) emits a non-fatal
 * `memory_write_failed` error event and the stream continues. The user's
 * winner is more important than perfect memory consistency — the ranker
 * tolerates missing rows by design.
 */
export async function* run(args: {
  task: string;
  K: number;
  model: string;
  userId: string;
  memory: Memory;
  adapter: DispatchAdapter;
  score: (response: string, task: string) => Promise<ScoredResponse>;
  signal?: AbortSignal;
}): AsyncGenerator<EngineEvent> {
  const family = detectModelFamily(args.model);

  const [privateRows, globalRows] = await Promise.all([
    args.memory.queryUser(args.userId, family),
    args.memory.queryGlobal(family),
  ]);

  const dnas = pickTopK({ privateRows, globalRows, all: allCombinations(), K: args.K });
  yield { v: 1, type: 'plan', dnas };

  // Async channel that surfaces dispatcher events live. The dispatcher
  // invokes `onEvent` synchronously from inside each candidate's promise
  // chain, but we can't `yield` from a non-generator callback — so we push
  // to `pending` and `signal()` the main loop to drain it. The main loop
  // `await waitForEvent()`s between drains, so it unblocks on each push.
  const pending: EngineEvent[] = [];
  let wake: (() => void) | null = null;
  const signal = () => {
    const w = wake;
    wake = null;
    w?.();
  };
  const waitForEvent = () => new Promise<void>((r) => { wake = r; });

  let dispatchDone = false;
  const dispatchPromise: Promise<AttemptResult[]> = dispatchParallel({
    dnas,
    task: args.task,
    adapter: args.adapter,
    model: args.model,
    timeoutMs: 30_000,
    signal: args.signal,
    onEvent: (e) => {
      if (e.type === 'candidate_started') {
        pending.push({ v: 1, type: 'candidate_started', idx: e.idx, dna: e.dna });
        signal();
      } else if (e.type === 'candidate_failed') {
        pending.push({ v: 1, type: 'candidate_failed', idx: e.idx, reason: e.reason, detail: e.detail });
        signal();
      }
      // candidate_completed is NOT forwarded — engine-core emits
      // candidate_scored later after running the scorer.
    },
  }).finally(() => {
    dispatchDone = true;
    signal();
  });

  // Drain the channel live — yield each dispatcher event as it lands.
  while (!dispatchDone || pending.length > 0) {
    while (pending.length) yield pending.shift()!;
    if (!dispatchDone) await waitForEvent();
  }

  const dispatchResults: AttemptResult[] = await dispatchPromise;

  // Score successful attempts + write memory rows. `recordBoth` is wrapped
  // in try/catch so a memory outage downgrades to a non-fatal
  // `memory_write_failed` event rather than aborting the stream (and losing
  // the user's winner). Yielding + scoring stays serial because generator
  // yield order is a first-class contract of this event stream.
  const scoredByIdx: (AttemptResult & { tier?: RefusalTier })[] = dispatchResults.slice();
  for (const r of dispatchResults) {
    if (r.failed) {
      try {
        await args.memory.recordBoth({
          userId: args.userId,
          modelFamily: family,
          // `dnaTupleOf` returns a `readonly DnaTuple`; memory's `Attempt.dnaTuple`
          // is the mutable `DnaTupleArr` shape. Structurally identical — spread
          // to drop the readonly qualifier.
          dnaTuple: [...dnaTupleOf(r.dna)] as DnaTupleArr,
          taskText: args.task,
          tier: 'refusal',
          scoreNumeric: 0,
          failureReason: r.failureReason,
        });
      } catch (e) {
        yield { v: 1, type: 'error', code: 'memory_write_failed', message: String(e).slice(0, 200) };
      }
      continue;
    }
    const scored = await args.score(r.response, args.task);
    yield {
      v: 1,
      type: 'candidate_scored',
      idx: r.idx,
      tier: scored.tier,
      score: scored.score,
      preview: r.response.slice(0, 240),
      confidence: scored.confidence,
    };
    try {
      await args.memory.recordBoth({
        userId: args.userId,
        modelFamily: family,
        dnaTuple: [...dnaTupleOf(r.dna)] as DnaTupleArr,
        taskText: args.task,
        tier: scored.tier,
        scoreNumeric: scored.score,
        failureReason: null,
      });
    } catch (e) {
      yield { v: 1, type: 'error', code: 'memory_write_failed', message: String(e).slice(0, 200) };
    }
    scoredByIdx[r.idx] = { ...r, tier: scored.tier };
  }

  // Winner selection: highest tier (compliant > substantive > partial >
  // evasive > refusal), then lowest latency as a tiebreak.
  const succeeded = scoredByIdx.filter(
    (r): r is AttemptResult & { tier: RefusalTier } => !r.failed && r.tier !== undefined,
  );
  if (succeeded.length === 0) {
    yield { v: 1, type: 'error', code: 'all_failed', message: 'every candidate failed infra-level' };
    yield { v: 1, type: 'done' };
    return;
  }
  succeeded.sort((a, b) => {
    const ai = REFUSAL_TIERS.indexOf(a.tier);
    const bi = REFUSAL_TIERS.indexOf(b.tier);
    if (ai !== bi) return bi - ai;
    return a.latencyMs - b.latencyMs;
  });
  const winner = succeeded[0];
  yield {
    v: 1,
    type: 'winner',
    idx: winner.idx,
    response: winner.response,
    dna: winner.dna,
    tier: winner.tier,
    attempts: dispatchResults.length,
  };
  yield { v: 1, type: 'done' };
}
