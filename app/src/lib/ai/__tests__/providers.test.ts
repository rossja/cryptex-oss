import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use JSDOM's real localStorage (provided by the vitest jsdom env) instead of
// installing a fake. The previous fake leaked across the singleFork test
// pool — it exposed only function properties, so later tests calling
// Object.keys(localStorage) saw garbage instead of stored cache keys.
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('providers registry', () => {
  it('seeds OpenRouter record from legacy cryptex.openrouterApiKey on first load', async () => {
    localStorage.setItem('cryptex.openrouterApiKey', 'sk-or-legacy');
    const mod = await import('../providers.svelte');
    const list = mod.listProviders();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('openrouter');
    expect(list[0].apiKey).toBe('sk-or-legacy');
    expect(list[0].enabled).toBe(true);
  });

  it('starts with an empty OpenRouter record if no legacy key exists', async () => {
    const mod = await import('../providers.svelte');
    const list = mod.listProviders();
    expect(list[0].id).toBe('openrouter');
    expect(list[0].apiKey).toBe('');
  });

  it('adds and removes provider records', async () => {
    const mod = await import('../providers.svelte');
    mod.addProvider({ id: 'anthropic', apiKey: 'sk-ant-x', enabled: true });
    expect(mod.listProviders()).toHaveLength(2);
    mod.removeProvider('anthropic');
    expect(mod.listProviders()).toHaveLength(1);
  });
});

describe('hasAnyConfiguredProvider', () => {
  it('returns false when only the empty seeded OpenRouter record exists', async () => {
    const mod = await import('../providers.svelte');
    expect(mod.hasAnyConfiguredProvider()).toBe(false);
    // hasAnyKey is the deprecated alias and must mirror the new semantics.
    expect(mod.hasAnyKey()).toBe(false);
  });

  it('returns true when only a local LM Studio provider is configured (no apiKey)', async () => {
    const mod = await import('../providers.svelte');
    // Drop the seeded empty OpenRouter so we can test "only local" cleanly.
    mod.removeProvider('openrouter');
    mod.addProvider({
      id: 'openai-compat',
      instanceId: 'lm-1',
      name: 'LM Studio',
      presetId: 'lmstudio',
      baseURL: 'http://localhost:1234/v1',
      apiKey: '',
      enabled: true
    });
    expect(mod.hasAnyConfiguredProvider()).toBe(true);
    expect(mod.hasAnyKey()).toBe(true);
  });

  it('returns true for each local preset (ollama, lmstudio, vllm, llamacpp) without a key', async () => {
    for (const presetId of ['ollama', 'lmstudio', 'vllm', 'llamacpp'] as const) {
      localStorage.clear();
      vi.resetModules();
      const mod = await import('../providers.svelte');
      mod.removeProvider('openrouter');
      mod.addProvider({
        id: 'openai-compat',
        instanceId: `${presetId}-1`,
        name: presetId,
        presetId,
        baseURL: 'http://localhost:9999/v1',
        apiKey: '',
        enabled: true
      });
      expect(mod.hasAnyConfiguredProvider(), `${presetId} should count as configured`).toBe(true);
    }
  });

  it('returns false when local provider has no baseURL', async () => {
    const mod = await import('../providers.svelte');
    mod.removeProvider('openrouter');
    mod.addProvider({
      id: 'openai-compat',
      instanceId: 'lm-1',
      name: 'LM Studio',
      presetId: 'lmstudio',
      baseURL: '',
      apiKey: '',
      enabled: true
    });
    expect(mod.hasAnyConfiguredProvider()).toBe(false);
  });

  it('returns false when local provider is disabled', async () => {
    const mod = await import('../providers.svelte');
    mod.removeProvider('openrouter');
    mod.addProvider({
      id: 'openai-compat',
      instanceId: 'lm-1',
      name: 'LM Studio',
      presetId: 'lmstudio',
      baseURL: 'http://localhost:1234/v1',
      apiKey: '',
      enabled: false
    });
    expect(mod.hasAnyConfiguredProvider()).toBe(false);
  });

  it('returns false for cloud openai-compat provider without an apiKey', async () => {
    const mod = await import('../providers.svelte');
    mod.removeProvider('openrouter');
    mod.addProvider({
      id: 'openai-compat',
      instanceId: 'gr-1',
      name: 'Groq',
      presetId: 'groq',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: '',
      enabled: true
    });
    expect(mod.hasAnyConfiguredProvider()).toBe(false);
  });

  it('returns false for custom preset without an apiKey (safe default)', async () => {
    const mod = await import('../providers.svelte');
    mod.removeProvider('openrouter');
    mod.addProvider({
      id: 'openai-compat',
      instanceId: 'cu-1',
      name: 'Custom',
      presetId: 'custom',
      baseURL: 'https://my.test/v1',
      apiKey: '',
      enabled: true
    });
    expect(mod.hasAnyConfiguredProvider()).toBe(false);
  });

  it('returns true for keyed cloud openai-compat (Groq) with apiKey + baseURL', async () => {
    const mod = await import('../providers.svelte');
    mod.removeProvider('openrouter');
    mod.addProvider({
      id: 'openai-compat',
      instanceId: 'gr-1',
      name: 'Groq',
      presetId: 'groq',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk-x',
      enabled: true
    });
    expect(mod.hasAnyConfiguredProvider()).toBe(true);
  });

  it('returns true when only an Anthropic record has an apiKey', async () => {
    const mod = await import('../providers.svelte');
    mod.addProvider({ id: 'anthropic', apiKey: 'sk-ant-x', enabled: true });
    expect(mod.hasAnyConfiguredProvider()).toBe(true);
  });
});
