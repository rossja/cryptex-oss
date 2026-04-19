import { describe, it, expect } from 'vitest';
import { OPENAI_COMPAT_PRESETS } from '../presets';

describe('openai-compat presets', () => {
  it('includes the 8 known presets + Custom', () => {
    const ids = OPENAI_COMPAT_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['openai', 'gemini', 'groq', 'together', 'fireworks', 'deepinfra', 'cerebras', 'sambanova', 'custom']));
  });

  it('each non-custom preset has baseURL + docsUrl + defaultTestModel', () => {
    for (const p of OPENAI_COMPAT_PRESETS) {
      if (p.id === 'custom') continue;
      expect(p.baseURL).toMatch(/^https:\/\//);
      expect(p.docsUrl).toMatch(/^https:\/\//);
      expect(p.defaultTestModel).toBeTruthy();
      expect(p.supportsAuthProbe).toBe(true);
    }
  });

  it('custom preset has empty baseURL and supportsAuthProbe false', () => {
    const c = OPENAI_COMPAT_PRESETS.find((p) => p.id === 'custom')!;
    expect(c.baseURL).toBe('');
    expect(c.supportsAuthProbe).toBe(false);
  });
});
