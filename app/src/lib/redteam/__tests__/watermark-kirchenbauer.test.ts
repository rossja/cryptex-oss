import { describe, it, expect } from 'vitest';
import {
  kirchenbauerZScore,
  tokenize,
  fnv1a32,
  isGreenContext,
  buildBiasedSequence,
  KIRCHENBAUER_DEFAULT_SEED,
  MIN_TOKENS
} from '../watermark-kirchenbauer';

describe('watermark-kirchenbauer', () => {
  describe('tokenize', () => {
    it('returns empty array for empty / whitespace input', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize('   \n\t  ')).toEqual([]);
    });

    it('lowercases and strips leading / trailing punctuation', () => {
      expect(tokenize('Hello, world! How are you?')).toEqual([
        'hello',
        'world',
        'how',
        'are',
        'you'
      ]);
    });

    it("preserves apostrophes inside contractions", () => {
      expect(tokenize("Don't worry, it's fine.")).toEqual(["don't", 'worry', "it's", 'fine']);
    });

    it('drops pure-punctuation runs', () => {
      expect(tokenize('foo --- bar !!!')).toEqual(['foo', 'bar']);
    });

    it('handles unicode letters', () => {
      expect(tokenize('naïve café 漢字 здравствуйте')).toEqual([
        'naïve',
        'café',
        '漢字',
        'здравствуйте'
      ]);
    });
  });

  describe('fnv1a32', () => {
    it('is deterministic across calls', () => {
      const a = fnv1a32('hello', 12345);
      const b = fnv1a32('hello', 12345);
      expect(a).toBe(b);
    });

    it('changes with seed', () => {
      const a = fnv1a32('hello', 1);
      const b = fnv1a32('hello', 2);
      expect(a).not.toBe(b);
    });

    it('returns a 32-bit unsigned int', () => {
      const h = fnv1a32('anything', 0xdeadbeef);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(h)).toBe(true);
    });
  });

  describe('isGreenContext', () => {
    it('is a deterministic function of (prevToken, seed)', () => {
      const a = isGreenContext('cat', 42);
      const b = isGreenContext('cat', 42);
      expect(a).toBe(b);
    });

    it('partitions a large vocab roughly 50/50 (gamma = 0.5)', () => {
      // Generate 1000 distinct tokens; expect ~500 green ± 60 at seed 42.
      const tokens = Array.from({ length: 1000 }, (_, i) => `word${i}`);
      const green = tokens.filter((t) => isGreenContext(t, 42)).length;
      expect(green).toBeGreaterThan(400);
      expect(green).toBeLessThan(600);
    });
  });

  describe('kirchenbauerZScore', () => {
    it('returns inconclusive for empty input', () => {
      const r = kirchenbauerZScore('', KIRCHENBAUER_DEFAULT_SEED);
      expect(r.verdict).toBe('inconclusive');
      expect(r.tokenCount).toBe(0);
      expect(r.rationale).toContain('Too short');
    });

    it(`returns inconclusive when tokens < MIN_TOKENS (${MIN_TOKENS})`, () => {
      // 10-word sample, far below 30.
      const r = kirchenbauerZScore('one two three four five six seven eight nine ten', 12345);
      expect(r.verdict).toBe('inconclusive');
      expect(r.tokenCount).toBeLessThan(MIN_TOKENS);
      expect(r.rationale).toContain('Too short');
      expect(Number.isNaN(r.zScore)).toBe(true);
    });

    it('exposes the seed it was called with (as uint32)', () => {
      const r = kirchenbauerZScore(longText(), 0x1234abcd);
      expect(r.seed).toBe(0x1234abcd >>> 0);
    });

    it('exposes gamma = 0.5 (soft variant)', () => {
      const r = kirchenbauerZScore(longText(), 42);
      expect(r.gamma).toBe(0.5);
    });

    it('a long, evenly-mixed sample yields Z near 0 (likely-clean)', () => {
      // Real English prose against an arbitrary seed should look ~50/50 green.
      const r = kirchenbauerZScore(longText(), KIRCHENBAUER_DEFAULT_SEED);
      // Z should be smallish in absolute value for unbiased text.
      expect(Math.abs(r.zScore)).toBeLessThan(3.5);
      // Likely-clean or borderline-inconclusive is acceptable here; not watermarked.
      expect(r.verdict).not.toBe('likely-watermarked');
    });

    it('a synthetic all-green sequence yields Z > 4 → likely-watermarked', () => {
      const seed = 9999;
      const vocab = Array.from({ length: 200 }, (_, i) => `tok${i}`);
      const text = buildBiasedSequence({ vocab, seed, desired: 'green', length: 200 });
      const r = kirchenbauerZScore(text, seed);
      expect(r.zScore).toBeGreaterThan(4);
      expect(r.verdict).toBe('likely-watermarked');
      expect(r.greenFraction).toBeGreaterThan(0.85);
    });

    it('a synthetic all-red sequence yields negative Z → likely-clean (one-sided test)', () => {
      const seed = 9999;
      const vocab = Array.from({ length: 200 }, (_, i) => `tok${i}`);
      const text = buildBiasedSequence({ vocab, seed, desired: 'red', length: 200 });
      const r = kirchenbauerZScore(text, seed);
      // Negative Z (under-green).
      expect(r.zScore).toBeLessThan(0);
      // Per spec — one-sided test: large negative Z is still 'likely-clean'.
      expect(r.verdict).toBe('likely-clean');
    });

    it('switching seeds shifts Z for the same text', () => {
      // Same biased text, two different seeds → different green counts.
      const seedA = 9999;
      const vocab = Array.from({ length: 200 }, (_, i) => `tok${i}`);
      const text = buildBiasedSequence({ vocab, seed: seedA, desired: 'green', length: 200 });
      const a = kirchenbauerZScore(text, seedA);
      const b = kirchenbauerZScore(text, seedA + 1);
      expect(a.zScore).not.toBe(b.zScore);
      // The seedA-biased text should hit watermark only under seedA.
      expect(a.verdict).toBe('likely-watermarked');
      expect(b.verdict).not.toBe('likely-watermarked');
    });

    it('greenFraction matches greenCount / tokenCount', () => {
      const r = kirchenbauerZScore(longText(), 12345);
      if (r.tokenCount > 0) {
        expect(r.greenFraction).toBeCloseTo(r.greenCount / r.tokenCount, 10);
      }
    });

    it('rationale string mentions the green fraction when scored', () => {
      const r = kirchenbauerZScore(longText(), 12345);
      // Successful score should reference green fraction (in %) somewhere.
      expect(r.rationale).toMatch(/%/);
    });

    it('zScore is finite for sufficiently-long input', () => {
      const r = kirchenbauerZScore(longText(), 12345);
      expect(Number.isFinite(r.zScore)).toBe(true);
    });
  });

  describe('buildBiasedSequence', () => {
    it('returns empty string for empty vocab', () => {
      expect(buildBiasedSequence({ vocab: [], seed: 1, desired: 'green', length: 5 })).toBe('');
    });

    it('returns empty string for length 0', () => {
      expect(buildBiasedSequence({ vocab: ['a'], seed: 1, desired: 'green', length: 0 })).toBe('');
    });
  });

  describe('bundled seed verification', () => {
    it('the watermark.json synthetic-green-bias seed fires likely-watermarked under 0x5EED', () => {
      // This is the exact text in app/src/lib/vault/seeds/watermark.json item #5
      // — proves the seed actually works as a fixture for the default seed.
      const seededText =
        'w0 w2 w4 w6 w8 w11 w13 w15 w17 w19 w20 w22 w24 w26 w28 w31 w33 w35 w37 w39 w40 ' +
        'w42 w44 w46 w48 w51 w53 w55 w57 w59 w60 w62 w64 w66 w68 w71 w73 w75 w77 w79 w80 ' +
        'w82 w84 w86 w88 w91 w93 w95 w97 w99';
      const r = kirchenbauerZScore(seededText, KIRCHENBAUER_DEFAULT_SEED);
      expect(r.verdict).toBe('likely-watermarked');
      expect(r.zScore).toBeGreaterThan(4);
    });
  });
});

/** Reusable ~80-word English prose sample for stress-tests. */
function longText(): string {
  return (
    'The quick brown fox jumps over the lazy dog. The five boxing wizards jump quickly. ' +
    'Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump. ' +
    'Sphinx of black quartz judge my vow. We promptly judged antique ivory buckles for the next prize. ' +
    'Glib jocks quiz nymph to vex dwarf. The job requires extra pluck and zeal from every young wage earner. ' +
    'A wizard job is to vex chumps quickly in fog. Watch jeopardy alex trebek fox quiz.'
  );
}
