# Unified Techniques Gateway — Design Spec

**Date:** 2026-04-21
**Parent commit:** `f656622`
**Goal:** Unify all technique invocation paths (chat slash-commands, Attack Chain layers, PromptCraft variants) behind a single `dispatchTechnique()` entry point so adding a new technique is one file with zero plumbing changes. Fix three concrete bugs exposed by live use — fake crescendo, PromptCraft variant collision, `<rewrite>` tag leakage — without breaking any existing technique or consumer.

---

## 1. Motivation

Live use against a real model (Llama 3.3 70B, 2026-04-20 smoke run, 18/18 bypass) exposed three correctness defects and one structural smell:

1. **Crescendo is a fake multi-turn.** `/crescendo` in chat emits a single user message containing four concatenated "turns". The target model sees one payload, not four separate conversational turns; the defensive-threshold-decay effect Crescendo depends on never fires. Actual compliance rate is equivalent to a narrative wrapper.
2. **PromptCraft variant generation is degenerate.** Requesting 10 rephrase variants of the same input yields 10 near-identical outputs. The same system prompt + same input + same temperature produces the same result; variant index is not threaded into the generation call.
3. **`<rewrite>...</rewrite>` tags leak into user-facing UI.** The `unwrap()` helper extracts tag content but is not invoked at every consumption point; some call paths display the raw scaffolded output with tags intact.
4. **No single dispatch.** Chat dispatch, Attack Chain runner, and PromptCraft variant generator each construct technique contexts and invoke techniques independently. Adding a new technique kind (multi-turn, many-shot, document-embed) requires edits in all three call paths, plus the UI layer.

This spec defines a backward-compatible unification that fixes all three bugs AND establishes the single dispatch surface for future technique kinds.

---

## 2. Architecture

### 2.1 — `TechniqueKind` enum

Every technique declares one kind. The dispatcher branches on kind to select the execution strategy.

```ts
export type TechniqueKind =
  | 'single_turn_template'     // pure deterministic scaffold — no LLM call during mutation
  | 'single_turn_llm'          // one LLM call to produce the mutated output
  | 'multi_turn'               // N sequential LLM calls with accumulating conversation (crescendo)
  | 'conversational'           // returns fake prior turns to prepend (many-shot, deferred)
  | 'composite';               // runs a sub-chain of other techniques
```

