# Cryptex 2026 Modernization — Project Status

**Last updated:** 2026-04-19
**HEAD:** `f57db05` (origin/master)

Durable handoff doc. Mirrors the five-sub-project roadmap and tracks what's shipped vs outstanding. Read this first when resuming.

---

## Roadmap status

| # | Sub-project | Status | Tip SHA | Notes |
|---|---|---|---|---|
| 1 | **BYOK Gateway** | ✅ SHIPPED | `30ca94e` | Vercel AI SDK 6 behind unified `chat() / streamChat()`. OpenRouter, Anthropic direct, OpenAI-compat (Groq/Together/Fireworks/DeepInfra/Cerebras/SambaNova/Custom + OpenAI + Gemini presets). |
| 2 | **Prompts & AI-technique overhaul** | ✅ SHIPPED | `f1f705b` | 17 local-template mutators, 4 LLM-generative, 11 classifiers, 3 composites. FALLBACK_ORDER + auto-retry + Attack Chain sidebar + presets. Guide + technique-catalog + orchestrating-jailbreaks playbook + recipes. |
| 3 | **Chat Playground + Dataset Pipeline** | ✅ SHIPPED | `f57db05` | Multi-chat, streaming, attachments (image/PDF/DOCX), Dataset Inspector with truncation + mode filters, ShareGPT + raw JSONL export, Attack Chain persistence + run history + custom presets. |
| 4 | **MCP browser integration** | ⬜ Not started | — | Research at `.planning/research/brainstorm-mcp.md`. Tool surface from #3 already wired. |
| 5 | **WebGPU local models** | ⬜ Not started | — | Research at `.planning/research/brainstorm-webgpu.md`. Gateway adapter abstraction from #1 already wired. |

---

## Commit log since last status update

Every commit after the original handoff (`2c2e191`), chronological on `master`:

**Sub-project #2 — Prompts overhaul:**
- `5d303c9` prompt-scaffold module
- `da2f5a0` 5 new mutators + 3 classifiers + 2 composites (rev 1)
- `742b912` AntiClassifier + Translate rewrites + tuneParams
- `a87e710` 2026 technique catalog overhaul
- `8e39b26` Attack Chain UI (layered attack)
- `bc14c0f` technique enhancement pass + searchable pickers
- `409868d` Attack Chain right-drawer + per-layer metadata + refusal detection
- `1c642e6` copy button + language label on code blocks
- `df0b346` scroll/composer/preset/highlight regressions from attack-chain sidebar
- `1473d45` Chain button neutral default + Combobox in Attack Chain
- `3f87594` context-aware Chat + Tools + Attack Chain guide
- `a8745d0` code block blends with light mode
- `4519fb1` persistent preset trigger + unified slash-command preview
- `e801796` Attack Chain executes final prompt + injects as assistant reply
- `a8777ff` / `9c3a549` max_tokens default (briefly 8192, reverted to undefined)
- `9cdfbe0` unified NoProviderBanner across tools + chat
- `e0798da` auto-retry layers on refusal + composer resize on insert
- `cb3162b` CORS proxy template + actionable error banner (later scrubbed for SaaS)
- `1ef7a2b` Attack Chain response truncation + full DB logging
- `8948728` stop mislabeling openai-compat probe failures as CORS
- `9bbd2d2` widen CSP connect-src to allow BYOK multi-provider hosts
- `e3027a7` add OpenAI + Gemini presets; overhaul CORS/CSP and chat guides
- `216f8e0` scrub self-host surfaces from user-facing guide (SaaS pivot)

**Post-Prompts polish + pipeline integrity:**
- `5b4f6bb` guide rewrite: technique depth + jailbreak orchestration playbook
- `60502d9` align technique implementations to the catalog
- `a44fcb1` local-template execution for templatable Attack Chain layers
- `f1f705b` production-grade system prompts across every technique
- `7d9c3d7` themed scrollbar on guide sidebar
- `65516d2` ModePill reconciles with current URL
- `438e649` pipeline integrity: max_tokens floor, continue-on-truncation, in-list streaming, truncated flag
- `cf90f57` reasoning copy button + dataset truncation/mode filters + dispatch audit
- `f57db05` Attack Chain persistence, run history, custom presets

---

## Repository state

- **Branch:** `master` only; atomic-commits-on-master.
- **HEAD:** `f57db05` (pushed to origin).
- **CI:** `.github/workflows/deploy.yml` builds + publishes on push.
- **Key dirs:**
  - `app/` — SvelteKit 2 + Svelte 5 app (active production).
  - `js/`, `css/`, `templates/`, `build/` — legacy Vue 2, frozen; Phase 4 removal deferred.
  - `src/transformers/` — 162 canonical transformers (source of truth for legacy, SvelteKit, CLI).
  - `docs/superpowers/` — specs + plans.
  - `docs/infrastructure/` — internal engineering notes (CORS/CSP reference).
  - `infra/cors-proxy/` — internal-use Cloudflare Worker template (not user-facing).
  - `.planning/` — research docs + codebase scan.

---

## Active app surfaces (pickup reference)

### Chat (`/chat`, `/chat/:id`)
- Multi-provider streaming via `$lib/ai/gateway.ts`
- Mode pills (Creative / Intelligent / Adaptive)
- Slash commands: 24 mutator+composite + `/btw`
- Unified `SlashCommandBlock` collapsible in user bubble
- Attachments: image (multimodal), PDF (pdfjs-dist), DOCX (mammoth)
- Fork, copy, reasoning with copy button, truncation banner with Continue action
- In-list streaming bubble (no layout jump on turn finish)
- `truncated?: boolean` persisted on every assistant row

