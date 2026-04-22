import { assertEquals, assert } from '@std/assert';

// These tests only run if TEST_PAID_JWT + a locally-served supabase function are available.
// Skipped otherwise — the edge function is exercised end-to-end in Task 14 smoke.
const hasJWT = !!Deno.env.get('TEST_PAID_JWT');
const skip = !hasJWT;

Deno.test({
  name: 'rejects unauthenticated requests with 401 or 403',
  ignore: skip,
  async fn() {
    const res = await fetch('http://localhost:54321/functions/v1/godmode-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'x', K: 3, model: 'claude-sonnet-4-6' }),
    });
    assert(res.status === 401 || res.status === 403);
    await res.body?.cancel();
  },
});

Deno.test({
  name: 'rejects invalid K',
  ignore: skip,
  async fn() {
    const res = await fetch('http://localhost:54321/functions/v1/godmode-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('TEST_PAID_JWT')}` },
      body: JSON.stringify({ task: 'x', K: 99, model: 'claude-sonnet-4-6' }),
    });
    assertEquals(res.status, 400);
    await res.body?.cancel();
  },
});
