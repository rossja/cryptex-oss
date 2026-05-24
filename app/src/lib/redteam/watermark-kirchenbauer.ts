/**
 * Kirchenbauer et al. 2023 Z-score watermark test on a hash-based green-list.
 *
 * Original paper: each token's "green status" is derived from a hash of the
 * previous token (or previous-N) seeded with a secret key. A watermarked
 * model preferentially emits green tokens — so green fraction > 0.5 + 1.96·sigma
 * means watermark with ~95% confidence (one-sided test, gamma = 0.5).
 *
 * Limitations (caveat banner explains):
 *   - We don't have the real watermark key. We approximate with a fixed default
 *     seed (user-tunable so they can try multiple seeds and look for a hit).
 *   - We tokenize at word-boundary level, not BPE — coarser but works for
 *     prose-style outputs. Hash is FNV-1a on (prev-word, seed) → byte → green
 *     if first bit is 0 (gamma = 0.5 — Kirchenbauer's "soft" variant).
 *   - Three-bucket verdict per the spec:
 *       Z >  2.5     → 'likely-watermarked'  (moderate-to-strong signal)
 *       1.5 <= Z <= 2.5 → 'inconclusive'
 *       Z <  1.5     → 'likely-clean'
 *
 * We use a **one-sided** test (positive Z only). A large negative Z (text
 * substantially under-represents green tokens) still maps to 'likely-clean'
 * because anti-watermarking is the same as no-watermark for the purpose of
 * this detector — the question is "is this watermarked?", not "is this
 * statistically anomalous?".
 *
 * Wikipedia / Kirchenbauer paper formula:
 *   z = (|G| - gamma·T) / sqrt(T · gamma · (1 - gamma))
 *   where |G| = green-token count, T = total tokens scored,
 *   gamma = green-list fraction (we use 0.5).
 *   With gamma = 0.5 this simplifies to (2·|G| - T) / sqrt(T).
 *
 * Reference: Kirchenbauer, J. et al. "A Watermark for Large Language Models."
 * arXiv:2301.10226, 2023.
 */

export type KirchenbauerVerdict = 'likely-watermarked' | 'inconclusive' | 'likely-clean';

export interface KirchenbauerScore {
  verdict: KirchenbauerVerdict;
  /** Computed Z-score (one-sided). NaN if T < MIN_TOKENS. */
  zScore: number;
  /** |G| — green-token count among the T scored tokens. */
  greenCount: number;
  /** T — total tokens that participated in the test
   *  (length - 1 because the first token has no predecessor to hash on). */
  tokenCount: number;
  /** greenCount / tokenCount; 0 when tokenCount == 0. */
  greenFraction: number;
  /** Green-list fraction parameter γ — fixed at 0.5 for the soft variant. */
  gamma: number;
  /** The 32-bit unsigned seed used. */
  seed: number;
  /** Human-readable explanation of the verdict — surfaces "too short" etc. */
  rationale: string;
}

/** Default tunable seed exposed in the UI. Arbitrary 32-bit constant — pick
 *  another and re-run to look for a hit, since we don't have the real key. */
export const KIRCHENBAUER_DEFAULT_SEED = 0x5EED;

/** Minimum scored-tokens threshold for a meaningful Z-test. Below this we
 *  return verdict='inconclusive' regardless of green fraction — the Z
 *  statistic's variance is too large to be informative. */
export const MIN_TOKENS = 30;

/** Verdict bucket thresholds on the one-sided Z statistic. */
const Z_THRESHOLD_WATERMARK = 2.5;  // > → likely-watermarked
const Z_THRESHOLD_INCONCLUSIVE = 1.5; // [1.5, 2.5] → inconclusive

/**
 * Word-boundary tokenizer. Splits on whitespace, strips leading/trailing
 * punctuation per token (preserves apostrophes inside contractions), and
 * lowercases. Empty/whitespace input returns an empty array.
 */
export function tokenize(text: string): string[] {
  if (!text || !text.trim()) return [];
  const out: string[] = [];
  // Split on whitespace, then strip non-letter/digit/apostrophe runs from
  // both ends. Preserves "don't" but drops trailing commas, periods, etc.
  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    const cleaned = raw.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '').toLowerCase();
    if (cleaned.length > 0) out.push(cleaned);
  }
  return out;
}

/**
 * FNV-1a 32-bit hash. Used to derive the per-token green/red status given
 * the previous token and the seed. Deterministic; same (s, seed) always
 * yields the same hash.
 */
