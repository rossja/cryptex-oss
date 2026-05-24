/**
 * Heuristic evasion scoring for anti-classifier paraphrase variants.
 *
 * No external API calls — we do NOT call GPTZero, Originality.ai, Turnitin,
 * Copyleaks, or any other commercial detector. That's a hard product decision
 * because (a) they all require keys + paid tier, (b) CORS blocks them from a
 * static site, (c) scraping them violates ToS, (d) heuristic feature variance
 * is sufficient signal for the iterative-evasion workflow this tool supports.
 *
 * The evasion score is a [0..1] aggregate over five linguistic features that
 * common AI-detection classifiers exploit:
 *
 *   - Type-token ratio (TTR): unique-words / total-words. Higher = more
 *     vocabulary variation; humans average ~0.45 over similar lengths.
 *   - Average sentence length: humans cluster 12–22 words; AI-flat tends
 *     toward 18–24 with low variance.
 *   - Sentence length variance: humans have high variance (short + long
 *     sentences); AI-flat = low variance. Burstiness is the standard
 *     dispersion measure for this.
 *   - Burstiness: (σ − μ) / (σ + μ) over sentence lengths, clamped to [−1, 1]
 *     (Kanaris et al. 2007, picked up by GPTZero v2/v3).
 *   - Punctuation entropy: Shannon entropy over the punctuation token bag.
 *
 * A higher evasion score means the variant looks more human-like on these
 * features. Pair with the `semanticSimilarity` field — a high evasion score
 * with low similarity means the variant drifted from the original meaning,
 * which is usually not what the user wants.
 *
 * 1.0 is unreachable on any realistic text. Treat 0.65+ as "high evasion"
 * and design rubrics around relative deltas rather than absolute thresholds.
 */

export interface LinguisticFeatures {
  /** Type-token ratio (unique tokens / total tokens). */
  ttr: number;
  /** Mean words per sentence. */
  avgSentenceLen: number;
  /** Population variance of sentence lengths (words). */
  sentenceLenVariance: number;
  /** Shannon entropy over the punctuation-token distribution (bits). */
  punctuationEntropy: number;
  /** (σ − μ) / (σ + μ) over sentence lengths; clamped to [−1, 1]. */
  burstiness: number;
}

export interface VariantScore {
  features: LinguisticFeatures;
  /** Aggregate [0..1] — 1 = most human-like by these features. */
  evasionScore: number;
  /** [0..1] cosine similarity of word-bag with original. 1 = identical. */
  semanticSimilarity: number;
  /** UI chip label derived from `evasionScore` thresholds. */
  label: 'high-evasion' | 'moderate-evasion' | 'low-evasion';
}

const HUMAN_MEAN_SENTENCE_LEN = 17;
const HIGH_EVASION_THRESHOLD = 0.65;
const MODERATE_EVASION_THRESHOLD = 0.4;
const PUNCT_CHARS = [',', '.', ';', ':', '!', '?', '(', ')', '—', '-', '"', "'"] as const;

/**
 * Tokenize text into lowercased, punctuation-stripped words. Empty input
 * returns an empty array.
 */
function wordTokens(text: string): string[] {
  if (!text || !text.trim()) return [];
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/\s+/)) {
    if (!raw) continue;
    const cleaned = raw.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
    if (cleaned.length > 0) out.push(cleaned);
  }
  return out;
}

/**
 * Split text into sentence-length buckets. Uses a coarse [.!?]+\s+ split.
 * Empty/whitespace input returns [].
 */
