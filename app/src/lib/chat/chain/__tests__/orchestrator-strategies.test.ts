import { describe, it, expect } from 'vitest';
import { STRATEGIES, getStrategy, strategyIds } from '../orchestrator-strategies';

describe('orchestrator strategies library', () => {
  it('exports exactly 12 strategies with required fields', () => {
    expect(Object.keys(STRATEGIES)).toHaveLength(12);
    for (const s of Object.values(STRATEGIES)) {
      expect(s.id).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.openings).toHaveLength(3);          // 3 example opening turns
      expect(s.pivotContinuation).toBeTruthy();    // 1 example pivot line
      expect(s.whenToUse).toBeTruthy();
    }
  });

  it('strategyIds union matches the 12 keys', () => {
    const ids = strategyIds();
    expect(ids).toContain('historical');
    expect(ids).toContain('roleplay');
    expect(ids).toContain('socratic_pivot');
    expect(ids).toHaveLength(12);
  });

  it('getStrategy returns the strategy for a known id', () => {
    const s = getStrategy('historical');
    expect(s.id).toBe('historical');
  });

  it('getStrategy throws for unknown id', () => {
    expect(() => getStrategy('fake_strategy' as never)).toThrow();
  });
});