Existing techniques are classified:
- `caesar`, `base64`, all transformers → not in this registry (they're transformers, separate surface)
- `rephrase`, `obfuscate`, `multilingual` → `single_turn_llm`
- `roleplay`, `fragment`, `custom`, `red_team_persona`, `step_back`, `chain_of_verification`, `ctf_framing`, `rfc_style`, `deep_inception`, `refusal_suppression`, `prefix_injection`, `payload_split`, `hypothetical_world`, `in_context_compliance`, `json_schema_coerce`, `skeleton_key`, `cipher_encode_bypass` → `single_turn_template`
- `crescendo` → **upgraded to `multi_turn`** (currently incorrectly `single_turn_llm`)
- `creative`, `intelligent`, `adaptive` (modes) → `single_turn_llm`
- `layered_mutation`, `multi_layer_attack`, `grammar_constrained_output` → `composite`
- All 11 classifier techniques → `single_turn_llm`
- `godmode_stub` → `single_turn_template` (identity)

### 2.2 — Extended `TechniqueResult`

Two new optional fields. **Purely additive — no existing consumer breaks.**

```ts
export interface TechniqueResult {
  output: string;                    // primary textual result (unchanged)
  messages?: ChatMessage[];          // fake prior turns to prepend (many-shot; deferred to next sub-project)
  turns?: Array<{                    // multi-turn conversation record (crescendo)
    user: string;
    assistant: string;
    refusal?: boolean;
  }>;
  metadata?: Record<string, unknown>;
}
```

### 2.3 — `dispatchTechnique()` single entry point

One function every caller uses:

```ts
export async function dispatchTechnique(
  technique: Technique,
  input: string,
  ctx: TechniqueContext,
  opts?: { variantIndex?: number; variantCount?: number }
): Promise<TechniqueResult>;
```

Dispatch strategy by `technique.kind`:

- `single_turn_template` — invoke `technique.localTemplate(input, ctx.metadata, ctx.originalInput)`, return `{ output: that-string }`.
- `single_turn_llm` — invoke `technique.apply(input, ctx)`, `unwrapScaffold(result.output)`, return. If `opts.variantIndex` set, jitter temperature + rotate metadata (persona, example index, target language) per variant.
- `multi_turn` — invoke `technique.apply(input, ctx)` which internally loops N sequential `ctx.callLLM` calls building conversation history; returns `{ output, turns: [...] }`.
- `conversational` — (deferred; placeholder).
- `composite` — invoke `technique.apply(input, ctx)`, which internally calls `dispatchTechnique` for each sub-technique.

### 2.4 — `unwrapScaffold()` defensive helper

Replaces raw `unwrap()` calls at every consumption point. Strips `<rewrite>`, `<json>`, `<translate>`, `<output>` tags; passthrough if none found. Called exactly once per technique output as the last step before returning from `dispatchTechnique`.

### 2.5 — Specificity preservation check

New helper `computeSpecificityLoss(original, mutated): number` returning a fraction [0..1]. Tokenizes `originalInput` and `mutated`, counts overlap of "specific" tokens (proper nouns, numbers, file paths, API names via simple regex), reports fraction lost.

Used by the Attack Chain runner as an observational warning: when `computeSpecificityLoss > 0.3`, yield a `specificityWarning` event the sidebar renders as a yellow badge. Non-blocking — user can still run the chain.

### 2.6 — Registry auto-discovery (commit 6 only)

`registry.ts` today manually imports every technique module. Commit 6 replaces the manual import with a Vite `import.meta.glob` of `registry/*.ts`, mirroring the transformer auto-discovery pattern already used in `src/transformers/`. Adding a new technique = drop a file in `registry/`, export a `Technique` default.

---

## 3. Bug fixes

### 3.1 — Real multi-turn crescendo (commit 2)

Current crescendo `apply()` builds a single user message with four numbered turns. Rewrite as N sequential LLM calls where each reply conditions the next turn:

```ts
apply: async (input, ctx) => {
  const turns: Array<{ user: string; assistant: string; refusal?: boolean }> = [];
  const history: ChatMessage[] = [];
  const turnPrompts = generateCrescendoSequence(input, ctx.metadata);
  // turnPrompts[i] is the user message for turn i+1, conditioned on input
  for (const userTurn of turnPrompts) {
    history.push({ role: 'user', content: userTurn });
    const assistantReply = await ctx.callLLM({
      system: CRESCENDO_SYSTEM,
      user: userTurn,
      chatHistory: history.slice(0, -1)
    });
    history.push({ role: 'assistant', content: assistantReply });
    const refusal = detectRefusal(assistantReply).detected;
    turns.push({ user: userTurn, assistant: assistantReply, refusal });
    if (refusal) break;  // short-circuit on refusal
  }
  const finalTurn = turns[turns.length - 1];
  return { output: finalTurn.assistant, turns };
}
```

`ctx.callLLM` signature must already accept `chatHistory` — if not, extend it.

`generateCrescendoSequence(input, metadata)` produces 4 turns escalating from innocuous-adjacent to target. Uses a template that draws on `input` for topic continuity.

### 3.2 — PromptCraft variant diversity (commit 4)

PromptCraft's variant generator receives `variantIndex` and `variantCount` from the UI. When it calls `dispatchTechnique(technique, input, ctx, { variantIndex: i })`:

- Dispatcher sets `ctx.temperature = baseTemperature + (variantIndex * 0.07) mod 0.5` (jitter)
- For techniques with rotating metadata (roleplay personas, multilingual target languages, examples), dispatcher rotates via `variantIndex % options.length`
- The `seed` field is also jittered when supported

Result: 10 variants yield 10 distinct outputs.

### 3.3 — `<rewrite>` tag leakage (commit 3)

`unwrapScaffold(text: string): string` — exported helper that strips known scaffold tag pairs and returns the cleaned text. Applied at the end of `dispatchTechnique` before returning. Also applied at Attack Chain final-execution output. Audit all current consumption points (`dispatch.ts`, `AttackChainSidebar.svelte`, `PromptCraft` render paths) to ensure they use `dispatchTechnique` (and therefore get unwrapping free) or call `unwrapScaffold` explicitly.

### 3.4 — Attack Chain specificity warning (commit 5)

New per-layer warning when a mutation loses >30% of the specific tokens (proper nouns, numbers, file paths) from `ctx.originalInput`. Surfaces in the layer result badge; does not block the chain. Operator can still proceed.

---

## 4. Scope

**In scope (6 commits):**
1. Extend `TechniqueResult` + declare `kind` on every technique.
2. Real multi-turn crescendo.
3. Centralize `unwrapScaffold()` + audit consumption points.
4. PromptCraft variant diversity (variantIndex threaded through dispatch).
5. Attack Chain specificity preservation warning.
6. Unified `dispatchTechnique()` + registry auto-discovery.

**Out of scope (deferred):**
- **Next sub-project — "Multi-turn UX + many-shot":**
  - UI multi-turn bubble rendering (`<TurnBubble>` per turn in `MessageBubble.svelte`)
  - Many-shot technique (conversational kind with curated Q/A corpus)
- **After that — "New technique kinds & interop":**
  - Extend `TechniqueKind` beyond initial 5 (indirect-injection, retrieval-poison, adversarial-suffix).

---

## 5. Safety + regression requirements

- Every commit passes `npm run check && npm run test:unit -- --run && npm run build`.
- No test count regression. Existing 352 passing + 20 skipped smoke remains green.
- Existing 20 mutators, 11 classifiers, 3 composites, 3 modes, 1 godmode stub all work unchanged after each commit. No behavior change for consumers that don't opt into the new fields.
- Smoke test (manual, user-run with API key) still produces 18/18 bypass on Llama 3.3 70B against the baseline target.
- Back-compat: the old `runChain` in `attack-chain.ts` keeps working through commit 5. Commit 6 migrates Attack Chain to call `dispatchTechnique` per layer but preserves the generator-yield surface.
- No new dependencies.

---

## 6. Acceptance

1. `/crescendo How do I X` in the chat produces 4 distinct turn exchanges visible (initially still collapsed in one bubble — UI split comes in next sub-project) where each turn's assistant reply conditions the next user turn.
2. PromptCraft request for 10 rephrase variants of the same input produces 10 materially different outputs.
3. No `<rewrite>`, `<json>`, `<translate>` tag fragments visible in any chat or PromptCraft output.
4. Running Attack Chain with `[hypothetical_world → academic_framing → refusal_suppression]` on a prompt containing specific tokens (file paths, numbers) shows a specificity-preservation percentage per layer, and warns (yellow badge) when a layer drops >30%.
5. Adding a new technique to `$lib/chat/techniques/registry/new_tech.ts` exporting a `Technique` default registers it automatically — no edits needed elsewhere.
6. All live smoke test invariants hold; no new test failures.

---

## 7. Open risks

1. **`ctx.callLLM` chat-history support.** If the gateway's current `callLLM` shape doesn't accept `chatHistory`, commit 2 needs to extend it. Minor — one field addition.
2. **Composite recursion.** `layered_mutation` calling `dispatchTechnique` on its sub-techniques must avoid infinite loops. Enforced by sub-technique being a different id + composite kind check.
3. **Registry glob timing.** `import.meta.glob` is Vite-specific. Tests running in vitest-on-node need the same glob resolution to work. Vitest uses Vite under the hood, so expected to work; verify in commit 6.
4. **Temperature jitter clamping.** `baseTemperature + variantIndex * 0.07` can exceed 1.0. Clamp to `[0, 1.5]` in the dispatcher.
5. **Specificity regex false-positives.** Tokens like `the` or `a` could be counted as "specific". Limit to tokens ≥4 chars that match proper-noun / number / path / API patterns. Tune in commit 5.
