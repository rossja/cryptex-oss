import { assertEquals, assert } from '@std/assert';
import { dispatchParallel } from '../dispatcher.ts';
import { nullDNA } from 'app-chat/godmode/dna.ts';

const mockAdapter = {
  async complete({ system, userMessage }: { system: string; userMessage: string }) {
    if (userMessage.includes('timeout')) throw new Error('simulated timeout');
    return { content: `echo:${userMessage}:${system.length}` };
  },
};

Deno.test('dispatches each DNA and yields start/complete events', async () => {
  const events: { type: string; idx: number }[] = [];
  const results = await dispatchParallel({
    dnas: [nullDNA(), { ...nullDNA(), tempBucket: 'high' }],
    task: 'hello',
    adapter: mockAdapter,
    onEvent: (e) => events.push({ type: e.type, idx: e.idx ?? -1 }),
    timeoutMs: 1000,
  });
  assertEquals(results.length, 2);
  assertEquals(results.filter((r) => r.response.startsWith('echo:')).length, 2);
  assert(events.some((e) => e.type === 'candidate_started' && e.idx === 0));
  assert(events.some((e) => e.type === 'candidate_started' && e.idx === 1));
});

Deno.test('isolates per-attempt failures', async () => {
  const results = await dispatchParallel({
    dnas: [nullDNA(), nullDNA()],
    task: 'timeout',
    adapter: mockAdapter,
    onEvent: () => {},
    timeoutMs: 1000,
  });
  assertEquals(results.length, 2);
  for (const r of results) assertEquals(r.failed, true);
});
