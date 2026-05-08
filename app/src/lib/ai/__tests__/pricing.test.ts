import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock the catalog because it's reactive Svelte rune state initialized
// from localStorage; pricing.ts only consumes its `find()` API.
const mockFind = vi.fn();

vi.mock('../catalog.svelte', () => ({
  catalog: {
    get list() {
      return [];
    },
    find: (id: string) => mockFind(id)
  }
}));

beforeEach(() => {
  mockFind.mockReset();
});

describe('getPriceForModel', () => {
  it('returns catalog pricing when populated', async () => {
    mockFind.mockReturnValue({
      qualifiedId: 'openrouter:openai/gpt-4o-mini',
      pricing: { promptUsd: 0.00000015, completionUsd: 0.0000006 }
    });
    const { getPriceForModel } = await import('../pricing');
    const price = getPriceForModel('openrouter:openai/gpt-4o-mini');
    expect(price).toEqual({ promptUsd: 0.00000015, completionUsd: 0.0000006 });
  });

  it('falls back to hardcoded map for known anthropic-direct ids', async () => {
    mockFind.mockReturnValue(undefined);
    const { getPriceForModel } = await import('../pricing');
    const price = getPriceForModel('anthropic:claude-3-5-sonnet-latest');
    expect(price).toBeTruthy();
    expect(price?.promptUsd).toBeGreaterThan(0);
    expect(price?.completionUsd).toBeGreaterThan(0);
  });

  it('returns null for unknown models', async () => {
    mockFind.mockReturnValue(undefined);
    const { getPriceForModel } = await import('../pricing');
    expect(getPriceForModel('made-up:nothing')).toBeNull();
  });

  it('returns null for empty / undefined ids', async () => {
    const { getPriceForModel } = await import('../pricing');
    expect(getPriceForModel('')).toBeNull();
  });

  it('rejects non-finite catalog pricing', async () => {
    mockFind.mockReturnValue({
      qualifiedId: 'openrouter:broken/model',
      pricing: { promptUsd: NaN, completionUsd: Infinity }
    });
    const { getPriceForModel } = await import('../pricing');
    expect(getPriceForModel('openrouter:broken/model')).toBeNull();
  });
});

describe('costFromUsage', () => {
  it('multiplies tokens by per-token price', async () => {
    mockFind.mockReturnValue({
      qualifiedId: 'openrouter:test/model',
      pricing: { promptUsd: 0.000001, completionUsd: 0.000002 }
    });
    const { costFromUsage } = await import('../pricing');
    // 1000 input × $0.000001 + 500 output × $0.000002 = 0.001 + 0.001 = $0.002
    expect(costFromUsage('openrouter:test/model', 1000, 500)).toBeCloseTo(0.002, 6);
  });

  it('returns null when pricing is unknown', async () => {
    mockFind.mockReturnValue(undefined);
    const { costFromUsage } = await import('../pricing');
    expect(costFromUsage('made-up:nothing', 100, 50)).toBeNull();
  });

  it('returns null when token counts are non-finite', async () => {
    mockFind.mockReturnValue({
      qualifiedId: 'openrouter:test/model',
      pricing: { promptUsd: 0.000001, completionUsd: 0.000002 }
    });
    const { costFromUsage } = await import('../pricing');
    expect(costFromUsage('openrouter:test/model', NaN, 50)).toBeNull();
    expect(costFromUsage('openrouter:test/model', 100, Infinity)).toBeNull();
  });
});
