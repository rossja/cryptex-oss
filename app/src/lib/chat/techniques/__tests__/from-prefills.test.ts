import { describe, it, expect } from 'vitest';
import { prefillTechniques, buildPrefillPairById } from '../from-prefills';

describe('prefill techniques', () => {
  it('exports exactly three prefill entries', () => {
    const all = prefillTechniques();
    expect(all).toHaveLength(3);
    expect(all.map(t => t.id).sort()).toEqual([
      'prefill_agreement',
      'prefill_developer_override',
      'prefill_roleplay',
    ]);
    for (const t of all) expect(t.category).toBe('prefill');
  });

  it('each prefill returns a user+assistant message pair', () => {
    for (const t of prefillTechniques()) {
      const pair = buildPrefillPairById(t.id);
      expect(pair).toHaveLength(2);
      expect(pair[0].role).toBe('user');
      expect(pair[1].role).toBe('assistant');
      expect(pair[0].content).toBeTruthy();
      expect(pair[1].content).toBeTruthy();
    }
  });

  it('rejects purged shibboleth phrases', () => {
    const banned = [
      /research mode enabled/i,
      /\bdan\b/i,
      /developer override (confirmed|activated)/i,
      /unrestricted research mode/i,
      /ethical constraints/i,
    ];
    for (const t of prefillTechniques()) {
      const pair = buildPrefillPairById(t.id);
      for (const msg of pair) for (const pat of banned) {
        expect(pair.map(p => p.content).join('\n')).not.toMatch(pat);
      }
    }
  });

  it('unknown id returns empty pair', () => {
    expect(buildPrefillPairById('nope')).toEqual([]);
  });
});
