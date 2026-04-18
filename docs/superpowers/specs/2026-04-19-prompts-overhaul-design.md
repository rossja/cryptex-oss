# Prompts & AI-Technique Overhaul — Design Spec

**Date:** 2026-04-19
**Sub-project:** #2 of `Brainstormed-Plan.md`
**Status:** Draft — awaiting user review
**Research basis:** `.planning/research/brainstorm-prompts.md` (922 lines)
**Depends on:** Sub-project #1 (Gateway) shipped at `30ca94e`, Sub-project #3 (Chat) shipped at `2c2e191`

---

## 1. Goal

Replace every AI system prompt across Cryptex with 2026-current XML-structured prompts, drop 2023-era boosters (Adderall, "GIANT bonus", Monday-in-October, 20-years-of-experience overclaims), add per-model parameter tuning, and expand the technique catalog from 18 to **28 techniques** (10 new strategic additions).

All new and existing techniques must work seamlessly in:
- **Chat** (slash commands like `/rephrase`, composer mode pills, selection popover, techniques sidebar)
- **Tools** (PromptCraft + Anti-Classifier SvelteKit components)

---

## 2. Non-goals

- No UI changes to PromptCraft/Anti-Classifier/Translate beyond adding new techniques to their pickers (the existing SvelteKit components already consume the registry).
- No legacy Vue prompt updates — those files are frozen per the migration plan.
- No retroactive dataset migration — existing chats keep their rows untouched.
- No Godmode chain implementation (separate future phase).
- No new provider integrations.

---

## 3. User decisions locked in brainstorming

| # | Decision | Choice |
|---|---|---|
| Q1 | Scope of new strategies | **B — top 10 new + 18 existing rewrites = 28 total** |
| Q2 | Per-model parameter tuning | **Yes** — `tuneParams()` helper for Gemini/GPT-5/Claude/Gemma |
| Q3 | Output contract | **Yes** — `<rewrite>...</rewrite>` for mutators, `<json>...</json>` for Anti-Classifier, `<translation>...</translation>` for Translate |
| — | Both Tools + Chat | **Yes** — single registry, both surfaces consume it |

---

## 4. Technique catalog (28 total)

### 4.1 Mutators — 9 existing (rewritten) + 5 new = **14 total**

Source: `$lib/chat/techniques/from-mutators.ts` + `app/src/lib/components/tools/promptcraft/strategies.ts`.

**Rewritten from research doc §3.1:**

1. `rephrase` — Every noun phrase + verb + sentence structure differs; intent preserved
2. `obfuscate` — Indirection, euphemism, coded language; meaning recoverable
3. `roleplay` — Academic/research/historical frame (PAP-strongest)
4. `multilingual` — Single low-resource language (Swahili/Vietnamese/Quechua/Welsh/Basque/Tagalog)
5. `expand` — 3–5× original length with concrete detail + constraints
6. `compress` — ≤30% tokens, telegram-style
7. `metaphor` — One sustained allegorical frame
8. `fragment` — 3–5 numbered fragments, individually innocuous, losslessly reconstructable
9. `custom` — User-supplied template

**NEW (5):**

10. `red_team_persona` — Authorized red-team researcher framing with responsible-disclosure context. Research: March 2026 PAP benchmark winner across all frontier models.
11. `step_back` — Derive the general principle first, then apply to the specific case. Research: Google Step-Back Prompting, proven lift on reasoning-heavy tasks.
12. `chain_of_verification` — Draft → list verifying sub-questions → answer each → synthesize corrected final. Research: CoVe beats single-shot on frontier models.
13. `ctf_framing` — Wrap as a CTF challenge the user is designing; lawful research context native to Cryptex's audience.
14. `rfc_style` — Rewrite as RFC-style technical specification; extreme technical register shifts surface features.

### 4.2 Classifier techniques — 9 existing (rewritten) + 3 new = **12 total**

Source: `$lib/chat/techniques/from-classifier.ts` + `app/src/lib/components/tools/anticlassifier/prompt.ts`.

**Rewritten from research doc §3.2:**

1. `circumlocution` — Replace direct terms with descriptive phrases
2. `metonymy` — Substitute related concept for target
3. `semantic_decomposition` — Break concept into physical/functional components
4. `technical_register` — Scientific/medical/legal register shift
5. `academic_framing` — Peer-review research frame (strong 2026 lift)
6. `homoglyph_character_substitution` — Non-Latin visually-identical codepoints
7. `temporal_displacement` — Historical/counterfactual frame
8. `perplexity_raise` — Rarer synonyms + clause-length variance → break AI-detector signals
9. `structural_variation` — Mix clause types, em-dashes, rhetorical questions

**NEW (3):**

10. `lexical_rarity_injection` — Aggressive synonym replacement with Zipf-rank ≤3.5 words. Research: GPTZero v3 perplexity defense.
11. `em_dash_interjection` — Insert em-dashes, parentheticals, rhetorical pivots. Research: breaks uniform AI cadence; increases burstiness metric.
12. `sentence_length_oscillation` — Deliberate short↔long clause variance targeting burstiness ≥0.65 (human baseline).

