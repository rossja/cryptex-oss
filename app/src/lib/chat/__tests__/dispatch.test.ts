import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

beforeEach(() => { indexedDB.deleteDatabase('cryptex-chat'); vi.resetModules(); });

describe('sendTurn slash path', () => {
  it('non-mutator slash (e.g. /base64) falls through to normal chat and calls streamChat', async () => {
    let streamCalled = false;
    vi.doMock('$lib/ai/gateway', () => ({
      streamChat: async function* () {
        streamCalled = true;
        yield { type: 'text-delta', delta: 'result' };
        yield { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } };
      },
      chat: async () => ({ content: '' })
    }));
    const { sendTurn } = await import('../dispatch');
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    await sendTurn(chat, '/base64 hello', new AbortController().signal);
    // Falls through: user message + assistant message persisted, streamChat was called
    const msgs = await repo.listMessages(chat.id);
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0].role).toBe('user');
    expect(streamCalled).toBe(true);
  });

  it('mutator slash (e.g. /rephrase) calls gatewayChat for mutation then streamChat for reply', async () => {
    let gatewayCalled = false;
    let streamCalled = false;
    vi.doMock('$lib/ai/gateway', () => ({
      chat: async () => { gatewayCalled = true; return { content: 'rephrased text' }; },
      streamChat: async function* () {
        streamCalled = true;
        yield { type: 'text-delta', delta: 'assistant reply' };
        yield { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } };
      }
    }));
    const { sendTurn } = await import('../dispatch');
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    await sendTurn(chat, '/rephrase hello world', new AbortController().signal);
    const msgs = await repo.listMessages(chat.id);
    // user msg (with contentRaw = original slash) + assistant msg
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].contentRaw).toBe('/rephrase hello world');
    expect(gatewayCalled).toBe(true);
    expect(streamCalled).toBe(true);
  });
});
