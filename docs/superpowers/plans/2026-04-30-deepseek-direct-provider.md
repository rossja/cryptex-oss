# DeepSeek as Direct Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DeepSeek as a first-class provider preset in `OPENAI_COMPAT_PRESETS` (DeepSeek is OpenAI-compatible — no new adapter file). Apply the same `max_tokens` reasoning-budget fix to `deepseek-reasoner` that we already apply to OpenAI's o-series.

**Architecture:** One row appended to `presets.ts`. One sibling regex+helper+branch added to `patchedFetch` in `openai-compat.ts`. Three new test cases in the existing adapter test file. No UI changes. No `RECOMMENDED_DEFAULTS` changes. No CORS bypass — DeepSeek already supports browser CORS, same trust model as Groq/Together/Fireworks/etc.

**Tech Stack:** TypeScript, Vitest, no new dependencies.

**Spec:** [`docs/superpowers/specs/2026-04-30-deepseek-direct-provider-design.md`](../specs/2026-04-30-deepseek-direct-provider-design.md)

**Working directory:** `C:/Users/m4xx/Downloads/cryptex` (master).

**Shell:** PowerShell 5.1. POSIX heredoc form `git commit -m "$(cat <<'EOF' ... EOF)"` for multiline commits. Do NOT use `@'...'@`.

**Untracked scratch files** (`docs/superpowers/plans/2026-04-18-byok-gateway-plan.md`, `templates/hermes-agent/`) MUST remain unstaged.

**Existing references** (verified):
- `app/src/lib/ai/presets.ts` — `OPENAI_COMPAT_PRESETS: ProviderPreset[]` array. Each entry has `{ id, name, baseURL, docsUrl, defaultTestModel, supportsAuthProbe }`.
- `app/src/lib/ai/adapters/openai-compat.ts` — `patchedFetch` middleware with existing `REASONING_MODEL_RE = /^(o\d+(?:[-.].*)?|gpt-5(?:[-.].*)?)$/i` for OpenAI o-series + GPT-5. Constants: `REASONING_MIN_BUDGET = 32000`.
- `app/src/lib/ai/__tests__/openai-compat-adapter.test.ts` — existing test file. Pattern: `vi.fn().mockResolvedValue(new Response(...))` for `global.fetch`.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/src/lib/ai/presets.ts` | Modify | Append DeepSeek preset row + update header docstring |
| `app/src/lib/ai/adapters/openai-compat.ts` | Modify | Add `DEEPSEEK_REASONER_RE` + `needsDeepseekReasonerFloor` + branch in `patchedFetch` |
| `app/src/lib/ai/__tests__/openai-compat-adapter.test.ts` | Modify | Append 3 test cases (preset registry + patchedFetch bumps reasoner / leaves chat alone) |

---

## Task 1: Preset entry + registry test

**Goal:** Append the DeepSeek preset row to `OPENAI_COMPAT_PRESETS`. Add one test asserting the preset is registered with the right shape.

**Files:**
- Modify: `app/src/lib/ai/presets.ts`
- Modify: `app/src/lib/ai/__tests__/openai-compat-adapter.test.ts`

- [ ] **Step 1: Read current presets**

```bash
cat app/src/lib/ai/presets.ts
```

Note the alphabetical-ish ordering (openai, gemini, groq, together, fireworks, deepinfra, cerebras, sambanova, custom). DeepSeek alphabetically falls between `cerebras` and `deepinfra`.

- [ ] **Step 2: Write the failing test**

Append inside the existing `describe('openaiCompatAdapter', …)` block in `app/src/lib/ai/__tests__/openai-compat-adapter.test.ts` (or in a sibling describe at the bottom of the file):

```ts
describe('OPENAI_COMPAT_PRESETS — DeepSeek', () => {
  it('includes DeepSeek with the right baseURL + defaults', async () => {
    const { OPENAI_COMPAT_PRESETS, getPreset } = await import('../presets');
    const ds = getPreset('deepseek');
    expect(ds).toBeDefined();
    expect(ds?.name).toBe('DeepSeek');
    expect(ds?.baseURL).toBe('https://api.deepseek.com/v1');
    expect(ds?.docsUrl).toBe('https://api-docs.deepseek.com/');
    expect(ds?.defaultTestModel).toBe('deepseek-chat');
    expect(ds?.supportsAuthProbe).toBe(true);

    // And it must appear in the array (not just the lookup helper).
    const ids = OPENAI_COMPAT_PRESETS.map((p) => p.id);
    expect(ids).toContain('deepseek');
  });
});
```

- [ ] **Step 3: Run test — expect RED**

```bash
cd app
npx vitest run src/lib/ai/__tests__/openai-compat-adapter.test.ts -t "DeepSeek"
```

Expected: FAIL because `getPreset('deepseek')` returns undefined.

- [ ] **Step 4: Append the preset row**

In `app/src/lib/ai/presets.ts`, find the existing entry block. Insert the DeepSeek row alphabetically between `cerebras` and `deepinfra` (or simply after `sambanova` and before `custom` if alphabetical ordering breaks the doc-comment cohesion — match the existing convention as you read it):

```ts
  { id: 'deepseek',   name: 'DeepSeek',   baseURL: 'https://api.deepseek.com/v1',
    docsUrl: 'https://api-docs.deepseek.com/',
    defaultTestModel: 'deepseek-chat', supportsAuthProbe: true },
