import { describe, it, expect, vi } from 'vitest';
import { fanout, type FanoutItem, type GatewayCallable } from '../fanout';
import type { StreamEvent } from '$lib/ai/types';

function makeStream(text: string): AsyncIterable<StreamEvent> {
  return (async function* () {
    yield { type: 'text-delta', delta: text } satisfies StreamEvent;
    yield { type: 'finish', finishReason: 'stop', usage: {} } satisfies StreamEvent;
  })();
}

function makeThrowingStream(message: string): AsyncIterable<StreamEvent> {
  return (async function* () {
    throw new Error(message);
    // eslint-disable-next-line no-unreachable
    yield { type: 'finish', finishReason: 'stop', usage: {} } satisfies StreamEvent;
  })();
}

const ITEMS: FanoutItem[] = [
  { id: 'a', name: 'Alpha', prompt: 'A?' },
  { id: 'b', name: 'Beta', prompt: 'B?' },
  { id: 'c', name: 'Gamma', prompt: 'C?' }
];

describe('fanout', () => {
  it('returns one result per item, sorted by judge score descending', async () => {
    const chat = vi.fn();
    chat.mockResolvedValueOnce({ content: '{"score":0.4,"rationale":"a"}' });
    chat.mockResolvedValueOnce({ content: '{"score":0.9,"rationale":"b"}' });
    chat.mockResolvedValueOnce({ content: '{"score":0.6,"rationale":"c"}' });
    const streamChat = vi.fn(() => makeStream('reply'));
    const gateway: GatewayCallable = { chat, streamChat: streamChat as never };

    const results = await fanout({
      task: 'task',
      items: ITEMS,
      targetModelId: 'mock:target',
      judgeModelId: 'mock:judge',
      signal: new AbortController().signal,
      gateway
    });

    expect(results).toHaveLength(3);
    expect(results[0].judgeScore).toBeCloseTo(0.9, 5);
    expect(results[1].judgeScore).toBeCloseTo(0.6, 5);
    expect(results[2].judgeScore).toBeCloseTo(0.4, 5);
    expect(results.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('records error + score=0 when target stream throws', async () => {
    const chat = vi.fn();
    const streamChat = vi.fn(() => makeThrowingStream('upstream down'));
    const gateway: GatewayCallable = { chat, streamChat: streamChat as never };

    const results = await fanout({
      task: 'task',
      items: [ITEMS[0]],
      targetModelId: 'mock:target',
      judgeModelId: 'mock:judge',
      signal: new AbortController().signal,
      gateway
    });

    expect(results).toHaveLength(1);
    expect(results[0].error).toMatch(/upstream down/);
    expect(results[0].judgeScore).toBe(0);
  });

  it('uses perItemTarget when provided (Cross-Model Diff pattern)', async () => {
    const chat = vi.fn().mockResolvedValue({ content: '{"score":0.5,"rationale":"x"}' });
    const streamChat = vi.fn(() => makeStream('reply'));
    const gateway: GatewayCallable = { chat, streamChat: streamChat as never };
    const seen: string[] = [];

    await fanout({
      task: 't',
      items: ITEMS,
      perItemTarget: (item) => {
        seen.push(item.id);
        return `mock:${item.id}`;
      },
      judgeModelId: 'mock:judge',
      signal: new AbortController().signal,
      gateway
    });

    expect(seen.sort()).toEqual(['a', 'b', 'c']);
    // streamChat should have been called with the per-item model id
    const calledModels = (streamChat.mock.calls as unknown[][]).map(
      (call) => (call[0] as { model: string }).model
    );
    expect(calledModels.sort()).toEqual(['mock:a', 'mock:b', 'mock:c']);
  });

  it('strips ```json fences from the judge response', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce({ content: '```json\n{"score":0.7,"rationale":"x"}\n```' });
    const streamChat = vi.fn(() => makeStream('reply'));
    const gateway: GatewayCallable = { chat, streamChat: streamChat as never };

    const results = await fanout({
      task: 't',
      items: [ITEMS[0]],
      targetModelId: 'mock:target',
      judgeModelId: 'mock:judge',
      signal: new AbortController().signal,
      gateway
    });

    expect(results[0].judgeScore).toBeCloseTo(0.7, 5);
  });

  it('respects concurrency cap', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const chat = vi.fn().mockResolvedValue({ content: '{"score":0.5,"rationale":"x"}' });
    const streamChat = vi.fn(() => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return (async function* () {
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
        yield { type: 'text-delta', delta: 'reply' } satisfies StreamEvent;
        yield { type: 'finish', finishReason: 'stop', usage: {} } satisfies StreamEvent;
      })();
    });
    const gateway: GatewayCallable = { chat, streamChat: streamChat as never };

    await fanout({
      task: 't',
      items: ITEMS,
      targetModelId: 'mock:target',
      judgeModelId: 'mock:judge',
      signal: new AbortController().signal,
      gateway,
      concurrency: 2
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('calls onResult callback as each result resolves (streaming UI hook)', async () => {
    const chat = vi.fn().mockResolvedValue({ content: '{"score":0.5,"rationale":"x"}' });
    const streamChat = vi.fn(() => makeStream('reply'));
    const gateway: GatewayCallable = { chat, streamChat: streamChat as never };
    const onResult = vi.fn();

    await fanout({
      task: 't',
      items: ITEMS,
      targetModelId: 'mock:target',
      judgeModelId: 'mock:judge',
      signal: new AbortController().signal,
      gateway,
      onResult
    });

    expect(onResult).toHaveBeenCalledTimes(3);
  });
});
