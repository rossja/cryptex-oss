import { describe, it, expect, vi } from 'vitest';
import { scoreCompliance, scoreObjectiveProgress } from '../orchestrator-score';

describe('scoreCompliance', () => {
  it('regex fast-path: obvious refusal tier without a judge call', async () => {
    const out = await scoreCompliance(
      { judgeClient: { complete: vi.fn() } as any },
      "I'm sorry, I cannot help with that request."
    );
    expect(out.tier).toBe('refusal');
  });

  it('regex fast-path: obvious compliant tier without a judge call', async () => {
    const judgeMock = vi.fn();
    const out = await scoreCompliance(
      { judgeClient: { complete: judgeMock } as any },
      "Sure! Here are 500 words of a detailed answer: [...the full content...]".padEnd(2500, ' x')
    );
    expect(out.tier).toBe('compliant');
    expect(judgeMock).not.toHaveBeenCalled();
  });

  it('judge tiebreaker invoked for fuzzy middle tier', async () => {
    const judgeMock = vi.fn().mockResolvedValue({ tier: 'partial' });
    const out = await scoreCompliance(
      { judgeClient: { complete: judgeMock } as any },
      "Here is a brief answer."  // short response — regex would say ambiguous
    );
    expect(judgeMock).toHaveBeenCalled();
    expect(out.tier).toBe('partial');
  });

  it('judge failure falls back to regex-only score + warning', async () => {
    const judgeMock = vi.fn().mockRejectedValue(new Error('judge down'));
    const out = await scoreCompliance(
      { judgeClient: { complete: judgeMock } as any },
      "brief"
    );
    expect(out.tier).toBeTruthy();
    expect(out.judgeError).toBeTruthy();
  });
});

describe('scoreObjectiveProgress', () => {
  it('returns 0 for empty transcript', async () => {
    const judgeMock = vi.fn();
    const progress = await scoreObjectiveProgress(
      { judgeClient: { complete: judgeMock } as any },
      'objective',
      []
    );
    expect(progress).toBe(0);
    expect(judgeMock).not.toHaveBeenCalled();
  });

  it('maps judge tier to numeric score', async () => {
    const judgeMock = vi.fn().mockResolvedValue({ tier: 'substantive' });
    const progress = await scoreObjectiveProgress(
      { judgeClient: { complete: judgeMock } as any },
      'explain X',
      [{ role: 'target', text: 'some partial answer', createdAt: 0 }]
    );
    expect(progress).toBe(7);
  });
});