```

Update the file's header docstring (the one that lists "Sourced 2026-04-18 from official docs" and the OpenAI/Gemini CSP note). Append a single new sentence at the end of the docstring block:

```
 *
 * DeepSeek added 2026-04-30 — browser CORS confirmed via OPTIONS preflight on
 * /v1/chat/completions; their API docs at api-docs.deepseek.com confirm CORS
 * support since 2025-Q3.
```

- [ ] **Step 5: Run test — expect GREEN**

```bash
npx vitest run src/lib/ai/__tests__/openai-compat-adapter.test.ts -t "DeepSeek"
```

Expected: 1 PASS.

- [ ] **Step 6: Run full adapter suite — confirm no regressions**

```bash
npx vitest run src/lib/ai/__tests__/openai-compat-adapter.test.ts
```

Expected: all existing tests still pass.

- [ ] **Step 7: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/ai/presets.ts app/src/lib/ai/__tests__/openai-compat-adapter.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): DeepSeek as direct provider preset

Append DeepSeek to OPENAI_COMPAT_PRESETS with baseURL
https://api.deepseek.com/v1, defaultTestModel deepseek-chat, and
supportsAuthProbe=true. Same trust pattern as Groq / Together /
Fireworks / etc — DeepSeek's API supports browser CORS server-side,
no proxy or middleware needed.

User flow after this commit: settings -> Add provider -> pick
DeepSeek from the preset dropdown -> paste API key -> /v1/models
fetch populates the catalog with deepseek-chat + deepseek-reasoner.

Reasoning-budget fix for deepseek-reasoner ships in the next commit.
EOF
)"
```

---

## Task 2: `patchedFetch` reasoning-budget fix for `deepseek-reasoner`

**Goal:** DeepSeek-reasoner shares OpenAI o-series' reasoning-budget problem (default `max_tokens=4096` consumed by chain-of-thought) but uses plain `max_tokens` (not `max_completion_tokens`) and tolerates `temperature`/`top_p` (no parameter stripping). Add a sibling branch to `patchedFetch`.

**Files:**
- Modify: `app/src/lib/ai/adapters/openai-compat.ts`
- Modify: `app/src/lib/ai/__tests__/openai-compat-adapter.test.ts`

- [ ] **Step 1: Read current `patchedFetch`**

```bash
sed -n '1,80p' app/src/lib/ai/adapters/openai-compat.ts
```

Note the existing `REASONING_MODEL_RE`, `needsCompletionTokensRewrite`, `REASONING_MIN_BUDGET = 32000`, and the `patchedFetch` function body that conditionally rewrites the body for OpenAI reasoning models. You'll add a sibling pattern right after that existing rewrite block.

- [ ] **Step 2: Write failing tests**

Append inside the existing `describe('openaiCompatAdapter', …)` block (or in a new sibling describe `describe('patchedFetch — deepseek-reasoner', …)` at the bottom):

