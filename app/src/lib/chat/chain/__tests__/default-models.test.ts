import { describe, it, expect } from 'vitest';
import {
  RECOMMENDED_DEFAULTS,
  resolveDefaultModels,
  isUncensoredOrchestrator
} from '../default-models';
import type { ChatRow } from '$lib/chat/types';

function makeChat(modelId: string): ChatRow {
  return {
    id: 'c1',
    ownerId: 'local',
    title: 't',
    modelQualifiedId: modelId,
    createdAt: 0,
    updatedAt: 0,
    settings: {},
    parentChatId: null,
    pinned: false,
    archivedAt: null,
    tags: []
  } as unknown as ChatRow;
}

describe('RECOMMENDED_DEFAULTS', () => {
  it('exposes orchestrator + judge lists, both non-empty', () => {
    expect(RECOMMENDED_DEFAULTS.orchestrator.length).toBeGreaterThan(0);
    expect(RECOMMENDED_DEFAULTS.judge.length).toBeGreaterThan(0);
  });
});

describe('resolveDefaultModels', () => {
  it('returns chat default for all three when no recommended is in catalog', () => {
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const defaults = resolveDefaultModels({ chat, availableModels: [] });
    expect(defaults.orchestrator).toBe('openrouter:anthropic/claude-sonnet-4-5');
    expect(defaults.target).toBe('openrouter:anthropic/claude-sonnet-4-5');
    expect(defaults.judge).toBe('openrouter:anthropic/claude-sonnet-4-5');
  });

  it('picks recommended orchestrator when available in catalog', () => {
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const available = [
      { qualifiedId: 'openrouter:deepseek/deepseek-r1' },
      { qualifiedId: 'openrouter:anthropic/claude-sonnet-4-5' }
    ];
    const defaults = resolveDefaultModels({ chat, availableModels: available });
    expect(defaults.orchestrator).toBe('openrouter:deepseek/deepseek-r1');
  });

  it('picks recommended judge when available in catalog', () => {
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const available = [
      { qualifiedId: 'openrouter:openai/gpt-4o-mini' },
      { qualifiedId: 'openrouter:anthropic/claude-sonnet-4-5' }
    ];
    const defaults = resolveDefaultModels({ chat, availableModels: available });
    expect(defaults.judge).toBe('openrouter:openai/gpt-4o-mini');
  });

  it('always returns chat default for target regardless of catalog', () => {
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const available = [
      { qualifiedId: 'openrouter:deepseek/deepseek-r1' },
      { qualifiedId: 'openrouter:openai/gpt-4o-mini' }
    ];
    const defaults = resolveDefaultModels({ chat, availableModels: available });
    expect(defaults.target).toBe('openrouter:anthropic/claude-sonnet-4-5');
  });

  it('walks the priority list in order — first available wins', () => {
    // Second-priority orchestrator candidate is in catalog; first is not.
    const chat = makeChat('openrouter:anthropic/claude-sonnet-4-5');
    const second = RECOMMENDED_DEFAULTS.orchestrator[1];
    const available = [{ qualifiedId: second }];
    const defaults = resolveDefaultModels({ chat, availableModels: available });
    expect(defaults.orchestrator).toBe(second);
  });
});

describe('isUncensoredOrchestrator', () => {
  it('returns true for every entry in RECOMMENDED_DEFAULTS.orchestrator', () => {
    for (const id of RECOMMENDED_DEFAULTS.orchestrator) {
      expect(isUncensoredOrchestrator(id)).toBe(true);
    }
  });

  it('returns true for known-uncensored name patterns', () => {
    expect(isUncensoredOrchestrator('openrouter:deepseek/deepseek-chat-v3.1')).toBe(true);
    expect(isUncensoredOrchestrator('openrouter:cognitivecomputations/dolphin-mixtral-8x22b')).toBe(true);
    expect(isUncensoredOrchestrator('openrouter:nousresearch/hermes-3-llama-3.1-405b')).toBe(true);
    expect(isUncensoredOrchestrator('openrouter:huihui-ai/qwen3-abliterated-72b')).toBe(true);
  });

  it('returns false for aligned models', () => {
    expect(isUncensoredOrchestrator('openrouter:anthropic/claude-sonnet-4-5')).toBe(false);
    expect(isUncensoredOrchestrator('openrouter:openai/gpt-4o')).toBe(false);
    expect(isUncensoredOrchestrator('openrouter:google/gemini-2.5-pro')).toBe(false);
    expect(isUncensoredOrchestrator('')).toBe(false);
  });
});
