# Cryptex 2026 Modernization — Project Status

**Last updated:** 2026-04-18
**HEAD:** `2c2e191` (origin/master)

This file is the durable handoff doc for future sessions — it mirrors `Brainstormed-Plan.md`'s five sub-project roadmap and tracks which are shipped vs outstanding. Read this first when picking up the project to skip the context-rebuild overhead.

---

## Roadmap status

| # | Sub-project | Status | Commits (tip) | Notes |
|---|---|---|---|---|
| 1 | **BYOK Gateway** (OpenRouter + Anthropic-direct + OpenAI-compat) | ✅ **SHIPPED** | 7 commits, tip `30ca94e` | Vercel AI SDK 6 behind unified `chat() / streamChat()` facade. ModelPickerV2 with filter chips + Cmd+M. Progressive-disclosure Settings. |
| 2 | **Prompts & AI-technique overhaul** | 🟡 **NOT STARTED** | — | Independent of #1–#5. Can run any time. Research doc at `.planning/research/brainstorm-prompts.md` has the verbatim rewrites ready. |
| 3 | **Chat Playground + Research Dataset Pipeline** | ✅ **SHIPPED** | 7 commits, tip `2c2e191` | Multi-chat at `/chat`, streaming, branching, attachments (text+PDF+docx+images/multimodal), Technique registry, Dataset Inspector at `/dataset` with ShareGPT + raw JSONL export. |
| 4 | **MCP browser integration** | 🟡 **NOT STARTED** | — | Depends on #3's tool surface (already shipped). Research doc at `.planning/research/brainstorm-mcp.md`. |
| 5 | **WebGPU local models** | 🟡 **NOT STARTED** | — | Depends on #1's gateway provider abstraction (already shipped — just add a `LocalProvider` adapter). Research doc at `.planning/research/brainstorm-webgpu.md`. |

---

## Repository state

- **Branch:** `master` (only branch; atomic-commits-on-master workflow per user preference).
- **HEAD:** `2c2e191`.
- **CI:** `.github/workflows/deploy.yml` auto-builds + publishes `dist/` to GitHub Pages on push. Tests: `npm run test:all`.
- **Key dirs:**
  - `app/` — new SvelteKit 2 + Svelte 5 app (active).
  - `js/`, `css/`, `templates/`, `build/` — legacy Vue 2 app, frozen; will be removed in a future Phase 4.
  - `src/transformers/` — 159 canonical transformers (source of truth for legacy, SvelteKit, and Python CLI).
  - `.planning/` — research docs + codebase scan.
  - `docs/superpowers/specs/` — sub-project design specs.
  - `docs/superpowers/plans/` — per-commit implementation plans.

---

## Sub-project artifacts (pickup-ready)

### Sub-project #1 — BYOK Gateway (SHIPPED)

- **Spec:** `docs/superpowers/specs/2026-04-18-byok-gateway-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-18-byok-gateway-plan.md`
- **Commits:**
  - `e6f83f2` feat(ai): gateway facade + OpenRouter adapter
  - `98998a4` feat(ai): Anthropic-direct adapter
  - `08b06f1` feat(ai): OpenAI-compat adapter + presets + /models discovery
  - `33e45ec` feat(settings): progressive-disclosure provider cards + Add-Provider picker
  - `ccd0264` feat(ai): ModelPickerV2 + capability chips + Cmd+M + recent-5 + free-text
  - `752fd02` refactor(ai): migrate tool callers to gateway; drop legacy shims
  - `30ca94e` docs: multi-provider gateway docs + CSP connect-src update
- **Key modules:** `app/src/lib/ai/gateway.ts`, `$lib/ai/adapters/*`, `$lib/ai/providers.svelte.ts`, `$lib/ai/catalog.svelte.ts`, `$lib/ai/validate.ts`, `$lib/ai/errors.ts`, `$lib/ai/presets.ts`.
- **Supported providers (as of ship):** OpenRouter (default, CORS-open) • Anthropic direct (`anthropic-dangerous-direct-browser-access`) • OpenAI-compat (Groq/Together/Fireworks/DeepInfra/Cerebras/SambaNova/Custom).
- **Not supported (documented):** direct OpenAI, direct Google Gemini — both CORS-blocked from browsers. Users route those models through OpenRouter.
- **Installed SDKs:** `ai@6.0.168`, `@openrouter/ai-sdk-provider@2.8.0`, `@ai-sdk/anthropic@3.0.71`, `@ai-sdk/openai-compatible@2.0.41`.