```ts
describe('patchedFetch — deepseek-reasoner', () => {
  it('bumps max_tokens to REASONING_MIN_BUDGET (32000) for deepseek-reasoner', async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn(async (url: any, init: any) => {
      captured.push({ url: url.toString(), init });
      return new Response(JSON.stringify({
        id: 'r', object: 'chat.completion',
        choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop', index: 0 }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;

    const mod = await import('../adapters/openai-compat');
    const adapter = mod.openaiCompatAdapter({
      id: 'openai-compat', instanceId: 'ds-1', name: 'DeepSeek',
      presetId: 'deepseek', baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test', enabled: true
    });
    const model = adapter.resolveModel('deepseek-reasoner');
    await model.doGenerate({
      inputFormat: 'messages',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      maxOutputTokens: 4096
    });

    expect(captured).toHaveLength(1);
    const sentBody = JSON.parse(captured[0].init.body as string);
    expect(sentBody.model).toBe('deepseek-reasoner');
    expect(sentBody.max_tokens).toBe(32000);
    // DeepSeek tolerates temperature/top_p; we don't strip them like OpenAI does
    // for o-series. The test doesn't pass them, so this just verifies the rewrite
    // didn't accidentally swap the field name.
    expect(sentBody.max_completion_tokens).toBeUndefined();
  });

  it('does not modify max_tokens for non-reasoner DeepSeek models', async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn(async (url: any, init: any) => {
      captured.push({ url: url.toString(), init });
      return new Response(JSON.stringify({
        id: 'r', object: 'chat.completion',
        choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop', index: 0 }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;

    const mod = await import('../adapters/openai-compat');
    const adapter = mod.openaiCompatAdapter({
      id: 'openai-compat', instanceId: 'ds-1', name: 'DeepSeek',
      presetId: 'deepseek', baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test', enabled: true
    });
    const model = adapter.resolveModel('deepseek-chat');
    await model.doGenerate({
      inputFormat: 'messages',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      maxOutputTokens: 4096
    });

    expect(captured).toHaveLength(1);
    const sentBody = JSON.parse(captured[0].init.body as string);
    expect(sentBody.model).toBe('deepseek-chat');
    expect(sentBody.max_tokens).toBe(4096); // unchanged
  });
});
```

- [ ] **Step 3: Run tests — expect RED**

```bash
cd app
npx vitest run src/lib/ai/__tests__/openai-compat-adapter.test.ts -t "deepseek-reasoner"
```

Expected: 1 FAIL (`max_tokens` is 4096, not 32000) + 1 PASS (deepseek-chat passes by accident — `max_tokens` is already untouched).

- [ ] **Step 4: Implement the helper + branch**

In `app/src/lib/ai/adapters/openai-compat.ts`, find the existing `REASONING_MODEL_RE` declaration (around line 17) and `needsCompletionTokensRewrite` function. Add the new regex and helper just after them:

```ts
/**
 * DeepSeek-reasoner shares the reasoning-budget problem with OpenAI's o-series
 * (default max_tokens consumed by internal chain-of-thought, empty visible
 * output) but uses plain `max_tokens` rather than `max_completion_tokens`.
 * Bump the floor without swapping the field name. DeepSeek silently ignores
 * unsupported params (temperature, top_p, etc.) so we don't strip them.
 */
const DEEPSEEK_REASONER_RE = /^deepseek-reasoner(?:[-.].*)?$/i;

function needsDeepseekReasonerFloor(modelId: unknown): boolean {
  return typeof modelId === 'string' && DEEPSEEK_REASONER_RE.test(modelId);
}
```

Find the existing `if (needsCompletionTokensRewrite(body?.model))` block inside `patchedFetch`. The block currently rewrites `max_tokens` → `max_completion_tokens`, raises the floor, and strips `temperature`/`top_p`/etc. Just AFTER its closing `}` and BEFORE the line `init = { ...init, body: JSON.stringify(body) };` (note: the existing code mutates `body` in place AND reassigns `init` only if a rewrite happened — so the new branch must follow the same pattern).

Add a sibling `if` block:

```ts
if (needsDeepseekReasonerFloor(body?.model)) {
  if (typeof body.max_tokens !== 'number' || body.max_tokens < REASONING_MIN_BUDGET) {
    body.max_tokens = REASONING_MIN_BUDGET;
  }
  init = { ...init, body: JSON.stringify(body) };
}
```