### Attack Chain (right drawer)
- 2-4 layer pipeline, searchable Combobox pickers
- Per-layer metadata params (roleplay.persona, ctf_framing.*, hypothetical_world.*, cipher_encode_bypass.transformerId, layered_mutation.chain)
- Execute toggle + final-turn system prompt (isolated from chat history)
- Auto-retry on refusal via curated 17-technique `FALLBACK_ORDER`
- Preview final prompt (dry run)
- Edit intermediate output + re-run from here
- **Two send-back flows** — assistant-reply injection (via `injectAttackChainTurn`) or composer insert; drawer stays open after either
- **Drawer state persistence** — debounced 500ms to `chat.settings.attackChainConfig`
- **Run history** — Dexie `attackChainRuns` table; HistoryPanel in drawer with Restore/Delete
- **Custom presets** — `cryptex.chain.customPresets` in localStorage; PresetPicker merges built-in + custom with trash-delete

### Tools
- Transform (162 transformers)
- PromptCraft (full-registry searchable Combobox; `applyTechniqueForVariant` routes local-template picks correctly)
- AntiClassifier (XML-scaffolded metric-targeting JSON output)
- Translate (multilingual bypass, low-resource language presets)
- Decode (universal decoder)
- Emoji steganography
- Gibberish / Fuzzer / Bijection / Splitter / Tokenade / Tokenizer

### Dataset Inspector (`/dataset`)
- liveQuery paginated table
- Filters: search, role, truncated-only, modeApplied dropdown (persistent via `createPersistedState`)
- ShareGPT JSONL + raw JSONL export
- Per-chat export JSON

### Guide (`/guide`)
- Context-aware header link (from `/chat` → chat-basics; from tool routes → tool entry)
- Chat category: chat-basics, slash-commands, technique-catalog (hero), orchestrating-jailbreaks (playbook), attack-chain (UI ref), attack-chain-recipes (4 worked examples), refusal-troubleshooting (decision tree keyed to refusal regex)
- Tools category: transform, promptcraft, anticlassifier, decode, emoji, translate
- Recipes: layered-encoding, unicode-evasion, jailbreak-bank
- Policy: faq, privacy
- Themed scrollbar on sidebar nav

### Settings
- Providers: OpenRouter, Anthropic, OpenAI-compat (presets: Groq, Together, Fireworks, DeepInfra, Cerebras, SambaNova, OpenAI, Gemini, Custom)
- `Save without verification` fallback when probe fails with network/cors/unknown
- Per-chat sampling knobs

---

## User preferences (carry forward)

- **Branch:** `master` only.
- **Commit cadence:** atomic; user manually verifies in browser before push.
- **Fixes:** amend when possible; separate commit when amend would touch unrelated territory.
- **Auto-deploy fires on every push** — build MUST be green before push.
- **No emojis** in code/commits.
- **Terse responses**, no prose walkthroughs.
- **Alert-on-error** in UI — no silent failures.

---

## Architectural invariants

1. **BYOK forever, zero telemetry** — all provider calls browser-direct with user-supplied keys in localStorage.
2. **No Svelte component imports Dexie directly** — all persistence through `$lib/chat/repo.ts` or `$lib/dataset/queries.ts`.
3. **Every Dexie write** uses `JSON.parse(JSON.stringify(...))` to strip Svelte 5 `$state` proxies (except `saveAttachment` which field-constructs to preserve `Blob` refs).
4. **Single Technique registry** — `$lib/chat/techniques/registry.ts` is the one source of truth. Adding a technique is one file.
5. **Auth-readiness seams intact** — every row carries `ownerId` / `updatedAt` / `tombstoned`. When auth lands, only `$lib/auth/session.svelte.ts` changes.
6. **Per-message `providerOptions`** on `ChatMessage` for Anthropic `cache_control`.
7. **Build must pass on every push** — auto-deploy runs immediately on `master`.
8. **SaaS posture** — no self-host surfaces in user-facing guide. Internal infra docs live in `docs/infrastructure/`.

---

## Known deferrals

- **Sub-project #4 (MCP browser integration)** — research ready.
- **Sub-project #5 (WebGPU local models)** — research ready.
- **Legacy Vue Phase 4 removal** — pending SvelteKit parity signoff.
- **Real-time multi-device sync** — seams present (ULIDs, `updatedAt`, `tombstoned`); server not built.
- **Login / user management** — seams wired (`$lib/auth/session.svelte.ts`); auth provider not integrated.
- **Chat transcript virtualization** — deferred; paginated view handles the common case.
- **Projects/workspaces hierarchy** for chats.
- **Branching diff view** between forked chats.
- **`DatasetFilters.svelte` rune warnings** — cosmetic, 19 state_referenced_locally warnings.
- **`DEPLOY.md` uncommitted tweak** — long-standing working-tree edit; absorbed partially in recent deploy commits.

---

## Quick next-step menu

- **A.** Start Sub-project #4 MCP — brainstorm → spec → plan → ship.
- **B.** Start Sub-project #5 WebGPU — brainstorm → spec → plan → ship.
- **C.** Legacy Vue Phase 4 removal pass.
- **D.** Virtualization for long chats (if user reports performance pain).
- **E.** Auth v2 (swap `session.svelte.ts` + `key-vault.ts` for real identity).
- **F.** Godmode jailbreak chains (pipeline scaffolded + disabled).

`/superpowers:brainstorming` → `/superpowers:writing-plans` → `superpowers:subagent-driven-development` is the canonical flow for any new sub-project.