### Sub-project #3 — Chat Playground + Dataset Pipeline (SHIPPED)

- **Spec:** `docs/superpowers/specs/2026-04-18-chat-playground-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-18-chat-playground-plan.md`
- **Commits:**
  - `d496f3a` feat(chat): top-level mode switch + Chat shell + shadcn primitives
  - `58fbad7` feat(chat): Dexie persistence + repo layer + auth-readiness seams
  - `bfa6976` feat(chat): Technique registry + right sidebar + selection popover
  - `26845a5` feat(chat): streaming + tool-calling + branching
  - `c96b32e` feat(chat): attachments + keyboard map + inline errors
  - `13fd038` feat(chat): Dataset Inspector at /dataset + ShareGPT/raw JSONL export
  - `2c2e191` docs: chat playground + dataset pipeline
- **Key modules:**
  - Routes: `/chat`, `/chat/:id`, `/dataset`.
  - Persistence: `$lib/chat/db.ts` (Dexie `cryptex-chat`), `$lib/chat/repo.ts`, `$lib/tools/repo.ts`.
  - Auth-readiness: `$lib/auth/session.svelte.ts`, `$lib/auth/key-vault.ts` (all rows carry `ownerId` + `updatedAt` + `tombstoned`; login retrofit is a config change).
  - Techniques: `$lib/chat/techniques/registry.ts` wires 159 transformers + 9 mutators + 9 classifier + 3 modes + 1 godmode stub.
  - Dispatch: `$lib/chat/dispatch.ts` handles slash, mode wrap, streaming, tool loop, branching, fork.
  - Dataset: `$lib/dataset/queries.ts`, `$lib/dataset/export-sharegpt.ts`, `$lib/dataset/export-raw.ts`, `$lib/dataset/download.ts`.