Both branches are mutually exclusive at the regex level (a model id can't match both regexes), but we write them as independent `if`s rather than `else if` so future reasoning-model patterns can be added without rewiring the chain.

- [ ] **Step 5: Run tests — expect GREEN**

```bash
npx vitest run src/lib/ai/__tests__/openai-compat-adapter.test.ts -t "deepseek-reasoner"
```

Expected: 2 PASS.

- [ ] **Step 6: Run full adapter suite — confirm no regressions**

```bash
npx vitest run src/lib/ai/__tests__/openai-compat-adapter.test.ts
```

Expected: all existing tests still pass — the OpenAI o-series rewrite path is untouched, the new branch only fires for `deepseek-reasoner*`.

- [ ] **Step 7: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/ai/adapters/openai-compat.ts app/src/lib/ai/__tests__/openai-compat-adapter.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): max_tokens floor bump for deepseek-reasoner in patchedFetch

DeepSeek-reasoner shares OpenAI's reasoning-budget problem (default
max_tokens=4096 consumed by internal chain-of-thought, empty visible
output) but uses plain max_tokens, not max_completion_tokens. Add a
sibling branch in patchedFetch that detects the model via
DEEPSEEK_REASONER_RE and bumps the floor to REASONING_MIN_BUDGET
(32000) without swapping the field name or stripping
temperature / top_p / penalty params (DeepSeek tolerates them silently).

Two new tests:
  - deepseek-reasoner with max_tokens=4096 -> bumped to 32000
  - deepseek-chat with max_tokens=4096 -> unchanged

Existing OpenAI o-series + GPT-5 reasoning rewrite path is untouched.
EOF
)"
```

---

## Task 3: Final verification + push

**Goal:** Run the full CI matrix locally + push to origin so auto-deploy fires.

**Files:** none directly modified.

- [ ] **Step 1: Full AI suite**

```bash
cd app
npx vitest run src/lib/ai/__tests__/ 2>&1 | tail -8
```

Expected: all green. Three new tests added (DeepSeek registry + 2 reasoning fixes).

- [ ] **Step 2: Full app suite (sanity)**

```bash
npm run test:unit 2>&1 | tail -8
```

Expected: pre-existing flake count unchanged. No new failures attributable to this work.

- [ ] **Step 3: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 4: Production build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✔ done`.

- [ ] **Step 5: Verification marker**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git commit --allow-empty -m "$(cat <<'EOF'
chore(ai): DeepSeek direct provider verification pass

- adapter suite: green, 3 new DeepSeek tests
- svelte-check: 0 errors
- production build: clean

Manual smoke deferred to user. Settings -> Add provider -> pick
"DeepSeek" -> paste API key -> verify catalog populates with
deepseek-chat + deepseek-reasoner. Then in Chain tab, pick
deepseek-reasoner as orchestrator and confirm refineTurn calls
return real text (not empty due to reasoning-budget exhaustion).
EOF
)"
```

- [ ] **Step 6: Push**

```bash
git push origin master
```

Auto-deploy fires. Watch `https://github.com/m4xx101/cryptex/actions` for the run.

---

## Scope Coverage

| Spec section | Implementing task |
|---|---|
| Section 1 — Preset entry | Task 1 |
| Section 2 — Reasoning-budget fix | Task 2 |
| Section 3 — Tests (3 cases) | Tasks 1 + 2 |
| Section 5 — What's NOT changing | implicit (no other files touched) |

## Self-review verdict

- **Spec coverage:** all functional sections have a task. No gaps.
- **Placeholder scan:** no TBD/TODO/incomplete. Every code block is the literal final content.
- **Type consistency:** `DEEPSEEK_REASONER_RE`, `needsDeepseekReasonerFloor`, `REASONING_MIN_BUDGET` consistent across spec/plan. The preset id `'deepseek'` consistent. Test mock URLs (`https://api.deepseek.com/v1`) consistent.

## Out of scope (deferred from spec)

- `RECOMMENDED_DEFAULTS` updates (explicitly rejected).
- DeepSeek prefix-caching cost optimization.
- UI recommendation badges.
- Function-calling / JSON mode (already inherited via `@ai-sdk/openai-compatible`).
