import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('useToolState', () => {
  it('namespaces under cryptex.tool.<toolId>.<field>', async () => {
    const { useToolState } = await import('../tool-state.svelte');
    const s = useToolState<string>('adv-suffix', 'searchTerm', '');
    s.value = 'caesar';
    expect(localStorage.getItem('cryptex.tool.adv-suffix.searchTerm')).toBe(JSON.stringify('caesar'));
  });

  it('hydrates from a previously-persisted value', async () => {
    localStorage.setItem('cryptex.tool.adv-suffix.minSuccess', JSON.stringify(0.5));
    const { useToolState } = await import('../tool-state.svelte');
    const s = useToolState<number>('adv-suffix', 'minSuccess', 0);
    expect(s.value).toBe(0.5);
  });

  it('falls back to the initial value when nothing is persisted', async () => {
    const { useToolState } = await import('../tool-state.svelte');
    const s = useToolState<string>('glitch-tokens', 'searchTerm', 'fallback');
    expect(s.value).toBe('fallback');
  });

  it('isolates state across distinct toolIds', async () => {
    const { useToolState } = await import('../tool-state.svelte');
    const a = useToolState<string>('adv-suffix', 'searchTerm', '');
    const b = useToolState<string>('glitch-tokens', 'searchTerm', '');
    a.value = 'one';
    b.value = 'two';
    expect(a.value).toBe('one');
    expect(b.value).toBe('two');
    expect(localStorage.getItem('cryptex.tool.adv-suffix.searchTerm')).toBe(JSON.stringify('one'));
    expect(localStorage.getItem('cryptex.tool.glitch-tokens.searchTerm')).toBe(JSON.stringify('two'));
  });
});
