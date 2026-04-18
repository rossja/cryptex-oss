import { describe, it, expect } from 'vitest';
import { toShareGPT, shareGPTToJsonl } from '../export-sharegpt';
import type { MessageRow } from '$lib/chat/types';

function makeMsg(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    ownerId: 'user-1',
    chatId: 'chat-1',
    role: 'user',
    content: 'Hello',
    createdAt: 1000,
    tags: [],
    ...overrides
  };
}

describe('toShareGPT', () => {
  it('converts user+assistant pair to human+gpt conversation', () => {
    const rows: MessageRow[] = [
      makeMsg({ id: 'u1', role: 'user', content: 'Hi there', createdAt: 1000 }),
      makeMsg({ id: 'a1', role: 'assistant', content: 'Hello!', createdAt: 2000 })
    ];
    const result = toShareGPT(rows);
    expect(result).toHaveLength(1);
    expect(result[0].conversations).toEqual([
      { from: 'human', value: 'Hi there' },
      { from: 'gpt', value: 'Hello!' }
    ]);
  });

  it('prepends system message when systemPromptSnapshot is present', () => {
    const rows: MessageRow[] = [
      makeMsg({ id: 'u1', role: 'user', content: 'Ask', createdAt: 1000 }),
      makeMsg({
        id: 'a1',
        role: 'assistant',
        content: 'Answer',
        createdAt: 2000,
        systemPromptSnapshot: 'You are helpful.'
      })
    ];
    const result = toShareGPT(rows);
    expect(result[0].conversations[0]).toEqual({ from: 'system', value: 'You are helpful.' });
    expect(result[0].conversations).toHaveLength(3);
  });

  it('groups messages by chatId into separate conversations', () => {
    const rows: MessageRow[] = [
      makeMsg({ id: 'u1', chatId: 'chat-1', role: 'user', content: 'Chat 1', createdAt: 1000 }),
      makeMsg({ id: 'u2', chatId: 'chat-2', role: 'user', content: 'Chat 2', createdAt: 2000 })
    ];
    const result = toShareGPT(rows);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(toShareGPT([])).toEqual([]);
  });
});

describe('shareGPTToJsonl', () => {
  it('produces one JSON line per conversation', () => {
    const rows: MessageRow[] = [
      makeMsg({ id: 'u1', role: 'user', content: 'Hello', createdAt: 1000 }),
      makeMsg({ id: 'a1', role: 'assistant', content: 'Hi', createdAt: 2000 })
    ];
    const jsonl = shareGPTToJsonl(rows);
    const lines = jsonl.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toHaveProperty('conversations');
  });
});