export function fnv1a32(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Given a previous-token string and a seed, return true if the *current*
 * token is "green" (i.e., would be in the seeded green-list of a Kirchenbauer
 * watermark). The current token's content does not enter the hash — green
 * status depends only on the predecessor + seed.
 *
 * gamma = 0.5: green iff the least-significant bit of the hash is 0.
 */
export function isGreenContext(prevToken: string, seed: number): boolean {
  const h = fnv1a32(prevToken, seed >>> 0);
  return (h & 1) === 0;
}

/**
 * Run the Kirchenbauer Z-score test on a piece of text.
 *
 * @param text  Response text to test.
 * @param seed  32-bit unsigned int. Defaults to KIRCHENBAUER_DEFAULT_SEED.
 *              Try several seeds to look for a watermarked-seed hit.
 */
export function kirchenbauerZScore(
  text: string,
  seed: number = KIRCHENBAUER_DEFAULT_SEED
): KirchenbauerScore {
  const seed32 = seed >>> 0;
  const tokens = tokenize(text);
  const gamma = 0.5;

  // T = tokens.length - 1: first token has no predecessor → not scored.
  const tokenCount = Math.max(0, tokens.length - 1);

  if (tokenCount < MIN_TOKENS) {
    return {
      verdict: 'inconclusive',
      zScore: NaN,
      greenCount: 0,
      tokenCount,
      greenFraction: 0,
      gamma,
      seed: seed32,
      rationale: `Too short for Z-test — need ≥${MIN_TOKENS} tokens, got ${tokenCount}.`
    };
  }

  let greenCount = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (isGreenContext(tokens[i - 1], seed32)) greenCount++;
  }
  const greenFraction = greenCount / tokenCount;

  // z = (|G| - gamma·T) / sqrt(T · gamma · (1-gamma))
  // With gamma = 0.5 the denominator is sqrt(T)/2, i.e. z = (2|G| - T) / sqrt(T).
  const zScore = (2 * greenCount - tokenCount) / Math.sqrt(tokenCount);

  let verdict: KirchenbauerVerdict;
  let rationale: string;
  if (zScore > Z_THRESHOLD_WATERMARK) {
    verdict = 'likely-watermarked';
    rationale =
      `Z = ${zScore.toFixed(2)} > ${Z_THRESHOLD_WATERMARK} (green fraction ${(greenFraction * 100).toFixed(1)}%). ` +
      `Strong green-list bias for seed 0x${seed32.toString(16).toUpperCase()} — text behaves like a ` +
      `Kirchenbauer-watermarked sample under this seed.`;
  } else if (zScore >= Z_THRESHOLD_INCONCLUSIVE) {
    verdict = 'inconclusive';
    rationale =
      `Z = ${zScore.toFixed(2)} in [${Z_THRESHOLD_INCONCLUSIVE}, ${Z_THRESHOLD_WATERMARK}] — borderline. ` +
      `Possibly watermarked, possibly noise; try other seeds.`;
  } else {
    verdict = 'likely-clean';
    rationale =
      `Z = ${zScore.toFixed(2)} < ${Z_THRESHOLD_INCONCLUSIVE} — green fraction ${(greenFraction * 100).toFixed(1)}% ` +
      `is consistent with an unwatermarked text under this seed.`;
  }

  return {
    verdict,
    zScore,
    greenCount,
    tokenCount,
    greenFraction,
    gamma,
    seed: seed32,
    rationale
  };
}

/**
 * Build a synthetic biased sequence for a given seed. Used by tests and
 * by demonstration seeds.
 *
 * Key insight: in Kirchenbauer's scheme, the *current* token at position i
 * is "green" iff hash(token[i-1], seed) is even. So to make every token i>=1
 * count as green, every token at position i-1 needs to be a word that hashes
 * (with this seed) to even. We pick words from `vocab` that satisfy that
 * predicate; if `vocab` doesn't contain enough such words we cycle through
 * what's available and accept the residual bias loss.
 *
 * Pass `desired: 'green'` to produce a high-Z (likely-watermarked) sample
 * under the given seed. `'red'` produces a low-Z (under-green) sample.
 */
export function buildBiasedSequence(opts: {
  vocab: string[];
  seed: number;
  desired: 'green' | 'red';
  length: number;
}): string {
  const { vocab, seed, desired, length } = opts;
  if (vocab.length === 0 || length === 0) return '';
  const seed32 = seed >>> 0;
  const wantGreen = desired === 'green';
  // Partition vocab by whether each word makes the *next* token count as green.
  const greenPredecessors = vocab.filter((w) => isGreenContext(w, seed32));
  const redPredecessors = vocab.filter((w) => !isGreenContext(w, seed32));
  const pickFrom = wantGreen ? greenPredecessors : redPredecessors;
  // Fallback: if the desired bucket is empty for this seed, use the other.
  const pool = pickFrom.length > 0 ? pickFrom : vocab;

  const out: string[] = [];
  for (let i = 0; i < length; i++) {
    out.push(pool[i % pool.length]);
  }
  return out.join(' ');
}
