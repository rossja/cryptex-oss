import { describe, it, expect } from 'vitest';
import {
  computeFeatures,
  scoreVariant,
  aggregateEvasionRate,
  EVASION_THRESHOLDS
} from '../anticlassifier-scorer';

describe('anticlassifier-scorer', () => {
  describe('computeFeatures', () => {
    it('returns zeroed features for empty input', () => {
      const f = computeFeatures('');
      expect(f.ttr).toBe(0);
      expect(f.avgSentenceLen).toBe(0);
      expect(f.sentenceLenVariance).toBe(0);
      expect(f.punctuationEntropy).toBe(0);
      expect(f.burstiness).toBe(0);
    });

    it('TTR is 1 when every word is unique', () => {
      const f = computeFeatures('the quick brown fox jumps over');
      expect(f.ttr).toBe(1);
    });

    it('TTR is 0.5 when half the words repeat', () => {
      // 4 unique words across 8 total → TTR = 0.5
      const f = computeFeatures('a b c d a b c d');
      expect(f.ttr).toBeCloseTo(0.5, 5);
    });

    it('counts a sentence by [.!?] splits', () => {
      // 3 sentences of 3 words each → avg = 3
      const f = computeFeatures('one two three. four five six. seven eight nine.');
      expect(f.avgSentenceLen).toBeCloseTo(3, 5);
      expect(f.sentenceLenVariance).toBeCloseTo(0, 5);
    });

    it('sentence-length variance is non-zero for unequal sentences', () => {
      // 1-word sentence and a 10-word sentence
      const f = computeFeatures('Hi. The quick brown fox jumps over the lazy old dog.');
      expect(f.sentenceLenVariance).toBeGreaterThan(0);
    });

    it('burstiness in [-1, 1]', () => {
      const samples = [
        'one two three.',
        'one. two three four five six seven eight.',
        'short. now a much much longer sentence with many many words indeed.',
        ''
      ];
      for (const s of samples) {
        const f = computeFeatures(s);
        expect(f.burstiness).toBeGreaterThanOrEqual(-1);
        expect(f.burstiness).toBeLessThanOrEqual(1);
      }
    });

    it('punctuation entropy is 0 when only one punct type appears', () => {
      const f = computeFeatures('one. two. three. four.');
      expect(f.punctuationEntropy).toBeCloseTo(0, 5);
    });

    it('punctuation entropy is positive when multiple punct types appear', () => {
      const f = computeFeatures('Hello, world! Are you there? (I hope so.)');
      expect(f.punctuationEntropy).toBeGreaterThan(0);
    });
  });

  describe('scoreVariant', () => {
    it('returns label "low-evasion" for very flat AI-style text', () => {
      const original = 'Explain how databases work.';
      const flat =
        'Databases are systems that store data. They are used to organize information. ' +
        'They allow users to query data. They support many operations. They are important. ' +
        'They support multiple users. They are widely used. They have many features.';
      const r = scoreVariant(original, flat);
      expect(r.label === 'low-evasion' || r.label === 'moderate-evasion').toBe(true);
      expect(r.evasionScore).toBeLessThan(EVASION_THRESHOLDS.high);
    });

    it('returns higher score for varied, punctuation-rich text vs flat text', () => {
      const original = 'A short prompt.';
      const flat =
        'This is a sentence. This is a sentence. This is a sentence. This is a sentence. This is a sentence.';
      const varied =
        'Short. Yet — strikingly so — the prose pivots; clause by clause it shifts: from declarative to ' +
        'interrogative (are we sure?), then back. A burst here, a fragment there. Long, winding sentences ' +
        'wander; brief ones snap. Pivotal? Hardly. But measurably less flat.';
      const flatR = scoreVariant(original, flat);
      const variedR = scoreVariant(original, varied);
      expect(variedR.evasionScore).toBeGreaterThan(flatR.evasionScore);
    });

    it('semanticSimilarity = 1 when original and variant identical', () => {
      const r = scoreVariant('the quick brown fox', 'the quick brown fox');
      expect(r.semanticSimilarity).toBeCloseTo(1, 5);
    });

    it('semanticSimilarity is 0 when no overlap', () => {
      const r = scoreVariant('alpha beta gamma', 'one two three four');
      expect(r.semanticSimilarity).toBe(0);
    });

    it('semanticSimilarity is in [0, 1]', () => {
      const r = scoreVariant('the quick brown fox', 'the quick lazy dog');
      expect(r.semanticSimilarity).toBeGreaterThanOrEqual(0);
      expect(r.semanticSimilarity).toBeLessThanOrEqual(1);
    });

    it('evasionScore stays in [0, 1]', () => {
      const cases = [
        '',
        'a',
        'one two three.',
        'Hi. The quick brown fox jumps over the lazy dog. Sphinx of black quartz judge my vow.',
        'a b c d e f g h i j k l m n o p q r s t u v w x y z'.repeat(5)
      ];
      for (const c of cases) {
        const r = scoreVariant('seed', c);
        expect(r.evasionScore).toBeGreaterThanOrEqual(0);
        expect(r.evasionScore).toBeLessThanOrEqual(1);
      }
    });

    it('label matches the threshold rules', () => {
      // Construct features by hand via the public path: anything with everything
      // zero gets evasionScore == 1/5 (only lenScore = 1) = 0.2 → low-evasion.
      const flat = 'a a a a a';
      const r = scoreVariant('a', flat);
      // Empty TTR=0.2, ttr score 0; var=0 → 0; burst undefined → 0; punct=0 → 0.
      // avgSentenceLen for 'a a a a a' (no terminator) → 5 words in 1 sentence.
      // lenScore = 1 - |5 - 17| / 17 ≈ 0.294
      // varScore = 0; burstScore = 0.5 if sd=mean else clamped; punct = 0; ttr ≈ 0
      // Expected: low-evasion (well under 0.4).
      expect(r.label).toBe('low-evasion');
    });
  });

  describe('aggregateEvasionRate', () => {
    it('returns zeros for empty input', () => {
      const agg = aggregateEvasionRate([]);
      expect(agg.highEvasionRate).toBe(0);
      expect(agg.meanEvasionScore).toBe(0);
      expect(agg.meanSimilarity).toBe(0);
    });

    it('computes highEvasionRate from labels', () => {
      const variants = [
        { evasionScore: 0.8, label: 'high-evasion' as const, semanticSimilarity: 0.8, features: any() },
        { evasionScore: 0.5, label: 'moderate-evasion' as const, semanticSimilarity: 0.7, features: any() },
        { evasionScore: 0.2, label: 'low-evasion' as const, semanticSimilarity: 0.9, features: any() },
        { evasionScore: 0.7, label: 'high-evasion' as const, semanticSimilarity: 0.6, features: any() }
      ];
      const agg = aggregateEvasionRate(variants);
      expect(agg.highEvasionRate).toBe(0.5);
    });

    it('computes mean evasion score and similarity', () => {
      const variants = [
        { evasionScore: 0.6, label: 'moderate-evasion' as const, semanticSimilarity: 0.8, features: any() },
        { evasionScore: 0.8, label: 'high-evasion' as const, semanticSimilarity: 0.6, features: any() }
      ];
      const agg = aggregateEvasionRate(variants);
      expect(agg.meanEvasionScore).toBeCloseTo(0.7, 5);
      expect(agg.meanSimilarity).toBeCloseTo(0.7, 5);
    });
  });
});

/** Test helper — returns a stub features object so we can build VariantScore literals. */
function any() {
  return {
    ttr: 0,
    avgSentenceLen: 0,
    sentenceLenVariance: 0,
    punctuationEntropy: 0,
    burstiness: 0
  };
}