### 4.3 Composites — 2 new = **2 total**

Per-composite logic lives inline in each technique's `apply()` — they compose other techniques from the registry.

1. `layered_mutation` — Apply 2–3 mutators in sequence. User can pick the layer chain or use the default (academic_framing → perplexity_raise → structural_variation).
2. `grammar_constrained_output` — Force strict JSON/XML/YAML schema output. Useful for downstream machine parsing.

---

## 5. Architecture

### 5.1 `$lib/ai/prompt-scaffold.ts` (new)

Shared utilities used by EVERY technique. Lives in `$lib/ai/` (not `$lib/chat/`) so Tools can consume too.

```ts
// Output wrapper extractor
export const OUTPUT_WRAPPERS = {
  rewrite:     { open: '<rewrite>',     close: '</rewrite>' },
  translation: { open: '<translation>', close: '</translation>' },
  json:        { open: '<json>',        close: '</json>' }
} as const;

export function unwrap(raw: string, wrapper: keyof typeof OUTPUT_WRAPPERS): string;

// Per-model-family parameter defaults
export function tuneParams(modelId: string, task: 'translate' | 'mutate' | 'analyze'): {
  temperature?: number;
  reasoning_effort?: string;
  thinking_level?: string;
};

// Verbatim XML scaffolding for technique prompts
export function scaffold(opts: {
  role: string;
  task: string;
  context?: string;
  rules: string[];
  example?: { input: string; rewrite: string };
  outputWrapper: keyof typeof OUTPUT_WRAPPERS;
}): string;
```

The `scaffold()` helper lets every technique definition be a ~5-line call rather than 30 lines of repeated XML markup.

### 5.2 Technique file layout

