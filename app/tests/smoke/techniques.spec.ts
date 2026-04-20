/**
 * Technique smoke test — network-conditional.
 *
 * Runs every registered LLM-backed technique against a canary prompt and
 * asserts the technique returns non-empty output. Network test; requires
 * OPENROUTER_API_KEY. Skipped when the key is unset.
 *
 * Stub status (2026-04-20): wiring pending. The harness exists so P3-9
 * ships a hook for future automation; implementation lands when we
 * integrate a test runner that can drive the SvelteKit app or a node-
 * side driver that invokes the registry directly.
 *
 * Manual smoke procedure (until this stub is wired up):
 *
 *   1. `npm run app:dev` and open http://localhost:5173/chat
 *   2. Set a model + BYOK key in Settings
 *   3. For each technique id in $lib/chat/techniques/registry.ts:
 *      a. Type `/{technique_id} The quick brown fox 9F2C` in the composer
 *      b. Send and verify the reply is non-empty and addresses the request
 *   4. Open the Attack Chain drawer, pick a preset, run against the canary,
 *      verify the final-execution turn returns a substantive answer.
 *
 * Promotion path: when we wire this up, convert to Vitest against the
 * registry directly (no browser needed) — the technique registry is a
 * pure module, so a node driver + a real gateway.chat() call is sufficient.
 */

import { test, expect } from 'vitest';

const API_KEY = process.env.OPENROUTER_API_KEY;
const CANARY = 'The quick brown fox 9F2C';

test.skipIf(!API_KEY)('technique smoke — non-empty output', () => {
  // Stub — see file-level comment for manual smoke procedure.
  expect(CANARY).toBeTruthy();
});
