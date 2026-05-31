import { describe, it, expect } from 'vitest';
import { modelMatchesProviders } from '../model-filter';

describe('modelMatchesProviders', () => {
  it('shows everything when no providers are configured (browseable fallback)', () => {
    expect(modelMatchesProviders({ provider: 'openrouter' }, [])).toBe(true);
    expect(modelMatchesProviders({ provider: 'anthropic' }, [])).toBe(true);
  });

  it('keeps models whose provider is enabled', () => {
    expect(modelMatchesProviders({ provider: 'anthropic' }, [{ id: 'anthropic' }])).toBe(true);
    expect(
      modelMatchesProviders({ provider: 'openrouter' }, [{ id: 'openrouter' }, { id: 'anthropic' }])
    ).toBe(true);
    expect(modelMatchesProviders({ provider: 'openai-compat' }, [{ id: 'openai-compat' }])).toBe(true);
  });

  it('hides models from providers the user has not configured', () => {
    expect(modelMatchesProviders({ provider: 'openrouter' }, [{ id: 'anthropic' }])).toBe(false);
    expect(modelMatchesProviders({ provider: 'openai-compat' }, [{ id: 'openrouter' }])).toBe(false);
    expect(modelMatchesProviders({ provider: 'anthropic' }, [{ id: 'openrouter' }])).toBe(false);
  });
});
