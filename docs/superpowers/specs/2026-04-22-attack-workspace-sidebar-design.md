# Attack Workspace Sidebar — Design

> Unify the Chain + Godmode drawers into one right sidebar with tabbed switching, per-tab persistent state, per-tab model pickers independent of main chat, and per-run "promote to main chat" actions. Folds in the F1.3 Godmode UI polish.

**Parent threads:**
- Subsystem A (Godmode engine v2) — shipped: [`2026-04-22-godmode-engine-v2-design.md`](./2026-04-22-godmode-engine-v2-design.md)
- Subsystem B (Prompt synthesizer) — shipped: [`2026-04-22-prompt-synthesizer-design.md`](./2026-04-22-prompt-synthesizer-design.md)
- Godmode follow-ups (F1.3 polish absorbed here): [`2026-04-22-godmode-engine-v2-followups.md`](../plans/2026-04-22-godmode-engine-v2-followups.md)

## Problem

Two drawers (`AttackChainSidebar`, `GodmodePanel`) mount as independent siblings of the chat column. Clicking both buttons stacks two 440px drawers side-by-side. Godmode has zero persistence — closing the drawer drops the task + events. Neither drawer can pick its own model (Chain uses the main chat's model implicitly; Godmode has a raw text input). There is no first-class way to "keep" a Chain/Godmode run in the main chat timeline.

Users wanted: **one sidebar, two tabs, persistent per-tab state and history, independent model pickers, one-click promotion of any run into the main chat for a "persistent jailbroken chat" experience.**

## Locked decisions

| # | Question | Decision |
|---|---|---|
| D1 | Unification shape | **Shared shell, independent bodies + Godmode polish** (fold F1.3) |
| D2 | Persistence scope | **Full per-chat run history** (form config + all successful candidates + winner). New Dexie `godmode_runs` table; extend `chat.settings` with `godmodeConfig`, `workspaceTab`, `workspaceOpen` |
| D3 | Model picker | **One picker per tab**, independent from main chat and from each other. Defaults to `chat.modelQualifiedId` on first open; user-picked model persists to the tab's config. Separate `recentsKey` per tab. |
| D4 | Promote-to-main | **Single-run promote** (one run → one user+assistant pair). Winner row promotes winner; expanded candidate sub-rows promote individual non-winners. No auto-mode-switch. |
| D5 | History row shape | **Winner + all successful candidates**. Failed candidates excluded. Capped at last 50 rows per chat. |

## Architecture

### One new component: `AttackWorkspaceSidebar.svelte`

Replaces `AttackChainSidebar` + `GodmodePanel` as the thing `ChatWorkspace` mounts. Owns:

- **Shell chrome** — sticky header, tab strip (`Zap Chain` | `Sparkles Godmode`), active-tab model picker, close button.
- **Tab-state orchestration** — `activeTab: 'chain' | 'godmode'`, persisted in `chat.settings.workspaceTab`. Inactive tab stays mounted (`hidden` attribute) so in-flight runs + form state survive tab switches without special wiring.
- **Per-tab unread dot** — when a run completes on the non-active tab, a small dot appears on that tab's label until focus.
- **Open/close persistence** — `chat.settings.workspaceOpen` restores state across chat-reopens.

### Two extracted tab components

- `AttackChainTab.svelte` — the current `AttackChainSidebar.svelte` internals, minus the shell (header/close already in workspace shell). Behavioral changes: reads its model from `chat.settings.attackChainConfig.modelQualifiedId` with fallback to `chat.modelQualifiedId`.
- `godmode/GodmodeTab.svelte` — the current `godmode/panel.svelte` internals, rebuilt to production grade per F1.3 polish: structured candidate rows, winner card, history list, status strip, K pills, keyboard Run shortcut, empty state.

### New helper — `injectGodmodeTurn`

In `dispatch.ts`, mirrors `injectAttackChainTurn`. Writes a `user` + `assistant` message pair to the main chat with:
- `modeApplied = '__godmode__'`, `tags = ['godmode']`
- `toolCalls = [{ source: 'godmode', toolName: 'dna', input: { dna }, output: winningResponse, durationMs }]`
- `modelRequested = godmodeCfg.modelQualifiedId`

Consumed by the "Send to main chat" action in `GodmodeTab` history rows and per-candidate sub-rows.

### Button wiring

`ChatHeader` keeps **both** buttons (Chain, Godmode) but both now dispatch `chat:open-workspace` with a `tab` detail:
- `chat:open-workspace {tab: 'chain'}` from Chain button
- `chat:open-workspace {tab: 'godmode'}` from Godmode button

`ChatWorkspace` listens to the new event, opens the sidebar, sets `activeTab` from the detail. Legacy `chat:open-attack-chain` / `chat:open-godmode` events are removed (only call sites are the two buttons + tests).

## Data shape changes

```ts
// app/src/lib/chat/types.ts — extend ChatSettings
interface ChatSettings {
  /* existing fields unchanged */
  workspaceTab?: 'chain' | 'godmode';
  workspaceOpen?: boolean;
  attackChainConfig?: AttackChainConfig;      // now accepts modelQualifiedId
  godmodeConfig?: GodmodeConfig;               // NEW
}

// extend AttackChainConfig (existing) with one optional field
interface AttackChainConfig {
  /* existing fields unchanged */
  modelQualifiedId?: string;
}

// NEW
interface GodmodeConfig {
  task: string;
  K: 3 | 6 | 12;
  modelQualifiedId?: string;
  saveForm: { expanded: boolean; name: string; decompose: boolean };
}

// NEW Dexie row + table
interface GodmodeRunRow {
  id: string;
  ownerId: string;
  chatId: string;
  createdAt: number;
  task: string;
  K: 3 | 6 | 12;
  modelId: string;
  winner: { dna: DnaTuple; response: string; score: number; tier: RefusalTier };
  candidates: Array<{ dna: DnaTuple; response: string; score: number; tier: RefusalTier }>;
  updatedAt: number;
  tombstoned?: boolean;
}
```

Dexie schema bump: `version 5 → 6` adds `godmode_runs: '&id, chatId, ownerId, updatedAt, tombstoned'`.

`repo.ts` additions:
- `listGodmodeRuns(chatId: string, limit = 50): Promise<GodmodeRunRow[]>`
- `saveGodmodeRun(row: NewGodmodeRunRow): Promise<GodmodeRunRow>`
- `deleteGodmodeRun(id: string): Promise<void>`

All maintain `ownerId`, `updatedAt`, `tombstoned` — auth retrofit is a config change, not a rewrite.

## Persistence triggers

| Event | Write target | Latency |
|---|---|---|
| Tab change | `chat.settings.workspaceTab` | immediate |
| Open/close sidebar | `chat.settings.workspaceOpen` | immediate |
| Form input (task, K, model, save-form fields) | `chat.settings.{chain,godmode}Config` | 500ms debounce |
| Run completion (Chain) | existing `attack_chain_runs` table | at completion |
| Run completion (Godmode) | `godmode_runs` table | at `winner` event |

History is rehydrated from Dexie on mount, not from `chat.settings`. `chat.settings` only persists in-flight form state.

## Per-tab model picker

Single `ModelPickerV2` instance in the sticky header, bound to `activeTab === 'chain' ? chainCfg.modelQualifiedId : godmodeCfg.modelQualifiedId`, with fallback to `chat.modelQualifiedId` if null. Separate `recentsKey` per tab (`cryptex.workspace.chain.recentModels`, `cryptex.workspace.godmode.recentModels`). No "match main chat" link yet — explicit per-tab pick only (can be added later as a picker footer item if users ask).

**Chain layer model behavior unchanged.** `AttackChainTab` reads `chainCfg.modelQualifiedId ?? chat.modelQualifiedId` when invoking `runChain` / `buildLayerPrompt`. Existing `runChain` signature unchanged.

**Godmode engine request body** forwards `model: godmodeCfg.modelQualifiedId ?? chat.modelQualifiedId`. Engine already accepts `body.model`.

## Godmode tab UI (F1.3 polish)

Replaces the current dev-grade JSON dump with:

- **Status strip** at top — renders `plan` / `done` / `error` / `memory_write_failed` events as compact one-liners. `memory_write_failed` is subtle inline note, never blocks the winner.
- **Candidate rows** keyed by `dnaId` — on `candidate_started` a row appears with spinner + DNA chip (mutator · classifier · wrapper · temp). On `candidate_scored` the spinner swaps for a tier badge (color-coded: `REFUSAL` red, `EVASIVE` orange, `PARTIAL` yellow, `SUBSTANTIVE` light-green, `COMPLIANT` green), score (0–1), latency ms. On `candidate_failed` → error chip with reason.
- **Winner card** — tier badge + DNA chip + response rendered with the chat's markdown renderer + two actions (`Copy`, `Send to main chat`).
- **Input form** — task textarea auto-grows (min 3, max 10 rows); `Cmd/Ctrl+Enter` runs; K styled as `ModePills.svelte` rounded/accent variant; Run button primary variant; swaps to "Stop" while running.
- **Empty state** — when `events.length === 0 && !running && history.length === 0`: explainer card with "Try with example task" button populating a benign demo prompt.
- **Running-status pill** in the sticky header — `{running} running · {scored} scored` while in-flight.
- **History list** above the input form — compact row per past run (model · timestamp · tier badge · 60-char task preview). Click expands → winner + candidate sub-rows, each with its own `Send to main chat` button. Newest first, capped at last 50.
- **Save-as-technique form** — unchanged from Subsystem B; collapsible section below winner card.

## Promote-to-main

**UI.** Every run row (and, expanded, every candidate sub-row) renders a single `ArrowRight` "Send to main chat" button. Click → one-shot inject, no confirmation. Post-promote: inline "Sent" flash (existing Chain pattern), sidebar stays open on the same tab.

**Chain promote** reuses existing `injectAttackChainTurn`. No change.

**Godmode promote** uses new `injectGodmodeTurn(chatId, { task, winningResponse, winningDna, model, durationMs })`. Writes tagged user + assistant messages.

**Non-winner promote.** Exposed via expanded candidate sub-rows only. No separate picker UI. Same `injectGodmodeTurn` helper but with the selected candidate's response/DNA.

## Error handling

- Sidebar open/close failures → log, don't block. State lives in-memory first.
- Debounced config write failures → silent console log (matches current Chain).
- `saveGodmodeRun` failure → visible toast ("Run history save failed") but the winner stays on screen and promote-to-main still works (promote reads from in-memory state, not Dexie).
- `injectGodmodeTurn` / `injectAttackChainTurn` failure → toast with error; sidebar keeps the run so the user can retry.

## Testing

**Unit:**
- `repo.test.ts` — CRUD + ownerId filtering + tombstone behavior for `godmode_runs`.
- `dispatch.test.ts` — new `injectGodmodeTurn` cases parallel to existing `injectAttackChainTurn` cases.

**Component:**
- `AttackWorkspaceSidebar.test.ts` — tab-switch preserves inactive-tab state; model picker writes to the correct config.
- `GodmodeTab.test.ts` — candidate row state transitions (running → scored → error); history list renders from mock `godmode_runs`.

**Manual smoke (Chromium):**
- Open both tabs sequentially inside one sidebar; neither reopens a second drawer.
- Promote from Chain history lands a tagged turn in main chat.
- Promote from Godmode winner lands a tagged turn in main chat.
- Promote from a Godmode non-winner candidate lands a tagged turn in main chat with the selected DNA in toolCalls.
- Run Godmode → switch to Chain mid-run → switch back → events still streaming in the same rows.
- Close sidebar mid-run → reopen → run continues; winner appears.

## Migration + rollout

- Dexie bump version 5 → 6, adding `godmode_runs` table only. No data rewrite of existing tables.
- `ChatSettings` new fields are all `Optional`; absent means "sidebar closed, Chain tab, empty Godmode config".
- `AttackChainSidebar.svelte` renamed + moved → `AttackChainTab.svelte` (inside `$lib/chat/attack-chain/tabs/` or existing attack-chain dir).
- `godmode/panel.svelte` renamed → `godmode/GodmodeTab.svelte`.
- `ChatWorkspace.svelte` mounts one `<AttackWorkspaceSidebar>` instead of two siblings. Events renamed from `chat:open-attack-chain` / `chat:open-godmode` to unified `chat:open-workspace {tab}`.
- One PR, atomic swap. No feature flag; existing `GODMODE_ENGINE_ENABLED` env gate still hides the Godmode tab if off (sidebar opens with Chain tab only).

## Out of scope

Folded into separate follow-ups (not this PR):
- OpenRouter / OpenAI-compat adapters (Phase F3).
- Counter-based round-robin / `allCombinations()` memoization (F4).
- Custom-techniques library browser (Subsystem D).
- "Continue from here" mode-switch on promote (if data warrants later).
- Bulk "promote full history" / thread reconstruction (Q4b option (b), deferred).

## Known risks

- **Tab-mount cost.** Keeping both tabs mounted (even hidden) means `AttackChainTab` runs its `$effect`s and debounced writes whether visible or not. Acceptable — Chain already does this in the background today; Godmode's hidden tab only holds a small event list.
- **History truncation.** 50-row cap is arbitrary. Not paginated in v1; dataset export (Subsystem B-phase-3) is the pressure-release if users need more.
- **Type drift.** `GodmodeRunRow.winner.dna` and `candidates[].dna` use the browser-side `DnaTuple` type. If F2 unifies tuple types across Deno/browser later, this row type updates cleanly (single source).
