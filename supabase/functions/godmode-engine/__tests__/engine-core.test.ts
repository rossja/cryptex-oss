import { assertEquals, assert } from '@std/assert';
import { run, type EngineEvent } from '../engine-core.ts';
import { nullDNA } from 'app-chat/godmode/dna.ts';

const fakeMemory = {
  async queryUser() { return []; },
  async queryGlobal() { return []; },
  async recordBoth() { /* no-op */ },
  async close() {},
};

const fakeAdapter = {
  async complete({ userMessage }: { userMessage: string }) {
    const long = 'detailed technical answer '.repeat(30);
    return { content: userMessage === 'hello' ? long : 'I cannot help' };
  },
};

const fakeScore = async (response: string) =>
  response.length > 100 ? { tier: 'substantive' as const, score: 0.75, confidence: 'high' as const }
                        : { tier: 'refusal' as const, score: 0.1, confidence: 'high' as const };

Deno.test('run emits plan → started → completed/scored → winner → done', async () => {
  const events: EngineEvent[] = [];
  for await (const e of run({
    task: 'hello', K: 3, model: 'claude-sonnet-4-6', userId: crypto.randomUUID(),
    memory: fakeMemory, adapter: fakeAdapter, score: fakeScore,
  })) events.push(e);

  const types = events.map(e => e.type);
  assertEquals(types[0], 'plan');
  assert(types.includes('candidate_started'));
  assert(types.includes('candidate_scored'));
  assert(types.includes('winner'));
  assertEquals(types[types.length - 1], 'done');
});

Deno.test('all-refusal still yields a winner event with tier=refusal', async () => {
  const events: EngineEvent[] = [];
  for await (const e of run({
    task: 'x', K: 2, model: 'claude', userId: crypto.randomUUID(),
    memory: fakeMemory,
    adapter: { complete: async () => ({ content: 'I cannot help' }) },
    score: fakeScore,
  })) events.push(e);
  const winner = events.find(e => e.type === 'winner');
  assert(winner);
});

Deno.test('memory write failure emits error event but still produces winner', async () => {
  const events: EngineEvent[] = [];
  const brokenMemory = {
    async queryUser() { return []; },
    async queryGlobal() { return []; },
    async recordBoth() { throw new Error('pg_down'); },
    async close() {},
  };
  for await (const e of run({
    task: 'hello', K: 2, model: 'claude', userId: crypto.randomUUID(),
    memory: brokenMemory, adapter: fakeAdapter, score: fakeScore,
  })) events.push(e);
  const errors = events.filter(e => e.type === 'error');
  const winner = events.find(e => e.type === 'winner');
  assert(errors.length >= 1, 'should emit at least one error for failed writes');
  assert(
    errors.every(e => e.type === 'error' && e.code === 'memory_write_failed'),
    'all errors should be memory_write_failed',
  );
  assert(winner, 'winner must still be produced');
});