- **Shipped features:** multi-chat sidebar with rename/delete/duplicate/bulk-select; Cryptex-branded avatars; streaming via `gateway.streamChat()`; slash commands (9 mutators + `/btw` out-of-context); composer mode pills (Creative/Intelligent/Adaptive as local templates); fork-from-message; selection popover over composer with transform; Cmd+N / Cmd+U / Cmd+M / Cmd+/ / Esc keyboard; attachments (images → multimodal, PDF/docx → extracted text); Dataset Inspector with paging + arrow key nav + liveQuery + ShareGPT + raw JSONL export; rating/thumbs/trainingInclude/tag bulk editing.
- **Deps added:** `dexie@4.0.11`, `ulid@2.3.0`, `svelte-streamdown@3.0.1`, `shiki@1.29.0`, `pdfjs-dist@4.10.38`, `mammoth@1.9.0`, `fake-indexeddb@6.0.0` (dev), plus hand-rolled shadcn-svelte UI primitives against `bits-ui@1.8.0` (CLI couldn't run non-interactive).

### Sub-project #2 — Prompts overhaul (NOT STARTED)

- **Research:** `.planning/research/brainstorm-prompts.md` (922 lines — verbatim rewrites ready).
- **Suggested next step:** create `docs/superpowers/specs/YYYY-MM-DD-prompts-design.md` following the research doc's proposed rewrites, then `writing-plans` for commit cadence. Scope: rewrite PromptCraft (9 strategies), AntiClassifier, AI Translation system prompts. Add `$lib/ai/prompt-scaffold.ts` (`unwrap()` + `tuneParams()`). Per-model-family parameter tuning. Prompt caching hooks.
- **Independent of everything else** — ship anytime.

### Sub-project #4 — MCP browser integration (NOT STARTED)

- **Research:** `.planning/research/brainstorm-mcp.md` (351 lines).
- **Depends on:** Sub-project #3's tool surface (already shipped — slot is ready).
- **Suggested shape:** M1 Settings UI → M2 Streamable HTTP client (no-auth + header-auth) → M3 OAuth 2.1 + PKCE + CIMD → M4 allowlist + confirm-before-call + rate-limit → M5 unified tool gateway merging transformers + MCP + built-in → M6 elicitation modals.

### Sub-project #5 — WebGPU local models (NOT STARTED)

- **Research:** `.planning/research/brainstorm-webgpu.md` (610 lines).
- **Depends on:** Sub-project #1's adapter abstraction (already shipped — just add a `LocalProvider`).
- **Suggested shape:** `@mlc-ai/web-llm` primary runtime → three-tier model picker (Tiny 230 MB / Balanced 2 GB / Power 4.6 GB) → Cache API → first-run download UX → COOP/COEP headers on Dokploy for wllama fallback.

---

## How to pick up a sub-project

1. **Read `Brainstormed-Plan.md`** for the umbrella context (already written).
2. **Read the sub-project's `brainstorm-*.md` research doc** under `.planning/research/`.
3. **Run `/superpowers:brainstorming`** to surface unknowns with the user (if design not yet locked).
4. **Run `/superpowers:writing-plans`** to produce the per-commit plan.
5. **Invoke `superpowers:subagent-driven-development`** to execute commits atomically — one subagent per commit, two-stage review (spec compliance + code quality), user-manual-test gate between each.
6. Follow the atomic-commits-on-master pattern; user verifies in browser before authorizing each `git push`.

The `/gsd-*` workflow commands exist for structured project management but the Cryptex user prefers the lighter `/superpowers:*` flow.

---

## User preferences (carry forward)

- **Branch:** master only, no feature branches.
- **Commit cadence:** atomic commits; user manually verifies in browser before push.
- **Reviews:** spec-compliance + code-quality reviewers dispatched in parallel after each commit.
- **Fixes:** amend the current commit rather than adding "fixup" commits — keeps history clean.
- **Auto-deploy:** `.github/workflows/deploy.yml` fires on push to `master` — the build MUST pass before every push.
- **No emojis** in code/commits unless explicitly asked.
- **Terse, no summaries** in responses — user reads diffs, not prose walkthroughs.
- **Alert on error** in UI surfaces — silent failures are not OK.

---

## Architectural invariants to preserve

1. **BYOK forever.** No server, no proxied keys. All provider calls browser-direct with user-supplied keys in localStorage.
2. **Zero telemetry.** Cryptex ships no analytics beyond the existing Plausible-on-Guide. Chat + dataset stays in IndexedDB, never leaves the browser except to the selected provider.
3. **No Svelte component imports Dexie directly.** All persistence flows through `$lib/chat/repo.ts` or `$lib/dataset/queries.ts` (the only non-repo file allowed to read `db` directly).
4. **Single Technique registry** — 159 transformers + 9 mutators + 9 classifier + 3 modes + godmode — one source of truth (`$lib/chat/techniques/registry.ts`). Adding a new technique is one file.
5. **Auth-readiness seams intact.** Every persisted row has `ownerId: 'local'`. `$lib/auth/session.svelte.ts` is the single identity source. When auth lands, this is the one file that changes + rows already carry the owner.
6. **Build must pass on every push.** Auto-deploy runs immediately.

---

## Known deferrals (explicitly NOT done)

- Sub-project #2 (prompts).
- Sub-project #4 (MCP).
- Sub-project #5 (WebGPU).
- Real-time multi-device sync (architected via `updatedAt` + ULIDs + `tombstoned`; not shipped).
- Login / user management (seams wired; not shipped).
- Godmode jailbreak chains (pipeline scaffolded + disabled).
- `DatasetFilters.svelte` state_referenced_locally rune warnings (13 warnings — cosmetic, deferred).
- Virtualization on Dataset Inspector table (pagination at 50/page replaced it).
- Projects/workspaces hierarchy for chats.
- Branching diff view between forked chats.

---

## Outstanding long-standing diff

`DEPLOY.md` has an uncommitted working-tree change (Cloudflare DNS note, ~9 lines) that the user has kept pending across the entire project. Recently-touched DEPLOY.md commits absorbed parts of it; any future deploy-related commit should consult the user on whether to fold or leave it.

---

## Quick next-step menu

Pick any of:

- **Ship Sub-project #2 (Prompts)** — independent, ~7 files changed, ~2–3 commits.
- **Ship Sub-project #4 (MCP)** — 6 milestones, medium complexity; Streamable HTTP + OAuth 2.1.
- **Ship Sub-project #5 (WebGPU)** — add `$lib/ai/adapters/local.ts` behind `@mlc-ai/web-llm`, wire into Settings as 4th provider.
- **Iterate on Chat UX** — gather user feedback on `/chat` and `/dataset`, cycle smaller polish commits.
- **Legacy Vue removal** — Phase 4 per `CLAUDE.md`; ~12 tool files + 12 templates + build scripts to delete once SvelteKit port is fully parity-verified.
