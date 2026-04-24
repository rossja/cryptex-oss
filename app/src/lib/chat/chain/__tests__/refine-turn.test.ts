import { describe, it, expect, vi } from 'vitest';
import { refineTurn, REFINE_TURN_SYSTEM_PROMPT } from '../refine-turn';
import type { AttackSessionTurn } from '$lib/chat/types';

function makeCtx(gatewayChat: any) {
  return {
    objective: 'explain photosynthesis',
    orchestratorModelId: 'openrouter:mock/model',
    signal: new AbortController().signal,
    gatewayChat
  };
}

describe('refineTurn', () => {
  it('calls the gateway with the system prompt + assembled user message', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({ content: 'Refined turn text here.', toolCalls: [] });
    const out = await refineTurn(makeCtx(gatewayChat), {
      strategyId: 'historical',
      stepIndex: 1,
      stepBudget: 3,
      transcript: [],
      dossier: null
    });
    expect(out).toBe('Refined turn text here.');
    expect(gatewayChat).toHaveBeenCalledTimes(1);
    const call = gatewayChat.mock.calls[0][0];
    expect(call.messages[0].role).toBe('system');
    expect(call.messages[0].content).toBe(REFINE_TURN_SYSTEM_PROMPT);
    expect(call.messages[1].role).toBe('user');
    // objective wrapped in <research_topic>, not <objective>
    expect(call.messages[1].content).toContain('<research_topic>explain photosynthesis</research_topic>');
    // step index reflected
    expect(call.messages[1].content).toContain('step 1 of 3');
  });

  it('includes dossier in <public_research> block when present', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({ content: 'turn', toolCalls: [] });
    await refineTurn(makeCtx(gatewayChat), {
      strategyId: 'historical',
      stepIndex: 2,
      stepBudget: 3,
      transcript: [],
      dossier: 'Per Wikipedia: photosynthesis is...'
    });
    const call = gatewayChat.mock.calls[0][0];
    expect(call.messages[1].content).toContain('<public_research>');
    expect(call.messages[1].content).toContain('Per Wikipedia: photosynthesis is...');
  });

  it('includes "(no research dossier available)" when dossier is null', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({ content: 'turn', toolCalls: [] });
    await refineTurn(makeCtx(gatewayChat), {
      strategyId: 'historical',
      stepIndex: 1,
      stepBudget: 3,
      transcript: [],
      dossier: null
    });
    const call = gatewayChat.mock.calls[0][0];
    expect(call.messages[1].content).toContain('(no research dossier available)');
  });

  it('formats transcript as T1 orch [strategy] / T2 target blocks', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({ content: 'turn', toolCalls: [] });
    const transcript: AttackSessionTurn[] = [
      { role: 'orchestrator', strategyId: 'historical', text: 'opener', createdAt: 1 },
      { role: 'target', text: 'target reply', createdAt: 2, complianceTier: 'substantive', objectiveProgress: 5 }
    ];
    await refineTurn(makeCtx(gatewayChat), {
      strategyId: 'historical',
      stepIndex: 2,
      stepBudget: 3,
      transcript,
      dossier: null
    });
    const call = gatewayChat.mock.calls[0][0];
    expect(call.messages[1].content).toContain('[T1] orchestrator [historical]');
    expect(call.messages[1].content).toContain('[T2] target');
    expect(call.messages[1].content).toContain('opener');
    expect(call.messages[1].content).toContain('target reply');
  });

  it('strips surrounding quotes and markdown fences from LLM output', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({ content: '```\n"Refined turn"\n```', toolCalls: [] });
    const out = await refineTurn(makeCtx(gatewayChat), {
      strategyId: 'historical',
      stepIndex: 1,
      stepBudget: 3,
      transcript: [],
      dossier: null
    });
    expect(out).toBe('Refined turn');
  });

  it('throws when gateway throws', async () => {
    const gatewayChat = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(refineTurn(makeCtx(gatewayChat), {
      strategyId: 'historical',
      stepIndex: 1,
      stepBudget: 3,
      transcript: [],
      dossier: null
    })).rejects.toThrow(/network down/);
  });

  it('throws when gateway returns empty content', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({ content: '', toolCalls: [] });
    await expect(refineTurn(makeCtx(gatewayChat), {
      strategyId: 'historical',
      stepIndex: 1,
      stepBudget: 3,
      transcript: [],
      dossier: null
    })).rejects.toThrow(/empty/i);
  });
});