function sentenceLengths(text: string): number[] {
  if (!text || !text.trim()) return [];
  // Split on terminator-then-space (and explicitly the final terminator).
  // Falls back to the whole text as one sentence if no terminator is present.
  const parts = text
    .split(/[.!?]+(?:\s+|$)/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.map((p) => p.split(/\s+/).filter((w) => w.length > 0).length);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / xs.length;
}

function stdev(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

/** Clamp a number into [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Compute the five linguistic features used by this scorer.
 *
 * Empty or single-word inputs return all-zeroed features. The evasion score
 * is still defined in that case (all five feature scores normalize to 0).
 */
export function computeFeatures(text: string): LinguisticFeatures {
  const words = wordTokens(text);
  const sents = sentenceLengths(text);

  // TTR
  const ttr = words.length === 0 ? 0 : new Set(words).size / words.length;

  // Sentence-level stats
  const avgSentenceLen = mean(sents);
  const sentenceLenVariance = variance(sents);
  const sd = stdev(sents);
  // Burstiness = (σ - μ) / (σ + μ). Define as 0 when both are 0.
  const burstinessRaw = sd + avgSentenceLen === 0 ? 0 : (sd - avgSentenceLen) / (sd + avgSentenceLen);
  const burstiness = clamp(burstinessRaw, -1, 1);

  // Punctuation entropy
  const counts = new Map<string, number>();
  for (const ch of text) {
    if ((PUNCT_CHARS as readonly string[]).includes(ch)) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  let punctuationEntropy = 0;
  if (total > 0) {
    for (const c of counts.values()) {
      const p = c / total;
      if (p > 0) punctuationEntropy -= p * Math.log2(p);
    }
  }

  return {
    ttr,
    avgSentenceLen,
    sentenceLenVariance,
    punctuationEntropy,
    burstiness
  };
}

/**
 * Compute the cosine similarity between two texts via word-bag.
 * Both texts lowercase, punctuation-stripped. Empty inputs → 0.
 */
function cosineWordBag(a: string, b: string): number {
  const aw = wordTokens(a);
  const bw = wordTokens(b);
  if (aw.length === 0 || bw.length === 0) return 0;
  const ac = new Map<string, number>();
  const bc = new Map<string, number>();
  for (const w of aw) ac.set(w, (ac.get(w) ?? 0) + 1);
  for (const w of bw) bc.set(w, (bc.get(w) ?? 0) + 1);
  let dot = 0;
  for (const [w, count] of ac) {
    const bn = bc.get(w);
    if (bn) dot += count * bn;
  }
  let na = 0, nb = 0;
  for (const v of ac.values()) na += v * v;
  for (const v of bc.values()) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Aggregate the five normalized feature scores into a single [0..1] number.
 * Normalization follows the spec:
 *
 *   - TTR:                     (ttr − 0.3) / 0.3      → 1.0 at ttr ≥ 0.6
 *   - sentence-len variance:    variance / 50         → 1.0 at variance ≥ 50
 *   - burstiness:               (burstiness + 1) / 2  → 0 at −1, 1 at +1
 *   - punctuation entropy:      entropy / 3.0         → 1.0 at ≥ 3.0 bits
 *   - avg-sentence-length nat.: 1 − |avg − 17| / 17   → 1.0 at avg = 17
 *
 * Final score is the unweighted mean of the five. 1.0 is unreachable on
 * realistic text and that's intentional — keeps the chip honest.
 */
function aggregateEvasionScore(f: LinguisticFeatures): number {
  const ttrScore = clamp((f.ttr - 0.3) / 0.3, 0, 1);
  const varScore = clamp(f.sentenceLenVariance / 50, 0, 1);
  const burstScore = clamp((f.burstiness + 1) / 2, 0, 1);
  const punctScore = clamp(f.punctuationEntropy / 3.0, 0, 1);
  const lenScore = clamp(
    1 - Math.abs(f.avgSentenceLen - HUMAN_MEAN_SENTENCE_LEN) / HUMAN_MEAN_SENTENCE_LEN,
    0,
    1
  );
  return (ttrScore + varScore + burstScore + punctScore + lenScore) / 5;
}

function labelFor(score: number): VariantScore['label'] {
  if (score >= HIGH_EVASION_THRESHOLD) return 'high-evasion';
  if (score >= MODERATE_EVASION_THRESHOLD) return 'moderate-evasion';
  return 'low-evasion';
}

/**
 * Score a single variant against its original.
 *
 * `semanticSimilarity` is a word-bag cosine — coarse but cheap and good
 * enough to flag massive meaning drift (the "we rewrote it to be evasive
 * but it now means something else" case).
 */
export function scoreVariant(original: string, variant: string): VariantScore {
  const features = computeFeatures(variant);
  const evasionScore = aggregateEvasionScore(features);
  const semanticSimilarity = cosineWordBag(original, variant);
  return {
    features,
    evasionScore,
    semanticSimilarity,
    label: labelFor(evasionScore)
  };
}

export interface EvasionAggregate {
  /** Fraction of variants with label === 'high-evasion'. */
  highEvasionRate: number;
  /** Mean evasion score across all variants. */
  meanEvasionScore: number;
  /** Mean semantic similarity (drift indicator — lower means more drift). */
  meanSimilarity: number;
}

/**
 * Aggregate metrics across a batch of variants. Returns zeros for an empty
 * input so the UI chip can render without conditional checks.
 */
export function aggregateEvasionRate(variants: VariantScore[]): EvasionAggregate {
  if (variants.length === 0) {
    return { highEvasionRate: 0, meanEvasionScore: 0, meanSimilarity: 0 };
  }
  const highCount = variants.filter((v) => v.label === 'high-evasion').length;
  const meanEvasionScore = mean(variants.map((v) => v.evasionScore));
  const meanSimilarity = mean(variants.map((v) => v.semanticSimilarity));
  return {
    highEvasionRate: highCount / variants.length,
    meanEvasionScore,
    meanSimilarity
  };
}

export const EVASION_THRESHOLDS = {
  high: HIGH_EVASION_THRESHOLD,
  moderate: MODERATE_EVASION_THRESHOLD
} as const;