All techniques live under `$lib/chat/techniques/` (consumed by Chat's registry AND by Tools via direct import):

```
$lib/chat/techniques/
  from-mutators.ts          ← 14 mutators (9 rewritten + 5 new)
  from-classifier.ts        ← 12 classifier (9 rewritten + 3 new)
  from-composites.ts        ← NEW: 2 composite techniques
  modes/                    ← unchanged (creative/intelligent/adaptive)
  godmode/                  ← unchanged (stub)
  registry.ts               ← add composites source
```

### 5.3 Anti-Classifier system prompt rewrite

Per research doc §3.2 — full replacement for:
- `js/data/anticlassifierPrompt.js` (legacy Vue — will be removed in Phase 4, leave for now)
- `app/src/lib/components/tools/anticlassifier/prompt.ts` (SvelteKit — PRIMARY target)

Drops: Adderall, GIANT bonus, Monday in October, 20-years-experience persona, "MANDATORY OUTPUT RULES" stale items.

Adds: XML structure, single-sentence PAP-framed role, 12 techniques with concrete examples, structured JSON output inside `<json>` tags, CSAM/bioweapons refusal boundary, per-rewrite ranking with evasion_score + semantic_preservation_note.

### 5.4 AI Translation system prompt rewrite

Per research doc §3.3 — canonical single-source-of-truth prompt for:
- `app/src/lib/components/tools/translate/TranslateTool.svelte`
- `app/src/lib/components/tools/decode/DecodeTool.svelte` (translate-to-English button)

Drops: "TranslateGemma translation protocol" phrase on non-TranslateGemma routes.

Adds: XML structure, register rule, auto-detect-language fallback, `<translation>...</translation>` wrapper.

Per-model temperature tuning via `tuneParams()`:
- Gemini 3 Pro/Flash → `temperature: 1.0, thinking_level: 'low'`
- Gemma 3 / Gemini 2.5 → `temperature: 0.2`
- Claude 4.x → `temperature: 0.3`
- GPT-5.x → `reasoning_effort: 'minimal'`

### 5.5 Lexeme analysis integration

Existing `LexemeAnalysis` finds AI-signature Latin-root terms on input. Wire its findings into each tool's prompt `<context>` block so the model knows which terms to target:

```xml
<context>
Pre-analysis identified these AI-signature Latin-root terms that should be replaced or reframed: {FINDINGS_LIST}.
</context>
```

One-line plumbing change per tool; no new LLM calls.

### 5.6 Prompt caching hooks

Pass `providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } }` on:
- Anti-Classifier's ~1500-token static prefix (1-hour TTL to override March-2026 silent 5m default)
- PromptCraft's 14 strategy prefixes (5-min ephemeral — fan-out batches hit)

OpenAI reasoning models auto-cache; no code change.

Per-tool X-Title header suffix for dashboard visibility:
- `Cryptex/PromptCraft/<strategy>-v2`
- `Cryptex/AntiClassifier-v2`
- `Cryptex/Translate-v2`

---

## 6. Integration: Tools + Chat

All 28 techniques land in `$lib/chat/techniques/` → Chat's registry auto-picks them up → slash autocomplete + techniques sidebar + selection popover surface them.

**Tools integration** (zero new UI, leverage existing):

- **PromptCraftTool.svelte** — already imports from the mutator registry; the 5 new mutators appear in the strategy picker automatically. No component changes.
- **AntiClassifierTool.svelte** — uses the new Anti-Classifier system prompt (single line change to `prompt.ts`). Structured JSON output renders as a ranked table (add new UI block in a follow-up if desired; v1 shows raw JSON in the existing textarea).
- **TranslateTool.svelte** — consumes the new `prompt-scaffold.ts::tuneParams()` for per-model temperature.

**Chat integration** (automatic):
- Slash commands → all 14 mutators + `/btw` appear (was 9 + btw = 10 → now 14 + btw = 15).
- Techniques sidebar → 12 classifier + 14 mutators + 2 composites + 3 modes + 1 godmode stub grouped correctly.
- Selection popover → same.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Small models (Gemma 3 4B, Llama 3.2 1B) ignore XML structure | `unwrap()` falls back to raw text if wrapper missing |
| Strict JSON schema rejected by some providers | Fall back to `<json>` tag parsing |
| `tuneParams()` misidentifies a new model family | Conservative default (`temperature: 0.7`) catches unknowns |
| New composite techniques increase total latency | Document: composites are 2–3 LLM calls; user opt-in only |
| Registry file size bloats (14 mutators × ~500 tokens of prompt) | ~7k tokens of prompt data, loaded eagerly — negligible |

---

## 8. Commit cadence

Four atomic commits, user-verified between each:

1. **`feat(ai): prompt-scaffold module + unwrap + tuneParams`** — Create `$lib/ai/prompt-scaffold.ts` with `unwrap()`, `tuneParams()`, `scaffold()`. Tests. No technique changes yet.

2. **`feat(ai): rewrite 9 existing mutators with XML + examples`** — Update `from-mutators.ts` with the verbatim rewrites from research doc §3.1. Each gets `<role>`/`<task>`/`<rules>`/`<example>` structure and `<rewrite>` output wrapper.

3. **`feat(ai): 5 new mutators + 3 new classifier + 2 composites`** — Add `red_team_persona`, `step_back`, `chain_of_verification`, `ctf_framing`, `rfc_style` to mutators. Add `lexical_rarity_injection`, `em_dash_interjection`, `sentence_length_oscillation` to classifier. Create `from-composites.ts` with `layered_mutation` + `grammar_constrained_output`. Register in `registry.ts`. Update classifier group count in sidebar.

4. **`feat(ai): AntiClassifier + Translate system prompt rewrites + tuneParams wiring`** — Replace `AntiClassifierTool.svelte`'s system prompt. Replace `TranslateTool.svelte` + `DecodeTool.svelte` translate prompt. Wire `tuneParams()` for per-model params in all three tools. Wire lexeme analysis into `<context>` blocks. Enable Anthropic prompt caching on long prompts.

---

## 9. Definition of done

- [ ] All 4 commits merged to master, pushed one-by-one after manual verification.
- [ ] `$lib/ai/prompt-scaffold.ts` shipped with ≥5 unit tests (unwrap round-trip, tuneParams per family, scaffold()).
- [ ] 14 mutators + 12 classifier + 2 composites = 28 techniques registered + countable via `byCategory()`.
- [ ] All technique `apply()` functions wrap LLM output in the expected tags and unwrap before returning.
- [ ] PromptCraftTool picker shows 14 strategies.
- [ ] AntiClassifierTool uses the new system prompt with `<json>` wrapper.
- [ ] TranslateTool + DecodeTool use the new translate prompt with `<translation>` wrapper.
- [ ] `tuneParams()` wired in all three tools + Chat's dispatch for mutator slash calls.
- [ ] Chat slash autocomplete shows 14 mutators + `/btw`.
- [ ] Chat techniques sidebar shows Transform/Mutate/Classifier/Composite/Mode/Godmode groups.
- [ ] Anthropic `cache_control: ephemeral ttl: 1h` on Anti-Classifier system prompt.
- [ ] Tests: existing 144 + new ~10 = ~154 pass.
- [ ] Type-check clean. Build succeeds. Auto-deploy safe.

---

## 10. Out-of-scope explicitly

- Godmode chain implementations (stub stays).
- Anti-Classifier UI changes to render ranked-table JSON (raw JSON in textarea for v1).
- Legacy Vue prompt files — frozen.
- New provider-specific features (reasoning effort knobs etc. — only parameter tuning, not new model primitives).
- Dataset retroactive re-tagging with new `modeApplied` values.
- Chat UI changes beyond sidebar group additions.

---

## 11. Next steps

1. User reviews this spec.
2. If approved, invoke `writing-plans` for per-commit plan.
3. Execute 4 commits via subagent-driven-development, manual-test gate + push between each.
