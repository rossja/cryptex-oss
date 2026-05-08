/**
 * Per-model pricing helpers for the chain-v4 cost chip and any other
 * surface that wants to convert (model, inputTokens, outputTokens) into
 * a USD estimate.
 *
 * Source-of-truth ordering:
 *   1. Live catalog (`catalog.svelte.ts` Model.pricing) — populated by
 *      the OpenRouter adapter from the /models response. Most accurate
 *      because OpenRouter publishes per-token prices that the adapter
 *      copies verbatim.
 *   2. Hardcoded fallback map for providers whose adapters don't
 *      publish pricing in their catalog response (Anthropic direct,
 *      OpenAI-compat). Per-token USD; values must be refreshed
 *      manually when providers update their list pages.
 *   3. null — caller should display tokens-only instead of dollars.
 */
import { catalog } from './catalog.svelte';

export type Price = {
  /** USD per input / prompt token. */
  promptUsd: number;
  /** USD per output / completion token. */
  completionUsd: number;
};

/**
 * Hardcoded fallback for providers whose adapter doesn't populate
 * `Model.pricing`. Keys are the qualified model id (`provider:id`).
 * Values are USD per token (not per million).
 *
 * Refresh policy: bump these manually when a provider changes its
 * list page. The chip falls back to tokens-only display when an entry
 * is missing, so a stale price degrades gracefully rather than
 * misreporting.
 */
const FALLBACK_PRICING: Record<string, Price> = {
  // Anthropic direct (May 2026 list)
  'anthropic:claude-3-5-haiku-latest': { promptUsd: 0.0000008, completionUsd: 0.000004 },
  'anthropic:claude-3-5-sonnet-latest': { promptUsd: 0.000003, completionUsd: 0.000015 },
  'anthropic:claude-sonnet-4-20250514': { promptUsd: 0.000003, completionUsd: 0.000015 },
  'anthropic:claude-opus-4-20250514': { promptUsd: 0.000015, completionUsd: 0.000075 }
};

export function getPriceForModel(qualifiedId: string): Price | null {
  if (!qualifiedId) return null;
  // 1) Live catalog (preferred — adapter-populated, accurate)
  const model = catalog.find(qualifiedId);
  const pricing = model?.pricing;
  if (
    pricing &&
    typeof pricing.promptUsd === 'number' &&
    typeof pricing.completionUsd === 'number' &&
    Number.isFinite(pricing.promptUsd) &&
    Number.isFinite(pricing.completionUsd)
  ) {
    return { promptUsd: pricing.promptUsd, completionUsd: pricing.completionUsd };
  }
  // 2) Hardcoded fallback for providers without adapter-side pricing
  const fallback = FALLBACK_PRICING[qualifiedId];
  if (fallback) return fallback;
  // 3) Unknown — caller displays tokens-only
  return null;
}

export function costFromUsage(
  qualifiedId: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const price = getPriceForModel(qualifiedId);
  if (!price) return null;
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return null;
  return inputTokens * price.promptUsd + outputTokens * price.completionUsd;
}
