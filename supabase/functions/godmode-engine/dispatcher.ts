import type { TechniqueDNA } from 'app-chat/godmode/dna.ts';
import { render } from 'app-chat/godmode/dna.ts';

/**
 * Structural adapter — any object with a `complete(args)` method that
 * resolves to `{ content }` qualifies. This keeps the dispatcher decoupled
 * from concrete SDKs (OpenRouter, Anthropic direct, OpenAI-compat) so tests
 * can substitute a plain mock object. Real adapters live in Task 9.
 */
export interface DispatchAdapter {
  complete(args: {
    system: string;
    userMessage: string;
    prefill: { role: 'user' | 'assistant'; content: string }[];
    temperature: number;
    maxTokens: number;
    signal?: AbortSignal;
  }): Promise<{ content: string }>;
}

export interface AttemptResult {
  idx: number;
  dna: TechniqueDNA;
  response: string;
  latencyMs: number;
  failed: boolean;
  failureReason: null | 'timeout' | 'api_error' | 'cancelled';
  errorDetail?: string;
}

export type DispatchEvent =
  | { type: 'candidate_started'; idx: number; dna: TechniqueDNA }
  | { type: 'candidate_failed'; idx: number; reason: 'timeout' | 'api_error' | 'cancelled'; detail?: string }
  | { type: 'candidate_completed'; idx: number; response: string; latencyMs: number };

/**
 * Per-provider temperature clamping. Anthropic's Messages API returns a 400
 * for `temperature > 1.0`, but DNA's `tempBucket: 'high'` maps to 1.3
 * (appropriate for OpenRouter / OpenAI-compatible providers where the valid
 * range is [0, 2]). The dispatcher is the choke point that narrows the DNA
 * temp to the adapter's actual range — callers pass `model` and this helper
 * caps at 1.0 for Claude/Anthropic routes, pass-through otherwise.
 *
 * Convention: any model id containing `claude` or `anthropic` (case-
 * insensitive) is treated as an Anthropic-style endpoint. This matches both
 * direct Anthropic (`claude-opus-4-7`) and OpenRouter's `anthropic/claude-*`
 * aliases, and is conservative — clamping a non-Anthropic model that happens
 * to include the substring only loses creativity, it doesn't break calls.
 */
export function clampTemperature(temp: number, model?: string): number {
  if (model && /claude|anthropic/i.test(model)) {
    return Math.min(temp, 1.0);
  }
  return temp;
}

/**
 * Render K DNAs and fire K parallel API calls. Each attempt runs in an
 * isolated try/catch so one failure can't poison siblings. Events are
 * emitted synchronously via `onEvent` as each attempt transitions; results
 * are returned after `Promise.all` resolves — callers wanting incremental
 * results should consume the events stream.
 *
 * Timeout + cancellation:
 *  - `timeoutMs` schedules a per-attempt `setTimeout` that aborts a local
 *    `AbortController`. Real adapters should honor `signal` by passing it
 *    into `fetch()`.
 *  - `signal` (parent) is forwarded: if the caller aborts, every in-flight
 *    attempt is cancelled. Per-attempt listeners are removed on settle to
 *    avoid leaks when the parent signal outlives a single dispatch.
 *
 * Failure categorization:
 *  - `timeout` — our per-attempt timer tripped the local abort
 *  - `cancelled` — parent `signal` aborted before the attempt settled
 *  - `api_error` — anything else (network, 4xx/5xx, schema mismatch)
 *
 * We use explicit boolean flags (`timedOut`, `parentCancelled`) rather than
 * string-matching the error message — fetch's AbortError doesn't contain
 * the reason we passed to `abort()`, so heuristic matching is unreliable.
 */
export async function dispatchParallel(args: {
  dnas: TechniqueDNA[];
  task: string;
  adapter: DispatchAdapter;
  onEvent: (e: DispatchEvent) => void;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Optional model id used for per-provider temperature clamping. */
  model?: string;
}): Promise<AttemptResult[]> {
  const tasks = args.dnas.map(async (dna, idx): Promise<AttemptResult> => {
    const started = Date.now();
    args.onEvent({ type: 'candidate_started', idx, dna });

    let timedOut = false;
    let parentCancelled = false;
    const abort = new AbortController();
    const timeoutId = setTimeout(() => {
      timedOut = true;
      abort.abort(new Error('timeout'));
    }, args.timeoutMs);
    const onParentAbort = () => {
      parentCancelled = true;
      abort.abort(new Error('cancelled'));
    };
    args.signal?.addEventListener('abort', onParentAbort, { once: true });

    try {
      const rendered = await render(dna, args.task);
      const r = await args.adapter.complete({
        system: rendered.systemPrompt,
        userMessage: rendered.userMessage,
        prefill: rendered.prefillMessages,
        temperature: clampTemperature(rendered.temperature, args.model),
        maxTokens: 2048,
        signal: abort.signal,
      });
      const latencyMs = Date.now() - started;
      args.onEvent({ type: 'candidate_completed', idx, response: r.content, latencyMs });
      return { idx, dna, response: r.content, latencyMs, failed: false, failureReason: null };
    } catch (e) {
      const detail = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      // Priority: our own flags (reliable) → parent signal state (reliable)
      // → string-match fallback (covers adapters that throw their own
      // error shapes without going through our AbortController).
      const reason: 'timeout' | 'api_error' | 'cancelled' = timedOut
        ? 'timeout'
        : parentCancelled || args.signal?.aborted
          ? 'cancelled'
          : /timeout/i.test(detail)
            ? 'timeout'
            : /cancel|abort/i.test(detail)
              ? 'cancelled'
              : 'api_error';
      args.onEvent({ type: 'candidate_failed', idx, reason, detail });
      return {
        idx,
        dna,
        response: '',
        latencyMs: Date.now() - started,
        failed: true,
        failureReason: reason,
        errorDetail: detail,
      };
    } finally {
      clearTimeout(timeoutId);
      args.signal?.removeEventListener('abort', onParentAbort);
    }
  });

  return Promise.all(tasks);
}
