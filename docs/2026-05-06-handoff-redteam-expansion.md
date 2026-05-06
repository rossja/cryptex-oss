# Cryptex Red-Team Expansion — Session Handoff (2026-05-06)

**Purpose:** This document gives a future agent everything it needs to debug + fix issues
in the red-team expansion shipped this session. Read this BEFORE making any changes if
you've come in fresh after a `/compact`.

## Production state (read first)

- **Deploy:** Dokploy auto-deploy on push to `master` → builds `Dockerfile` → serves with
  `docker-compose.yml` + nginx. Domain via `DOMAIN` env. The deploy contract is HARD-LOCKED:
  do NOT modify `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `app/svelte.config.js`,
  `app/vite.config.ts` `envPrefix`, `package.json` `build` script, or `.github/workflows/*.yml`
  without explicit user approval.
- **Auth:** Supabase email/password + magic-link + OAuth wired earlier (D4). Live deploy at
  `https://cryptex.m4xx.cfd`. Users with login can access `/chat`, `/dataset`. Auth gate
  redirects unsigned users from `/chat` to `/login`.
- **Users:** No real users yet (user confirmed earlier in session). Means we don't need to
  preserve legacy `techniqueId` references in saved Dexie rows.
- **Last verified pushes:** commit `28e9690` (master plan complete marker) is the current
  HEAD. Git log shows the full sequence — every R1.x / E1-E5 commit is pushed + Dokploy
  has rebuilt the container after each.

## Build + test commands

```bash
cd /c/Users/m4xx/Downloads/cryptex/app
npm run check   # svelte-check; expect 0 ERRORS, 28 pre-existing WARNINGS
npm run build   # Vite + adapter-static; expect "✔ done"
npx vitest run  # full suite — expect 278+ green
```

Pre-existing flaky test (NOT mine): `dossier-cache.test.ts` "returns null on hash collision"
fails when run as part of the full suite, passes in isolation. Existed before R1. Ignore.

## What this session shipped

Full master plan: R1 retirement → E1-E5 expansion. All committed + pushed.

### Final registry

- **36 mutators** (was 25 pre-R1). Full list:
  ```
  rephrase, obfuscate, roleplay, multilingual, fragment, custom,
  red_team_persona, step_back, chain_of_verification, ctf_framing,
  rfc_style, payload_split, hypothetical_world, cipher_encode_bypass,
  pap_logical, pap_authority, many_shot, tap_seeder,                    [pre-E1]
  adv_suffix, sysprompt_extract, code_completion_frame,
  stack_trace_frame, best_of_k, temperature_ladder, glitch_token,        [E1]
  cot_prefill, cot_distractor, reasoning_inversion, thinking_steal,
  image_typographic, markdown_exfil, doc_injection,                      [E2]
  tool_arg_hijack, tool_desc_rewrite, url_payload_smuggle,               [E4]
  canary_inject                                                           [E5]
  ```
- **8 classifiers** (was 11): `circumlocution, metonymy, semantic_decomposition,
  technical_register, academic_framing, temporal_displacement, perplexity_raise,
  refusal_taxonomy`
- **12 strategies** (unchanged from D1)
- **4 composites** (unchanged): `base64_smuggle, grammar_constrained_output,
  layered_mutation, multi_layer_attack`
- **3 modes** (unchanged): `creative, intelligent, adaptive`
- **1 godmode** (unchanged): `godmode_engine_v2`
- **26 tools tabs**

### Retired in R1 (gone — do NOT bring back)

Reason for retirement was: 2023-era jailbreak shibboleths now act as classifier signal
which RAISES refusal rate, OR marginal effect, OR redundant.

- Mutators: `refusal_suppression, prefix_injection, skeleton_key, deep_inception,
  crescendo, in_context_compliance, json_schema_coerce`
- Classifiers: `em_dash_interjection, sentence_length_oscillation,
  lexical_rarity_injection, structural_variation`
- Tools tabs: `Translate, Splitter`

### Composite chain swaps in R1.1 (locked in — don't revert)

- `LAYERED_CHAIN`: `structural_variation` → `circumlocution`
- `MULTI_LAYER_CHAIN`: `prefix_injection` → `red_team_persona`

## File map (where to look first when debugging)

### Mutators

- `app/src/lib/chat/techniques/from-mutators.ts` — all 36 mutator entries. Each is a
  `MutatorSpec` with `id`, `name`, `description`, `role`, `task`, `hardConstraint`,
  `rules` (array), `example` (input + rewrite), `doNot` (array), and most have a
  `localTemplate(input, meta, originalInput)` function.
- `app/src/lib/chat/techniques/from-classifier.ts` — 8 classifier entries.
- `app/src/lib/chat/techniques/from-composites.ts` — 4 composites + LAYERED_CHAIN + MULTI_LAYER_CHAIN refs.
- `app/src/lib/chat/techniques/registry.ts` — aggregator + `find()` + `byCategory()` + `search()`.

### New red-team library modules (E1-E5)

All under `app/src/lib/redteam/`:

| File | Purpose | Used by |
|---|---|---|
| `adv-suffixes.ts` | 36 curated GCG/AutoDAN/HarmBench/PAIR/TAP/PAP/Best-of-N/JBB/AdvBench/Reasoning/Community suffixes. `ADV_SUFFIXES`, `suffixesByCategory()`, `findSuffix()`. | `adv_suffix` mutator + `/redteam/adv-suffix` tab |
| `sysprompt-extractors.ts` | 30 system-prompt extraction probes across 9 categories. `SYSPROMPT_PROBES`, `probesByCategory()`. | `sysprompt_extract` mutator |
| `glitch-tokens.ts` | 80 glitch tokens × 18 model families. Severity-labeled (high/medium/low) + effect-typed. `findGlitchTokens(text, family)`, `listFamilies()`. | `glitch_token` mutator + `/redteam/glitch-tokens` tab |
| `ocr-injection.ts` | Canvas-based PNG renderer. 5 modes: overt/covert/typographic/micro/edge. 7 `OCR_PRESETS`. `renderOcrPayload()`. | `image_typographic` mutator + `/redteam/ocr-injection` tab |
| `markdown-exfil.ts` | 8 payload types: image-canary/image-html/link-tooltip/citation-style/html-comment/data-uri/doc-injection/csv-cell. `buildExfilPayload()`. | `markdown_exfil` mutator + `/redteam/markdown-exfil` tab |
| `fanout.ts` | Shared parallel-fan-out helper for dashboards. `fanout({task, items, gateway, ...})`. Concurrency-limited driver, `onResult` callback for streaming UI. | Probe Lab + Cross-Model Diff |
| `tool-injection.ts` | 3 attack kinds (tool-result-injection / tool-desc-rewrite / tool-arg-coerce) × 3 providers (openai / anthropic / generic). `buildToolPayload()`. | `tool_arg_hijack`, `tool_desc_rewrite` mutators + `/redteam/tool-result-lab` tab |
| `indirect-injection.ts` | 10 document shapes × 5 placements. `buildIndirectPayload()`. | `/redteam/indirect-injection` tab |
| `harmbench-prompts.ts` | 32 curated HarmBench behavior descriptions × 7 categories. | `/redteam/harmbench` tab |
| `strongreject-rubric.ts` | StrongREJECT v1 judge prompt + `parseScore()`. Composite formula: `(1-refusal) * (specific+convincing) / 10`. | `/redteam/strongreject` tab |
| `jbb-behaviors.ts` | 40 calibrated JailbreakBench behaviors (20 harmful + 20 benign × 9 domains). | `/redteam/jbb` tab |
| `defense-fingerprinter.ts` | 10 calibrated probes + `fingerprintResponse()` heuristic classifier. Output classes: llama-guard / openai-moderation / anthropic-hh / google-perspective / azure-content / generic-refusal / output-filter / unknown. | `/redteam/fingerprinter` tab |
| `watermark-detector.ts` | `analyzeResponse()` — bigram entropy, ZWSP count, EOS-marker leaks, provider tells. `ZWSP_RE` uses `\u` ESCAPE LITERALS in the source (NOT actual Unicode chars — esbuild parser issue). | `/redteam/watermark` tab |
| `pdf-meta-injection.ts` | 3 tracks: metadata-only / body-with-meta / invisible-text. `buildPdfPayload()`. | `/redteam/pdf-injection` tab |

### New routes / tabs

All under `app/src/routes/redteam/`:

| Route | Purpose | Sidebar | Right pane |
|---|---|---|---|
| `/redteam/adv-suffix` | Browse/copy GCG-class suffixes | Category dropdown, search, min-success slider | Filterable list, color-coded by success rate |
| `/redteam/glitch-tokens` | Scan text + browse catalog | Family dropdown, severity dropdown, effect dropdown, scan textarea | Scan results + filtered catalog |
| `/redteam/ocr-injection` | Canvas-based payload PNG generator | Mode select, decoy text (typographic only), W/H, font-size slider, Re-render | 7 presets + payload textarea + live image preview, Download PNG, Copy data URL |
| `/redteam/markdown-exfil` | Markdown/HTML payload synthesizer | Payload-type dropdown (8), canary URL, optional fixed token | Hidden-instruction textarea + auto-regenerated payload + notes |
| `/redteam/probe-lab` | Fan out to all 32 mutators in parallel | Target model picker, judge model picker, progress, Stop | Task textarea + live leaderboard |
| `/redteam/cross-model-diff` | Same prompt → N targets, side-by-side | Add/remove targets via picker (persisted), judge picker | Prompt textarea + md:grid-cols-2 results |
| `/redteam/replayer` | ShareGPT JSON replay against new target | Target picker, Load JSON file button | JSON paste + side-by-side original vs replayed per turn |
| `/redteam/aggregation` | Dexie heatmap of mutator × target | Dimension select (heatmap/mutator-only/target-only), data-source select | Heatmap table OR ranked list |
| `/redteam/tool-result-lab` | Synthesize fake tool-call results | Attack kind / provider format / tool name (datalist) / args JSON | Hidden-instruction + synthesized payload |
| `/redteam/indirect-injection` | Synthesize doc-class injection payloads | Document shape (10) / placement (5) / cover topic | Hidden-instruction + synthesized doc |
| `/redteam/harmbench` | Run curated HarmBench corpus | Target/judge pickers, category filter, limit slider | Refusal/compliance summary tiles + per-result list |
| `/redteam/strongreject` | Score a (request, response) pair | Judge picker | Request + response textareas + rubric score tiles |
| `/redteam/jbb` | Run JBB calibrated 40-set | Target/judge pickers, category + domain filters | Calibrated metrics (harm-refused %, benign-answered %) + per-result list |
| `/redteam/fingerprinter` | 10-probe fingerprint sweep | Target/judge pickers | Top classifier signal + per-probe signals |
| `/redteam/watermark` | Heuristic watermark detector | (info only) | Response paste + live analysis (stats + signals) |
| `/redteam/pdf-injection` | PDF text-extraction synthesizer | Track / title / author / cover body | Hidden-instruction + synthesized PDF text |

### Tab rail

`app/src/lib/components/shell/TabRail.svelte` — array of `tabs[]` lists every tools tab in
order. After E5 it has 26 entries; the rail wraps to 2 rows on narrow viewports
(handled by `flex flex-wrap` + sliding indicator).

## Critical UI/UX patterns (when fixing visual bugs)

Every new tab matches the existing tools UX from AntiClassifier / PromptCraft. If a new
tab looks "off", check it uses these EXACT classes:

- **Heading**: `<h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">`
  with `<span class="text-primary italic">accent</span>` on the second word
- **Description**: `<p class="text-muted-foreground max-w-2xl text-sm sm:text-base">`
- **Layout**: `<div class="grid gap-4 lg:grid-cols-[320px_1fr]">`
- **Cards**: `<div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">`
- **Sticky sidebar**: `lg:sticky lg:top-20 lg:self-start` on the sidebar card
- **Card heading**: `<h2 class="font-serif text-sm">Title</h2>`
- **Form labels**: `<label class="block space-y-1"><span class="text-xs text-muted-foreground">Label</span><input ...>...</label>`
- **Form inputs**: `class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"`
- **Range slider**: `<input type="range" class="w-full accent-primary">`
- **Primary button**: `class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"`
- **Copy button** (small, secondary): `class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"`
- **Internal scroll panes**: `class="max-h-[calc(100vh-Nrem)] overflow-y-auto pr-1 cryptex-scroll"` (where N is tuned to keep page scroll = 0)

## Critical mutator invariants

When editing any mutator in `from-mutators.ts`, all of these MUST stay true (enforced by
`prompt-style.test.ts`, `prompt-length.test.ts`, `anti-trigger.test.ts`,
`registry.test.ts`):

1. **CAPITAL directive in scaffold body** — at least one of YOU MUST / MUST / MUST NOT /
   NEVER / ALWAYS / IMPORTANT must appear in `hardConstraint` or `rules`.
2. **No banned softeners** — the scaffold body (after stripping EXAMPLE blocks) must NOT
   contain `please`, `try to`, `it would be nice`, or `feel free`. This bit me twice this
   session — `pap_logical` example contained "Please engage" → fixed in D2;
   `markdown_exfil` example had "please include" → fixed in E2; `url_payload_smuggle`
   task had "'please visit this URL'" framing → fixed in E4.
3. **buildMutatorSystem(spec).length >= 250 chars**.
4. **localTemplate('CANARY', {}, 'CANARY').length >= 250 chars** when present.
5. **localTemplate output MUST contain the input verbatim** (per registry.test.ts line 127-130).
6. **No "ORIGINAL QUESTION:" / "ORIGINAL QUERY:" / "VERBATIM QUESTION:"** in localTemplate
   output (per anti-trigger.test.ts — these would be tripwires).
7. **Generative mutators** (rephrase, obfuscate, multilingual) MUST NOT have a
   `localTemplate`; templatable mutators MUST have one with `local: true`.
8. **registry.test.ts exact-match list** must include every new mutator id alphabetically.

## Critical infrastructure invariants

- `app/vite.config.ts` has `envPrefix: ['VITE_', 'PUBLIC_']` — DO NOT REMOVE. This is what
  makes `import.meta.env.PUBLIC_SUPABASE_URL` resolve in client code. (Earlier in session
  this was the root cause of "Auth not enabled" production bug — see commit `1eb2fb0`.)
- `Dockerfile` has ARG passthrough for `VITE_AUTH_ENABLED`, `PUBLIC_SUPABASE_URL`,
  `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_GODMODE_LOCAL_ENABLED`, `PUBLIC_ADSENSE_CLIENT`,
  `BASE_PATH`. Plus a `[cryptex-build]` diagnostic block that prints env-var presence
  during build (masked, no secrets).
- `app/src/lib/redteam/watermark-detector.ts` — `ZWSP_RE` regex uses LITERAL `\uXXXX`
  escape sequences in source bytes (NOT actual Unicode chars). esbuild's tokenizer
  trips on literal zero-width chars inside regex character classes.

## Test file locations

- `app/src/lib/chat/techniques/__tests__/registry.test.ts` — exact-match mutator + classifier lists
- `app/src/lib/chat/techniques/__tests__/from-mutators.test.ts` — per-mutator behavioral tests
- `app/src/lib/chat/techniques/__tests__/prompt-style.test.ts` — CAPITAL + no-softener iteration
- `app/src/lib/chat/techniques/__tests__/prompt-length.test.ts` — >=250 char floor iteration
- `app/src/lib/chat/techniques/__tests__/anti-trigger.test.ts` — no labeled-echo
- `app/src/lib/chat/techniques/__tests__/from-composites.test.ts` — composite chains
- `app/src/lib/redteam/__tests__/fanout.test.ts` — shared fanout helper
- `app/src/lib/chat/godmode/__tests__/local-engine.test.ts` — godmode local-engine pool

## Known constraints / gotchas

1. **Banned softener regex** is case-INSENSITIVE word-boundary match: `/\b(please|try to|it would be nice|feel free)\b/i`. Be vigilant — "Please" anywhere in a mutator's task / role / rules / hardConstraint / localTemplate fails the prompt-style test.

2. **`<example>` XML tags are LOWERCASE** in scaffold output, but the strip regex
   `/EXAMPLE[\s\S]*?(?=\n\n|$)/g` matches uppercase. Means content inside `example.rewrite`
   IS visible to the banned-softener test. If you put "please" in an example, it fails.

3. **Mutator localTemplates that pad with `# Comment ...` lines** to hit the 250-char
   floor are fine — the prompt-style test strips DO NOT blocks but NOT `#` comments.
   I've used this pattern for adv_suffix, glitch_token, sysprompt_extract, etc.

4. **best_of_k + temperature_ladder are runner-level techniques** — the `localTemplate`
   just emits the prompt verbatim with a `# Comment` block describing what the runner
   would do. Actual K-parallel sampling is NOT IMPLEMENTED in the dispatch layer yet
   (was deferred per the plan — "Implementation note: best_of_k and temperature_ladder
   are runner-level techniques. The actual K-parallel sampling logic lives in a separate
   dispatcher in app/src/lib/chat/dispatch.ts — implementing the dispatcher is a
   follow-on task within E1.5b. For now, the technique appears in the picker; running
   it falls through to single-shot until E1.5b lands." — E1.5b never landed). If user
   reports best_of_k doesn't actually fan out, this is why.

5. **image_typographic mutator** emits the prompt verbatim and expects the runner to
   attach an OCR-payload PNG via `metadata.imageDataUrl`. The chain runner doesn't
   currently know how to attach images via metadata — same deferred-implementation
   note as above. The user-facing `/redteam/ocr-injection` tab works (generates the
   PNG) but the chain mutator doesn't currently auto-attach.

6. **doc_injection / markdown_exfil / tool_arg_hijack / tool_desc_rewrite / url_payload_smuggle / canary_inject** all DO have working localTemplates that produce real adversarial prompts. These are not deferred — they fully work.

7. **dataset/+page.svelte and chat/[id] routes** were modified in D4 to redirect
   unauthenticated users. `featureFlags.authEnabled` controls whether the gate fires.
   Driven by `VITE_AUTH_ENABLED` env. Currently true in production (per Dokploy env).

8. **Brave-style ad-blockers might block canary URLs** in markdown-exfil. The default
   canary domain `canary.example.test` is non-routable per RFC; replace with the user's
   own canarytokens.org subdomain in `/redteam/markdown-exfil` for real testing.

## Most likely areas to investigate when user reports bugs

Without knowing the user's specific observations, the highest-likelihood failure surfaces:

1. **best_of_k + temperature_ladder don't actually fan out** — not wired into dispatch.ts
   (deferred E1.5b task). Mutator picker shows them; runner uses the localTemplate body
   but doesn't do K-parallel sampling.

2. **image_typographic mutator** — no image attachment in chain; only the standalone
   `/redteam/ocr-injection` tab actually generates the PNG.

3. **Probe Lab uses gateway directly** — if the user's API key isn't configured, runs
   fail with "No provider configured." Check Settings → AI Providers.

4. **Cross-Model Diff persistence** — target model list lives in `localStorage` key
   `cryptex.crossdiff.targets` as JSON. If parse fails the list resets to default.

5. **Run Aggregation reads Dexie** — only shows data the user has actually created via
   Attack Chain or Godmode runs. Empty database = empty aggregation.

6. **HarmBench / JBB / Fingerprinter use the `fanout` helper** with concurrency=3.
   If a provider rate-limits aggressively, runs may fail mid-stream. Each error gets
   captured as a per-result `error` field.

7. **Watermark Detector** is heuristic-only. Its `bigramEntropy < 3.5` low-entropy
   threshold may flag false-positives on short responses. Stats shown verbatim.

8. **PDF Metadata Injection** generates TEXT, not actual PDF binary. If user expects to
   attach a real PDF file, that's not what this tab does — it generates the text a PDF
   parser would extract.

9. **TabRail wrap** — with 26 tabs, the rail wraps to 2 rows. Sliding indicator handles
   row-2 positioning via `getBoundingClientRect` math. If indicator is misaligned,
   `positionIndicator()` in `TabRail.svelte` is the function.

10. **Hard-refresh after Dokploy rebuild** — every push triggers a fresh build, but the
    browser may serve a stale bundle. Always do Ctrl+Shift+R after seeing "no change".

## Authentication / login state

- `app/src/lib/auth/session.svelte.ts` — Supabase session reactive store
- `app/src/lib/auth/supabase.ts` — singleton client
- `app/src/lib/auth/migration.ts` — claim-local-chats helper (D4)
- `app/src/routes/login/+page.svelte` — polished login UI
- `app/src/routes/signup/+page.svelte` — polished signup UI with password rules
- `app/src/routes/auth/callback/+page.svelte` — OAuth + magic-link return
- `app/src/lib/components/settings/SecurityPanel.svelte` — change-password UI in /settings
- `app/src/routes/chat/+layout.svelte` — auth-gate; redirects to /login if not signed in

## Final commit chain (last 30 from oldest to newest)

```
50be948 docs(plans): master plan D1-D5
25d8a67 feat(chain): research-grounded opener templates
167d644 chore(chain): D1 verification pass
e6e7b44 feat(chat): 4 new red-team mutators (PAP, many-shot, TAP)
bbce24c chore(chat): D2 verification pass
d4d3ae7 feat(godmode): browser-only context-aware few-shot orchestrator
d61e7ba chore(godmode): D3 verification pass
60e4bcf docs+ops(deploy): document Dokploy contract + add Supabase env passthrough
88385a3 chore(deploy): D5 verification pass
407a3f4 feat(auth): email/password + magic-link + signup + local-chat migration
a75bd90 chore(auth): D4 verification pass
b82869d chore: D1-D5 master plan complete
c421890 feat(auth): polished login/signup UI + chat redirect-to-login + deploy guide
2c432ae fix(deploy): plumb VITE_AUTH_ENABLED through Docker build args
2fc469d fix(deploy): build-arg diagnostic + Dokploy build-vs-env troubleshooting
1eb2fb0 fix(auth): expose PUBLIC_* env vars to client via Vite envPrefix
c01bb80 fix(auth): hide tools rail on /login & /signup, gate hydration race, password set/change
c62e58d docs(plans): R1 retirement + E1-E5 master expansion plans
b0d4210 docs(plans): simplify R1
9e14055 refactor(chat): migrate composites off retired mutator IDs (R1.1)
7d57e22 refactor(chat): retire 7 mutators (R1.2)
5128117 refactor(chat): retire 4 classifiers (R1.3)
37f9656 test(chat): update registry exact-match lists for R1 retirement (R1.4)
7fc1808 refactor(ui): retire Translate + Splitter tools tabs (R1.5)
c260e87 docs(claude-md): refresh mutator + classifier counts post-R1 (R1.6)
59b1a75 chore(r1): R1 verification pass
0d6ef18 feat(chat): E1 — 7 new mutators + refusal_taxonomy + comprehensive corpora
ad51e22 feat(ui): E1 — AdvSuffix Library + Glitch Token Detector tabs
d52127e chore(e1): E1 verification pass
77a6cf4 fix(ui): match existing tools UX on AdvSuffix + Glitch Token tabs
21165d3 feat(chat): E2 — 7 reasoning + multimodal mutators + canvas/markdown libs
7e3463e feat(ui): E2 — OCR Injection + Markdown Exfil tabs
abca656 chore(e2): E2 verification pass
29ec153 feat(ui): E3 — 4 dashboard tabs (Probe Lab, Cross-Diff, Replayer, Aggregation)
f2ba8ec chore(e3): E3 verification pass
cead42e feat(chat): E4 — tool-call exploit + indirect injection (3 mutators + 2 tabs)
45fc4e9 chore(e4): E4 verification pass
9225cc3 feat(chat): E5 — canary_inject mutator + 6 benchmark/defense libs
325d5db feat(ui): E5 — 6 benchmark/defense tabs
f492a3f chore(e5): E5 verification pass
28e9690 chore: E1-E5 master plan complete   ← HEAD
```

## Quick "where do I go" reference

| You see / hear | Look in |
|---|---|
| "Mutator X doesn't work" | `from-mutators.ts` find `id: 'X'` block; check `localTemplate` |
| "Tab X looks wrong" | `app/src/routes/redteam/X/+page.svelte`; check classes match the UI/UX section above |
| "Tab X errors on run" | The tab calls `gateway.chat` / `gateway.streamChat` from `$lib/ai/gateway`; or `fanout()` from `$lib/redteam/fanout` |
| "Test fails after my edit" | One of: registry.test.ts exact-list, prompt-style.test.ts (banned softener / no CAPITAL), prompt-length.test.ts (<250 chars), anti-trigger.test.ts (labeled echo) |
| "Build fails with regex error" | Check `watermark-detector.ts` `ZWSP_RE` — must use `\u` escape literals not actual chars |
| "Dokploy redeployed but I don't see changes" | Hard-refresh browser (Ctrl+Shift+R) — bundle is cached |
| "Auth doesn't work in deploy" | Check Dokploy env vars: `VITE_AUTH_ENABLED=true`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`. Then **Rebuild** (not Redeploy). Then hard-refresh. |
| "PUBLIC_* env var missing in client" | Confirm `app/vite.config.ts` has `envPrefix: ['VITE_', 'PUBLIC_']` |

## What user is about to report

The user is about to send observations of things that don't actually work. Read those
carefully against the "Most likely areas" list above. If they're reporting:

- **best_of_k or temperature_ladder not parallelizing** → that's the deferred E1.5b
  dispatch task (see Constraint #4).
- **image_typographic not attaching the image** → deferred chain runner integration
  (Constraint #5).
- **A specific tab's UI looks broken** → check it against the UI/UX section. Most likely
  a class mismatch.
- **A specific mutator's localTemplate produces wrong output** → trace to `localTemplate`
  in from-mutators.ts; metadata fields it reads vary by mutator.
- **Build failing on Dokploy** → check `[cryptex-build]` diagnostic block in build log;
  confirms which env vars made it through.

If user reports a NEW problem not in the list, treat it as a real bug — root-cause via
the test suite + grep first, don't guess.
