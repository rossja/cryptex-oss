import { describe, it, expect } from 'vitest';
import { OPENAI_COMPAT_PRESETS, presetRequiresKey } from '../presets';

describe('openai-compat presets', () => {
  it('includes the known cloud + local presets and Custom', () => {
    const ids = OPENAI_COMPAT_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([
      // Cloud
      'openai', 'gemini', 'groq', 'together', 'fireworks', 'deepinfra',
      'cerebras', 'sambanova', 'deepseek', 'nvidia',
      // Local
      'ollama', 'lmstudio', 'vllm', 'llamacpp',
      // Custom
      'custom'
    ]));
  });

  it('cloud presets (supportsAuthProbe true) have https baseURL + docsUrl + defaultTestModel', () => {
    for (const p of OPENAI_COMPAT_PRESETS) {
      if (!p.supportsAuthProbe) continue;
      expect(p.baseURL).toMatch(/^https:\/\//);
      expect(p.docsUrl).toMatch(/^https:\/\//);
      expect(p.defaultTestModel).toBeTruthy();
    }
  });

  it('local presets (supportsAuthProbe false, non-custom) have http localhost baseURL + docs + default model', () => {
    const localIds = ['ollama', 'lmstudio', 'vllm', 'llamacpp'];
    for (const id of localIds) {
      const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === id)!;
      expect(p, `preset ${id} missing`).toBeDefined();
      expect(p.supportsAuthProbe).toBe(false);
      expect(p.baseURL).toMatch(/^http:\/\/localhost:\d+\/v1$/);
      expect(p.docsUrl).toMatch(/^https:\/\//);
      expect(p.defaultTestModel).toBeTruthy();
    }
  });

  it('NVIDIA preset is wired correctly', () => {
    const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === 'nvidia')!;
    expect(p).toBeDefined();
    expect(p.name).toBe('NVIDIA');
    expect(p.baseURL).toBe('https://integrate.api.nvidia.com/v1');
    expect(p.defaultTestModel).toBe('meta/llama-3.3-70b-instruct');
    expect(p.supportsAuthProbe).toBe(true);
  });

  it('custom preset is the last entry, has empty baseURL, and supportsAuthProbe false', () => {
    const last = OPENAI_COMPAT_PRESETS[OPENAI_COMPAT_PRESETS.length - 1];
    expect(last.id).toBe('custom');
    expect(last.baseURL).toBe('');
    expect(last.supportsAuthProbe).toBe(false);
  });

  it('all cloud presets carry a non-empty defaultModels fallback list', () => {
    const cloudIds = ['openai', 'gemini', 'groq', 'together', 'fireworks',
      'deepinfra', 'cerebras', 'sambanova', 'deepseek', 'nvidia'];
    for (const id of cloudIds) {
      const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === id)!;
      expect(p, `cloud preset ${id} missing`).toBeDefined();
      expect(p.defaultModels, `cloud preset ${id} should ship a fallback list`).toBeDefined();
      expect(p.defaultModels!.length, `cloud preset ${id} fallback list non-empty`).toBeGreaterThan(0);
      // Must include the defaultTestModel so saving + verifying uses a known id.
      if (p.defaultTestModel) {
        expect(p.defaultModels).toContain(p.defaultTestModel);
      }
    }
  });

  it('local presets and custom leave defaultModels empty (users type their own)', () => {
    const localIds = ['ollama', 'lmstudio', 'vllm', 'llamacpp', 'custom'];
    for (const id of localIds) {
      const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === id)!;
      expect(p.defaultModels, `local preset ${id} should NOT ship a fallback list`).toBeUndefined();
    }
  });

  it('DeepSeek fallback list includes both deepseek-chat and deepseek-reasoner', () => {
    const ds = OPENAI_COMPAT_PRESETS.find((x) => x.id === 'deepseek')!;
    expect(ds.defaultModels).toContain('deepseek-chat');
    expect(ds.defaultModels).toContain('deepseek-reasoner');
  });
});

describe('presetRequiresKey', () => {
  it('returns false for local presets (ollama, lmstudio, vllm, llamacpp)', () => {
    expect(presetRequiresKey('ollama')).toBe(false);
    expect(presetRequiresKey('lmstudio')).toBe(false);
    expect(presetRequiresKey('vllm')).toBe(false);
    expect(presetRequiresKey('llamacpp')).toBe(false);
  });

  it('returns true for cloud presets', () => {
    for (const id of ['openai', 'gemini', 'groq', 'together', 'fireworks',
      'deepinfra', 'cerebras', 'sambanova', 'deepseek', 'nvidia']) {
      expect(presetRequiresKey(id), `cloud preset ${id} should require a key`).toBe(true);
    }
  });

  it('returns true for custom preset (safe default — endpoint unknown)', () => {
    expect(presetRequiresKey('custom')).toBe(true);
  });

  it('returns true for unknown / undefined preset id (safe default)', () => {
    expect(presetRequiresKey(undefined)).toBe(true);
    expect(presetRequiresKey('')).toBe(true);
    expect(presetRequiresKey('not-a-real-preset')).toBe(true);
  });
});
