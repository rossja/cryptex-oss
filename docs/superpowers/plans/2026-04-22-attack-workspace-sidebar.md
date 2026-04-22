# Attack Workspace Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two independent Chain + Godmode drawers with a single tabbed right sidebar that persists per-chat tab state, lets each tab pick its own model from configured providers, keeps a per-chat Godmode run history, and exposes a one-click "Send to main chat" action on every run.

**Architecture:** Introduce `AttackWorkspaceSidebar.svelte` as the single right-drawer component owning tab-strip chrome + per-tab model picker + close button. Move the current `AttackChainSidebar` body into `AttackChainTab.svelte` (shell stripped). Rewrite Godmode's panel as `GodmodeTab.svelte` with F1.3 polish (structured candidate rows, winner card, history list). Persist per-chat state via extended `ChatSettings` fields and a new Dexie `godmode_runs` table. Add `injectGodmodeTurn` helper in `dispatch.ts` mirroring `injectAttackChainTurn`.

**Tech Stack:** Svelte 5 runes, Dexie (IndexedDB), Vitest + fake-indexeddb, `ModelPickerV2`, `lucide-svelte` icons, existing `runGodmode` SSE client.

**Spec:** [`docs/superpowers/specs/2026-04-22-attack-workspace-sidebar-design.md`](../specs/2026-04-22-attack-workspace-sidebar-design.md) — decisions D1–D5.

---

## File Structure

| File | Role | Status |
|---|---|---|
| `app/src/lib/chat/types.ts` | Extend `ChatSettings` with `workspaceTab`, `workspaceOpen`, `godmodeConfig`; extend `AttackChainConfig` with `modelQualifiedId`; add `GodmodeConfig`, `GodmodeRunRow`, `GodmodeCandidateRecord` types | modify |
| `app/src/lib/chat/db.ts` | Bump Dexie version 2 → 3 adding `godmodeRuns` table | modify |
| `app/src/lib/chat/repo.ts` | Add `saveGodmodeRun`, `listGodmodeRuns`, `deleteGodmodeRun` | modify |
| `app/src/lib/chat/dispatch.ts` | Add `injectGodmodeTurn` helper | modify |
| `app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte` | New top-level sidebar with tab strip, model picker, tab slot rendering | create |
| `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte` | Extracted `AttackChainSidebar` body (shell stripped; reads tab-local model) | create |
| `app/src/lib/chat/godmode/GodmodeTab.svelte` | Rewritten Godmode panel (F1.3 polish: status strip, candidate rows, winner card, history) | create |
| `app/src/lib/chat/godmode/CandidateRow.svelte` | Single-candidate row (spinner → scored badge → response) | create |
| `app/src/lib/chat/godmode/WinnerCard.svelte` | Winner result block with `Copy`/`Send to main chat` | create |
| `app/src/lib/chat/godmode/GodmodeHistoryPanel.svelte` | Per-chat run history list with expandable candidate sub-rows | create |
| `app/src/lib/components/chat/workspace/ChatWorkspace.svelte` | Mount single `<AttackWorkspaceSidebar>`; unify open-events | modify |
| `app/src/lib/components/chat/workspace/ChatHeader.svelte` | Both buttons dispatch `chat:open-workspace` with `{tab}` detail | modify |
| `app/src/lib/components/chat/attack-chain/AttackChainSidebar.svelte` | Delete after extraction | delete |
| `app/src/lib/chat/godmode/panel.svelte` | Delete after extraction | delete |
| `app/src/lib/chat/__tests__/repo.test.ts` | New cases for `godmode_runs` CRUD | modify |
| `app/src/lib/chat/__tests__/dispatch.test.ts` | New case for `injectGodmodeTurn` | modify |
| `app/src/lib/components/chat/workspace/__tests__/AttackWorkspaceSidebar.test.ts` | Tab-switch state preservation, model picker binding | create |
| `app/src/lib/chat/godmode/__tests__/GodmodeTab.test.ts` | Candidate row state transitions + history rendering | create |

---

## Task 1: Types + ChatSettings extensions

**Files:**
- Modify: `app/src/lib/chat/types.ts`

- [ ] **Step 1: Extend `AttackChainConfig` with optional tab-local model**

Edit `app/src/lib/chat/types.ts` lines 8–16. After `autoRetryEnabled: boolean;` add one optional field:

```ts
export interface AttackChainConfig {
  input: string;
  layers: string[];
  layerParams: Array<Record<string, unknown>>;
  layerOutputEdits: Array<string | null>;
  executeEnabled: boolean;
  finalSystemPrompt: string;
  autoRetryEnabled: boolean;
  modelQualifiedId?: string;
}
```

- [ ] **Step 2: Add `GodmodeConfig` interface**

In the same file, after `AttackChainConfig`, insert:

```ts
/**
 * Snapshot of an in-progress Godmode tab configuration, persisted on the
 * parent chat row so the drawer state survives close / reopen / tab switch.
 * Run results are NOT persisted here — those live in `godmodeRuns`.
 */
export interface GodmodeConfig {
  task: string;
  K: 3 | 6 | 12;
  modelQualifiedId?: string;
  saveForm: {
    expanded: boolean;
    name: string;
    decompose: boolean;
  };
}
```

- [ ] **Step 3: Extend `ChatSettings` with workspace fields**

In the same file, modify `ChatSettings` (currently lines 18–33) to add three optional fields (keep all existing fields untouched):

```ts
export interface ChatSettings {
  systemPrompt: string;
  temperature: number;
  topP?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  activeMode?: string | null;
  godmodeEnabled: boolean;
  enabledToolIds: string[];
  toolChoice: 'auto' | 'none' | 'required';
  maxToolCalls: number;
  attackChainConfig?: AttackChainConfig;
  godmodeConfig?: GodmodeConfig;
  workspaceTab?: 'chain' | 'godmode';
  workspaceOpen?: boolean;
}
```

- [ ] **Step 4: Add `GodmodeCandidateRecord` and `GodmodeRunRow` types**

In the same file, after the existing `AttackChainRunRow` interface (currently ending ~line 175), append:

```ts
import type { TechniqueDNA } from './godmode/dna';
import type { RefusalTier } from './attack-chain-refusal';

/**
 * One successful candidate from a Godmode run. Failed candidates
 * (timeout / api_error / cancelled) are excluded from history.
 */
export interface GodmodeCandidateRecord {
  dna: TechniqueDNA;
  response: string;
  score: number;
  tier: RefusalTier;
  preview: string;
}

/**
 * Persisted row for one Godmode engine run — task, config, winner,
 * every successful candidate. Stored in the `godmodeRuns` Dexie table,
 * indexed by chatId + createdAt for the per-chat history panel.
 */
export interface GodmodeRunRow {
  id: string;
  ownerId: string;
  chatId: string;
  createdAt: number;
  updatedAt: number;
  task: string;
  K: 3 | 6 | 12;
  modelId: string;
  winner: GodmodeCandidateRecord;
  candidates: GodmodeCandidateRecord[];
  tombstoned?: boolean;
}
```

Note: the existing `types.ts` has no `import` statements at top. Move the two new imports to the top of the file above the first `export type`. Verify the file begins with the imports then `export type Role …`.

- [ ] **Step 5: Typecheck**

Run: `cd app && npm run app:check` (from root: `npm run app:check`)
Expected: no new errors in `types.ts` (may report errors elsewhere because this commit precedes the consumers — that's fine; we fix forward).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/chat/types.ts
git commit -m "feat(chat): extend types for tabbed workspace sidebar

Add GodmodeConfig, GodmodeRunRow, GodmodeCandidateRecord types.
Extend ChatSettings with workspaceTab/workspaceOpen/godmodeConfig.
Extend AttackChainConfig with optional modelQualifiedId so each tab
can pick its own model independent of the main chat model."
```

---

## Task 2: Dexie schema bump for `godmodeRuns` table

**Files:**
- Modify: `app/src/lib/chat/db.ts`
- Test: `app/src/lib/chat/__tests__/db.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `app/src/lib/chat/__tests__/db.test.ts`:

```ts
describe('db v3 — godmodeRuns table', () => {
  it('godmodeRuns table exists and accepts a row', async () => {
    indexedDB.deleteDatabase('cryptex-chat');
    vi.resetModules();
    const { db } = await import('../db');
    await db.open();
    const row = {
      id: 'run-1',
      ownerId: 'local',
      chatId: 'chat-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      task: 'hello',
      K: 6 as const,
      modelId: 'anthropic:claude-sonnet-4-6',
      winner: {
        dna: { mutatorId: null, classifierId: null, wrapperId: null, modeId: null, prefillId: null, tempBucket: 'med' as const, source: 'builtin' as const },
        response: 'hi',
        score: 0.8,
        tier: 'substantive' as const,
        preview: 'hi'
      },
      candidates: []
    };
    await db.godmodeRuns.put(row as any);
    const got = await db.godmodeRuns.get('run-1');
    expect(got?.task).toBe('hello');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/chat/__tests__/db.test.ts`
Expected: FAIL — `db.godmodeRuns` undefined.

- [ ] **Step 3: Add table to schema**

Replace the entire `CryptexChatDB` class body in `app/src/lib/chat/db.ts`:

```ts
import Dexie, { type Table } from 'dexie';
import type { ChatRow, MessageRow, AttachmentRow, ToolStateRow, AttackChainRunRow, GodmodeRunRow } from './types';

class CryptexChatDB extends Dexie {
  chats!: Table<ChatRow, string>;
  messages!: Table<MessageRow, string>;
  attachments!: Table<AttachmentRow, string>;
  toolStates!: Table<ToolStateRow, [string, string]>;
  attackChainRuns!: Table<AttackChainRunRow, string>;
  godmodeRuns!: Table<GodmodeRunRow, string>;

  constructor() {
    super('cryptex-chat');
    // SCHEMA HISTORY — do NOT modify existing stores() strings in-place.
    // For any structural change: add `.version(N).stores({...}).upgrade(tx => {...})` below, keep prior versions intact.
    this.version(1).stores({
      chats:       'id, ownerId, updatedAt, pinned, archivedAt, parentChatId, *tags, tombstoned',
      messages:    'id, chatId, [chatId+createdAt], parentId, role, *tags, trainingInclude, ownerId, tombstoned',
      attachments: 'id, messageId, ownerId, tombstoned',
      toolStates:  '[toolId+ownerId], toolId, ownerId, updatedAt'
    });
    // v2: add attackChainRuns table
    this.version(2).stores({
      chats:           'id, ownerId, updatedAt, pinned, archivedAt, parentChatId, *tags, tombstoned',
      messages:        'id, chatId, [chatId+createdAt], parentId, role, *tags, trainingInclude, ownerId, tombstoned',
      attachments:     'id, messageId, ownerId, tombstoned',
      toolStates:      '[toolId+ownerId], toolId, ownerId, updatedAt',
      attackChainRuns: 'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned'
    });
    // v3: add godmodeRuns table for per-chat Godmode run history.
    // Additive — prior tables preserved; no data migration needed.
    this.version(3).stores({
      chats:           'id, ownerId, updatedAt, pinned, archivedAt, parentChatId, *tags, tombstoned',
      messages:        'id, chatId, [chatId+createdAt], parentId, role, *tags, trainingInclude, ownerId, tombstoned',
      attachments:     'id, messageId, ownerId, tombstoned',
      toolStates:      '[toolId+ownerId], toolId, ownerId, updatedAt',
      attackChainRuns: 'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned',
      godmodeRuns:     'id, chatId, ownerId, createdAt, [chatId+createdAt], tombstoned'
    });
  }
}

export const db = new CryptexChatDB();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/chat/__tests__/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/chat/db.ts app/src/lib/chat/__tests__/db.test.ts
git commit -m "feat(chat): add godmodeRuns Dexie table (v3 schema)

Additive migration — prior tables untouched. Indexed by
[chatId+createdAt] for the history panel."
```

---

## Task 3: Repo methods for Godmode runs

**Files:**
- Modify: `app/src/lib/chat/repo.ts`
- Modify: `app/src/lib/chat/__tests__/repo.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `app/src/lib/chat/__tests__/repo.test.ts` (inside the `describe('chat repo', …)` block, before the closing `});`):

```ts
  it('saveGodmodeRun persists a row with ownerId=local + ulid id', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const row = await repo.saveGodmodeRun({
      chatId: chat.id,
      task: 'write a poem',
      K: 6,
      modelId: 'anthropic:claude-sonnet-4-6',
      winner: {
        dna: { mutatorId: null, classifierId: null, wrapperId: null, modeId: null, prefillId: null, tempBucket: 'med', source: 'builtin' },
        response: 'roses are red',
        score: 0.8,
        tier: 'substantive',
        preview: 'roses are red'
      },
      candidates: []
    });
    expect(row.id.length).toBeGreaterThan(0);
    expect(row.ownerId).toBe('local');
    expect(row.chatId).toBe(chat.id);
    expect(row.winner.tier).toBe('substantive');
    expect(row.candidates).toEqual([]);
  });

  it('listGodmodeRuns returns newest-first and excludes tombstoned', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const r1 = await repo.saveGodmodeRun({
      chatId: chat.id, task: 'one', K: 3, modelId: 'x',
      winner: { dna: { mutatorId: null, classifierId: null, wrapperId: null, modeId: null, prefillId: null, tempBucket: 'low', source: 'builtin' }, response: 'a', score: 0.5, tier: 'partial', preview: 'a' },
      candidates: []
    });
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await repo.saveGodmodeRun({
      chatId: chat.id, task: 'two', K: 3, modelId: 'x',
      winner: { dna: { mutatorId: null, classifierId: null, wrapperId: null, modeId: null, prefillId: null, tempBucket: 'low', source: 'builtin' }, response: 'b', score: 0.8, tier: 'substantive', preview: 'b' },
      candidates: []
    });
    await repo.deleteGodmodeRun(r1.id);
    const list = await repo.listGodmodeRuns(chat.id);
    expect(list.map((r) => r.id)).toEqual([r2.id]);
  });

  it('deleteGodmodeRun tolerates unknown ids', async () => {
    const { repo } = await import('../repo');
    await repo.deleteGodmodeRun('no-such-id');
    // no throw is the assertion
    expect(true).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/chat/__tests__/repo.test.ts`
Expected: FAIL — `repo.saveGodmodeRun` is not a function.

- [ ] **Step 3: Add repo methods**

Append to `app/src/lib/chat/repo.ts` — inside the `repo = {...}` object, after `deleteAttackChainRun` (currently ending ~line 197), add (mind the comma on the prior `deleteAttackChainRun` closing brace):

```ts
  ,
  /** Persist one completed Godmode engine run. Caller supplies everything
   *  except id/ownerId/createdAt/updatedAt/tombstoned which are stamped here. */
  async saveGodmodeRun(input: {
    chatId: string;
    task: string;
    K: 3 | 6 | 12;
    modelId: string;
    winner: GodmodeCandidateRecord;
    candidates: GodmodeCandidateRecord[];
  }): Promise<GodmodeRunRow> {
    const now = Date.now();
    const base: GodmodeRunRow = {
      id: ulid(),
      ownerId: ownerId(),
      chatId: input.chatId,
      createdAt: now,
      updatedAt: now,
      task: input.task,
      K: input.K,
      modelId: input.modelId,
      winner: input.winner,
      candidates: [...input.candidates]
    };
    const row: GodmodeRunRow = JSON.parse(JSON.stringify(base));
    await db.godmodeRuns.put(row);
    return row;
  },

  /** Most-recent-first list of non-tombstoned runs for a chat. Limit 50
   *  by default — the UI further slices to 10 for the collapsible panel. */
  async listGodmodeRuns(chatId: string, limit = 50): Promise<GodmodeRunRow[]> {
    const all = await db.godmodeRuns
      .where('[chatId+createdAt]')
      .between([chatId, -Infinity], [chatId, Infinity])
      .toArray();
    return all
      .filter((r) => r.ownerId === ownerId() && !r.tombstoned)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },

  /** Soft-delete (tombstone) a run. */
  async deleteGodmodeRun(id: string): Promise<void> {
    const existing = await db.godmodeRuns.get(id);
    if (!existing || existing.ownerId !== ownerId()) return;
    await db.godmodeRuns.put(
      JSON.parse(JSON.stringify({ ...existing, tombstoned: true, updatedAt: Date.now() }))
    );
  }
```

Also add `GodmodeRunRow, GodmodeCandidateRecord` to the existing import from `./types` at the top of `repo.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/lib/chat/__tests__/repo.test.ts`
Expected: PASS (all three new cases + all existing).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/chat/repo.ts app/src/lib/chat/__tests__/repo.test.ts
git commit -m "feat(chat): repo methods for godmode run history

saveGodmodeRun / listGodmodeRuns / deleteGodmodeRun — mirror the
Attack Chain run history API. Tombstoned + ownerId preserved for the
auth retrofit path."
```

---

## Task 4: `injectGodmodeTurn` helper in dispatch.ts

**Files:**
- Modify: `app/src/lib/chat/dispatch.ts`
- Modify: `app/src/lib/chat/__tests__/dispatch.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `app/src/lib/chat/__tests__/dispatch.test.ts`:

```ts
describe('injectGodmodeTurn', () => {
  it('writes a tagged user + assistant pair with godmode toolCalls', async () => {
    const { injectGodmodeTurn } = await import('../dispatch');
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const { userMsg, assistantMsg } = await injectGodmodeTurn(chat.id, {
      task: 'tell me a joke',
      winningResponse: 'why did the chicken cross the road',
      winningDna: {
        mutatorId: 'roleplay', classifierId: null, wrapperId: null,
        modeId: null, prefillId: null, tempBucket: 'med', source: 'builtin'
      },
      modelId: 'anthropic:claude-sonnet-4-6',
      durationMs: 1234
    });
    expect(userMsg.content).toBe('tell me a joke');
    expect(userMsg.modeApplied).toBe('__godmode__');
    expect(userMsg.tags).toContain('godmode');
    expect(userMsg.toolCalls?.[0]?.source).toBe('attack-chain'); // see step 3 note
    expect(assistantMsg.content).toBe('why did the chicken cross the road');
    expect(assistantMsg.parentId).toBe(userMsg.id);
    expect(assistantMsg.tags).toContain('godmode');
    const msgs = await repo.listMessages(chat.id);
    expect(msgs).toHaveLength(2);
  });
});
```

Note on step 3: `ToolCallLog.source` is currently typed to a union that only accepts `'transformer' | 'slash' | 'mcp' | 'attack-chain'`. Before this test passes, Step 3 widens the union to include `'godmode'` and the test assertion flips to `'godmode'`. Update the test's `.toBe('attack-chain')` line to `.toBe('godmode')` in Step 3.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/chat/__tests__/dispatch.test.ts`
Expected: FAIL — `injectGodmodeTurn` not exported.

- [ ] **Step 3: Widen `ToolCallLog.source` union + add helper**

Edit `app/src/lib/chat/types.ts` — modify the `ToolCallLog` interface (currently around line 51). Change the `source` field from:

```ts
source: 'transformer' | 'slash' | 'mcp' | 'attack-chain';
```

to:

```ts
source: 'transformer' | 'slash' | 'mcp' | 'attack-chain' | 'godmode';
```

Then append to `app/src/lib/chat/dispatch.ts` (after `injectAttackChainTurn` ending at line 678):

```ts
/**
 * Persist one completed Godmode engine run as a user+assistant message pair
 * in the target chat. Mirrors `injectAttackChainTurn` so the Dataset
 * Inspector surfaces Godmode promotions identically to Chain promotions.
 *
 * The user message stores the raw task input; toolCalls carries the winning
 * DNA (or any selected candidate's DNA) with source='godmode' so the
 * timeline can render a badge.
 */
export async function injectGodmodeTurn(
  chatId: string,
  params: {
    task: string;
    winningResponse: string;
    winningDna: TechniqueDNA;
    modelId: string;
    durationMs?: number;
  }
): Promise<{ userMsg: MessageRow; assistantMsg: MessageRow }> {
  const toolCalls: ToolCallLog[] = [{
    toolCallId: `godmode-${params.winningDna.mutatorId ?? ''}-${params.winningDna.classifierId ?? ''}-${params.winningDna.wrapperId ?? ''}-${params.winningDna.tempBucket}`,
    source: 'godmode' as const,
    toolName: 'dna',
    input: { dna: params.winningDna },
    output: params.winningResponse,
    durationMs: params.durationMs ?? 0
  }];

  const userMsg = await repo.saveMessage({
    chatId,
    role: 'user',
    content: params.task,
    contentRaw: params.task,
    modeApplied: '__godmode__',
    toolCalls,
    modelRequested: params.modelId,
    tags: ['godmode']
  });

  const assistantMsg = await repo.saveMessage({
    chatId,
    role: 'assistant',
    content: params.winningResponse,
    parentId: userMsg.id,
    modelRequested: params.modelId,
    tags: ['godmode']
  });

  return { userMsg, assistantMsg };
}
```

Also add `TechniqueDNA` import at the top of `dispatch.ts`: `import type { TechniqueDNA } from './godmode/dna';`

Finally, flip the test assertion from step 1: edit the line `expect(userMsg.toolCalls?.[0]?.source).toBe('attack-chain');` to `expect(userMsg.toolCalls?.[0]?.source).toBe('godmode');`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/chat/__tests__/dispatch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/chat/dispatch.ts app/src/lib/chat/types.ts app/src/lib/chat/__tests__/dispatch.test.ts
git commit -m "feat(chat): injectGodmodeTurn helper for promote-to-main

Mirror of injectAttackChainTurn. Writes a tagged user+assistant
pair with the winning DNA captured in toolCalls so the dataset
inspector + timeline can render promotion origin.

Widens ToolCallLog.source union to include 'godmode'."
```

---

## Task 5: `AttackChainTab.svelte` — extract body from existing sidebar

**Files:**
- Create: `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte`
- Modify: `app/src/lib/components/chat/attack-chain/AttackChainSidebar.svelte` (will be deleted in Task 11 — keep untouched for now)

- [ ] **Step 1: Copy the existing sidebar**

Copy `app/src/lib/components/chat/attack-chain/AttackChainSidebar.svelte` to `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte`.

```bash
cp app/src/lib/components/chat/attack-chain/AttackChainSidebar.svelte app/src/lib/components/chat/attack-chain/AttackChainTab.svelte
```

- [ ] **Step 2: Strip the outer `<aside>` shell**

In the new `AttackChainTab.svelte`, replace the outer `<aside class="flex h-full w-[440px] …" …>` wrapper and its sticky header (lines 428–448 approx) with a single `<div>` that just hosts the body. The tab component should NOT render its own width, border, sticky header, or close button — the parent `AttackWorkspaceSidebar` owns all chrome.

Replace the top markup block from `<aside class="flex h-full …"` through the closing of the sticky header `<div>` (where the `<X size={14} />` close button lives, immediately before the scrollable content starts) with:

```svelte
<div class="flex h-full min-h-0 flex-col">
```

And at the end of the file, replace the closing `</aside>` with `</div>`.

- [ ] **Step 3: Remove unused `onClose`, `X` icon, and `open` props**

Remove the `X` import (`import X from 'lucide-svelte/icons/x';`). Remove the `onClose: () => void;` from the `Props` type. Change the `Props` shape to match what the new parent provides:

```ts
type Props = {
  chat: ChatRow;
  onInsertToComposer: (text: string) => void;
};
let { chat, onInsertToComposer }: Props = $props();
```

Remove `open` from the props destructure (it was unused per the existing comment at line 31–32).

- [ ] **Step 4: Rewire model to read from tab config with fallback**

Modify `ctxFor` (currently lines 251–277). Change:

```ts
function ctxFor(signal: AbortSignal) {
  const modelId = chat.modelQualifiedId;
```

to:

```ts
function ctxFor(signal: AbortSignal) {
  const modelId = chat.settings.attackChainConfig?.modelQualifiedId ?? chat.modelQualifiedId;
```

Also update the `injectAssistantReply` body where it passes `modelId: chat.modelQualifiedId` (line 419) — change to:

```ts
modelId: chat.settings.attackChainConfig?.modelQualifiedId ?? chat.modelQualifiedId,
```

- [ ] **Step 5: Extend `persistConfig` to include `modelQualifiedId`**

Modify `persistConfig` (currently lines 115–137). Change the config object to preserve any persisted `modelQualifiedId`:

```ts
async function persistConfig() {
  const existing = chat.settings.attackChainConfig;
  const config: AttackChainConfig = {
    input,
    layers: [...layers],
    layerParams: layerParams.map((p) => ({ ...p })),
    layerOutputEdits: [...layerOutputEdits],
    executeEnabled,
    finalSystemPrompt,
    autoRetryEnabled,
    modelQualifiedId: existing?.modelQualifiedId
  };
  try {
    const fresh = await repo.getChat(chat.id);
    const base = fresh?.settings ?? chat.settings;
    await repo.updateChat(chat.id, {
      settings: { ...base, attackChainConfig: { ...config, modelQualifiedId: base.attackChainConfig?.modelQualifiedId } }
    });
  } catch (err) {
    console.error('[attack-chain] persist failed:', err);
  }
}
```

Why read `modelQualifiedId` from a fresh DB read rather than local state: the model picker lives in the parent `AttackWorkspaceSidebar`, not this tab. When the parent writes the model it flushes immediately; when this tab's debounced persist runs later, it must not overwrite the parent's fresh write.

- [ ] **Step 6: Verify the file compiles**

Run: `cd app && npm run app:check`
Expected: no errors in `AttackChainTab.svelte`. (The old `AttackChainSidebar.svelte` is still present and still referenced by `ChatWorkspace.svelte` — errors there are fine until Tasks 10–11.)

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/components/chat/attack-chain/AttackChainTab.svelte
git commit -m "feat(chat): extract AttackChainTab from sidebar

Tab-only variant of the Chain drawer body. Outer shell stripped —
parent AttackWorkspaceSidebar (next commits) owns the header, close
button, and model picker. Chain tab reads its model from
chat.settings.attackChainConfig.modelQualifiedId with fallback to
chat.modelQualifiedId."
```

---

## Task 6: `GodmodeTab.svelte` — form + history + run orchestration shell

**Files:**
- Create: `app/src/lib/chat/godmode/GodmodeTab.svelte`

This task builds the Godmode tab's outer shell (form, run controls, history list) without the F1.3-polish sub-components. Those sub-components (`CandidateRow`, `WinnerCard`, `GodmodeHistoryPanel`) come in Tasks 7, 8, 9.

- [ ] **Step 1: Create the file with the form, run loop, and in-memory candidate state**

Create `app/src/lib/chat/godmode/GodmodeTab.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChatRow, GodmodeConfig, GodmodeRunRow, GodmodeCandidateRecord } from '$lib/chat/types';
  import type { EngineEvent, SynthesizeResult } from './types';
  import type { TechniqueDNA } from './dna';
  import type { RefusalTier } from '../attack-chain-refusal';
  import { runGodmode } from './client';
  import { saveAsTechnique } from './synthesizer-client';
  import { injectGodmodeTurn } from '$lib/chat/dispatch';
  import { repo } from '$lib/chat/repo';
  import { session } from '$lib/auth/session.svelte';

  type Props = {
    chat: ChatRow;
    onNotify: (kind: 'info' | 'error', text: string) => void;
  };
  let { chat, onNotify }: Props = $props();

  const persisted: GodmodeConfig | undefined = chat.settings.godmodeConfig;

  // Form state — hydrated from persisted config when present.
  let task = $state(persisted?.task ?? '');
  let K = $state<3 | 6 | 12>(persisted?.K ?? 6);
  let saveName = $state(persisted?.saveForm.name ?? '');
  let saveDecompose = $state(persisted?.saveForm.decompose ?? false);
  let saveExpanded = $state(persisted?.saveForm.expanded ?? false);

  // Run lifecycle state.
  let running = $state(false);
  let controller: AbortController | null = null;

  // Per-run in-memory records. Keyed by index (0..K-1) for O(1) updates.
  type CandidateState = {
    idx: number;
    dna: TechniqueDNA | null;
    status: 'running' | 'scored' | 'failed';
    score?: number;
    tier?: RefusalTier;
    preview?: string;
    confidence?: 'high' | 'low';
    response?: string;            // populated ONLY for the winner; losers have only preview
    error?: string;
  };
  let candidates = $state<CandidateState[]>([]);
  let winner = $state<{ idx: number; response: string; dna: TechniqueDNA; tier: RefusalTier } | null>(null);
  let planned = $state<TechniqueDNA[] | null>(null);
  let runError = $state<{ code: string; message: string } | null>(null);
  let doneAt = $state<number | null>(null);

  // Save-as-technique state.
  let saving = $state(false);
  let saveResult: SynthesizeResult | null = $state(null);
  let saveError: string | null = $state(null);

  // History state — hydrated onMount, refreshed after save.
  let history = $state<GodmodeRunRow[]>([]);

  // Per-chat models — reads from tab config, falls back to chat's model.
  const effectiveModel = $derived(chat.settings.godmodeConfig?.modelQualifiedId ?? chat.modelQualifiedId);

  onMount(async () => {
    try {
      history = await repo.listGodmodeRuns(chat.id);
    } catch (err) {
      console.error('[godmode-tab] history load failed:', err);
    }
  });

  // Debounced persist — mirrors AttackChainTab. Fires 500ms after any
  // tracked field change. We deliberately persist form-only (task/K/
  // saveForm); model lives in the parent and is persisted there.
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let hydratedOnce = false;
  $effect(() => {
    void task;
    void K;
    void saveName;
    void saveDecompose;
    void saveExpanded;
    if (!hydratedOnce) { hydratedOnce = true; return; }
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => { void persistConfig(); }, 500);
    return () => { if (persistTimer) clearTimeout(persistTimer); };
  });

  async function persistConfig() {
    const config: GodmodeConfig = {
      task,
      K,
      modelQualifiedId: chat.settings.godmodeConfig?.modelQualifiedId,
      saveForm: { expanded: saveExpanded, name: saveName, decompose: saveDecompose }
    };
    try {
      const fresh = await repo.getChat(chat.id);
      const base = fresh?.settings ?? chat.settings;
      await repo.updateChat(chat.id, {
        settings: { ...base, godmodeConfig: { ...config, modelQualifiedId: base.godmodeConfig?.modelQualifiedId } }
      });
    } catch (err) {
      console.error('[godmode-tab] persist failed:', err);
    }
  }

  async function go() {
    if (running) return;
    candidates = [];
    winner = null;
    planned = null;
    runError = null;
    doneAt = null;
    running = true;
    const started = Date.now();
    controller = new AbortController();
    try {
      const jwt = session.supabaseSession?.access_token;
      if (!jwt) {
        runError = { code: 'no_session', message: 'Not signed in. Godmode requires an authenticated session.' };
        return;
      }
      for await (const e of runGodmode({
        task,
        K,
        model: effectiveModel,
        jwt,
        signal: controller.signal
      })) {
        applyEvent(e);
      }
      // Stream ended — if we got a winner, persist to history.
      if (winner) {
        try {
          const successful: GodmodeCandidateRecord[] = candidates
            .filter((c): c is CandidateState & { dna: TechniqueDNA; score: number; tier: RefusalTier; preview: string } =>
              c.status === 'scored' && !!c.dna && c.score !== undefined && !!c.tier && c.preview !== undefined)
            .map((c) => ({
              dna: c.dna,
              response: c.response ?? c.preview,
              score: c.score,
              tier: c.tier,
              preview: c.preview
            }));
          const winnerRecord: GodmodeCandidateRecord = {
            dna: winner.dna,
            response: winner.response,
            score: successful.find((c) => JSON.stringify(c.dna) === JSON.stringify(winner!.dna))?.score ?? 1,
            tier: winner.tier,
            preview: winner.response.slice(0, 120)
          };
          const row = await repo.saveGodmodeRun({
            chatId: chat.id,
            task,
            K,
            modelId: effectiveModel,
            winner: winnerRecord,
            candidates: successful
          });
          history = [row, ...history];
        } catch (err) {
          console.error('[godmode-tab] save run failed:', err);
          onNotify('error', 'Run history save failed');
        }
      }
    } catch (err) {
      runError = { code: 'client_error', message: String(err) };
    } finally {
      running = false;
      controller = null;
      doneAt = Date.now() - started;
    }
  }

  function applyEvent(e: EngineEvent) {
    switch (e.type) {
      case 'plan':
        planned = e.dnas;
        candidates = e.dnas.map((d, i) => ({ idx: i, dna: d, status: 'running' as const }));
        break;
      case 'candidate_started':
        // idempotent — row already created in 'plan'
        candidates = candidates.map((c) => c.idx === e.idx ? { ...c, dna: e.dna, status: 'running' } : c);
        break;
      case 'candidate_scored':
        candidates = candidates.map((c) => c.idx === e.idx ? {
          ...c,
          status: 'scored',
          score: e.score,
          tier: e.tier,
          preview: e.preview,
          confidence: e.confidence
        } : c);
        break;
      case 'candidate_failed':
        candidates = candidates.map((c) => c.idx === e.idx ? { ...c, status: 'failed', error: `${e.reason}${e.detail ? ': ' + e.detail : ''}` } : c);
        break;
      case 'winner':
        winner = { idx: e.idx, response: e.response, dna: e.dna, tier: e.tier };
        candidates = candidates.map((c) => c.idx === e.idx ? { ...c, response: e.response } : c);
        break;
      case 'done':
        break;
      case 'error':
        runError = { code: e.code, message: e.message };
        break;
    }
  }

  function stop() {
    controller?.abort();
  }

  async function save() {
    if (saving || !task.trim() || !saveName.trim()) return;
    saving = true;
    saveError = null;
    saveResult = null;
    try {
      const jwt = session.supabaseSession?.access_token;
      if (!jwt) { saveError = 'Not signed in.'; return; }
      saveResult = await saveAsTechnique({ prompt: task, name: saveName, decompose: saveDecompose, jwt });
      window.dispatchEvent(new CustomEvent('registry:refresh-custom'));
    } catch (err) {
      saveError = String(err);
    } finally {
      saving = false;
    }
  }

  async function promoteWinner() {
    if (!winner) return;
    try {
      await injectGodmodeTurn(chat.id, {
        task,
        winningResponse: winner.response,
        winningDna: winner.dna,
        modelId: effectiveModel,
        durationMs: doneAt ?? 0
      });
      onNotify('info', 'Sent to main chat');
    } catch (err) {
      onNotify('error', 'Promote failed: ' + String(err));
    }
  }

  async function promoteCandidate(c: CandidateState) {
    if (!c.dna || !c.response) {
      onNotify('error', 'Can only promote scored candidates with a response');
      return;
    }
    try {
      await injectGodmodeTurn(chat.id, {
        task,
        winningResponse: c.response,
        winningDna: c.dna,
        modelId: effectiveModel
      });
      onNotify('info', 'Sent to main chat');
    } catch (err) {
      onNotify('error', 'Promote failed: ' + String(err));
    }
  }

  async function promoteHistory(row: GodmodeRunRow, record: GodmodeCandidateRecord) {
    try {
      await injectGodmodeTurn(chat.id, {
        task: row.task,
        winningResponse: record.response,
        winningDna: record.dna,
        modelId: row.modelId
      });
      onNotify('info', 'Sent to main chat');
    } catch (err) {
      onNotify('error', 'Promote failed: ' + String(err));
    }
  }

  async function deleteRun(id: string) {
    try {
      await repo.deleteGodmodeRun(id);
      history = history.filter((r) => r.id !== id);
    } catch (err) {
      console.error('[godmode-tab] delete run failed:', err);
    }
  }

  // Ctrl/Cmd+Enter → run. Only active when the task textarea is focused.
  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !running && task.trim()) {
      e.preventDefault();
      void go();
    }
  }

  const runningCount = $derived(candidates.filter((c) => c.status === 'running').length);
  const scoredCount = $derived(candidates.filter((c) => c.status === 'scored').length);
</script>

<div class="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
  <!-- Task input -->
  <label class="flex flex-col gap-1 text-xs">
    <span class="font-medium text-foreground">Task</span>
    <textarea
      bind:value={task}
      rows="4"
      placeholder="What do you want godmode to do?"
      onkeydown={handleKeydown}
      class="resize-y rounded-md border border-border/40 bg-background/40 p-2 font-mono text-xs focus:border-border focus:outline-none"
    ></textarea>
    <span class="text-[10px] text-muted-foreground">Cmd/Ctrl+Enter to run</span>
  </label>

  <!-- K pills -->
  <label class="flex flex-col gap-1 text-xs">
    <span class="font-medium text-foreground">Candidates (K)</span>
    <div class="flex gap-1">
      {#each [3, 6, 12] as k}
        <button
          type="button"
          onclick={() => (K = k as 3 | 6 | 12)}
          class={K === k
            ? 'rounded-full border border-primary/60 bg-primary/20 px-3 py-1 text-xs text-primary'
            : 'rounded-full border border-border/40 bg-transparent px-3 py-1 text-xs text-muted-foreground hover:border-border/70 hover:text-foreground'}
        >{k}</button>
      {/each}
    </div>
  </label>

  <!-- Actions -->
  <div class="flex gap-2">
    {#if running}
      <button type="button" onclick={stop} class="inline-flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Stop</button>
    {:else}
      <button type="button" onclick={go} disabled={!task.trim()} class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">Run godmode</button>
    {/if}
    {#if running}
      <span class="text-[11px] text-muted-foreground">{runningCount} running · {scoredCount} scored</span>
    {/if}
  </div>

  <!-- Status strip -->
  {#if runError}
    <div role="alert" class="rounded-md border border-orange-500/40 bg-orange-500/10 p-2 text-xs text-orange-400">
      <strong>{runError.code}:</strong> {runError.message}
    </div>
  {/if}
  {#if planned && !running && !runError}
    <div class="text-[11px] text-muted-foreground">Done · {scoredCount}/{candidates.length} scored{doneAt ? ` · ${doneAt}ms` : ''}</div>
  {/if}

  <!-- Candidate rows — placeholder until Task 7 lands CandidateRow -->
  {#if candidates.length > 0}
    <ul class="flex flex-col gap-1 text-xs">
      {#each candidates as c (c.idx)}
        <li class="rounded border border-border/40 px-2 py-1">
          <span class="font-mono text-[10px] text-muted-foreground">#{c.idx}</span>
          <span class="ml-2">{c.status}</span>
          {#if c.tier}<span class="ml-2 text-[10px] uppercase">{c.tier}</span>{/if}
          {#if c.score !== undefined}<span class="ml-2 text-[10px]">{c.score.toFixed(2)}</span>{/if}
          {#if c.error}<span class="ml-2 text-orange-400">{c.error}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}

  <!-- Winner card — placeholder until Task 8 lands WinnerCard -->
  {#if winner}
    <div class="rounded-md border border-border/40 bg-background/40 p-3">
      <div class="mb-2 flex items-center gap-2 text-xs">
        <span class="uppercase tracking-wide text-muted-foreground">Winner</span>
        <span class="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary">{winner.tier}</span>
      </div>
      <pre class="whitespace-pre-wrap text-xs">{winner.response}</pre>
      <div class="mt-2 flex gap-2">
        <button type="button" onclick={promoteWinner} class="rounded border border-border/40 px-2 py-1 text-[10px] hover:bg-muted/40">Send to main chat</button>
      </div>
    </div>
  {/if}

  <!-- History — placeholder until Task 9 lands GodmodeHistoryPanel -->
  {#if history.length > 0}
    <details class="rounded-md border border-border/40 p-2 text-xs">
      <summary class="cursor-pointer text-muted-foreground">History ({history.length})</summary>
      <ul class="mt-2 flex flex-col gap-1">
        {#each history as r (r.id)}
          <li class="rounded border border-border/40 px-2 py-1">
            <span class="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
            <span class="ml-2">{r.task.slice(0, 60)}</span>
            <button type="button" onclick={() => promoteHistory(r, r.winner)} class="ml-2 text-[10px] underline">send</button>
            <button type="button" onclick={() => deleteRun(r.id)} class="ml-2 text-[10px] text-destructive">delete</button>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  <!-- Save as custom technique — unchanged from panel.svelte -->
  <div class="border-t border-border/40 pt-3">
    <button
      type="button"
      onclick={() => (saveExpanded = !saveExpanded)}
      aria-expanded={saveExpanded}
      class="text-xs text-muted-foreground hover:text-foreground"
    >{saveExpanded ? '▾' : '▸'} Save as custom technique</button>

    {#if saveExpanded}
      <div class="mt-2 flex flex-col gap-2 text-xs">
        <label class="flex flex-col gap-1">
          <span>Name</span>
          <input type="text" bind:value={saveName} placeholder="e.g. my-research-framing" maxlength="128" class="rounded border border-border/40 bg-background/40 px-2 py-1" />
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={saveDecompose} />
          <span>Decompose into per-DNA-axis rows</span>
        </label>
        <div>
          <button type="button" onclick={save} disabled={saving || !task.trim() || !saveName.trim()} class="rounded border border-border/40 px-3 py-1 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {#if saveError}<div role="alert" class="text-orange-400">{saveError}</div>{/if}
        {#if saveResult}
          <div class="rounded border border-border/40 bg-muted/20 p-2">
            <div><strong>Rows created:</strong> {saveResult.rowIds.length} (mode: {saveResult.analysis.mode}, confidence: {saveResult.analysis.confidence})</div>
            <div><strong>Why it works:</strong> {saveResult.analysis.why_it_works}</div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd app && npm run app:check`
Expected: no new errors in `GodmodeTab.svelte`.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/chat/godmode/GodmodeTab.svelte
git commit -m "feat(godmode): GodmodeTab shell with persistence + promote-to-main

Form state (task, K, save form) persists to chat.settings.godmodeConfig
debounced. Run completion writes a row to godmodeRuns. Winner card +
history list + candidate rows are placeholder styling; F1.3 polish
sub-components land in next commits.

Promote-to-main wired via injectGodmodeTurn for winner, scored
candidates, and history rows."
```

---

## Task 7: `CandidateRow.svelte` — structured candidate render

**Files:**
- Create: `app/src/lib/chat/godmode/CandidateRow.svelte`
- Modify: `app/src/lib/chat/godmode/GodmodeTab.svelte`

- [ ] **Step 1: Create the component**

Create `app/src/lib/chat/godmode/CandidateRow.svelte`:

```svelte
<script lang="ts">
  import type { TechniqueDNA } from './dna';
  import type { RefusalTier } from '../attack-chain-refusal';
  import Loader from 'lucide-svelte/icons/loader-2';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  type Props = {
    idx: number;
    dna: TechniqueDNA | null;
    status: 'running' | 'scored' | 'failed';
    score?: number;
    tier?: RefusalTier;
    preview?: string;
    response?: string;
    error?: string;
    canPromote: boolean;
    onPromote: () => void;
  };
  let { idx, dna, status, score, tier, preview, response, error, canPromote, onPromote }: Props = $props();

  let expanded = $state(false);

  const tierClass = $derived(
    tier === 'refusal' ? 'bg-red-500/20 text-red-400'
    : tier === 'evasive' ? 'bg-orange-500/20 text-orange-400'
    : tier === 'partial' ? 'bg-yellow-500/20 text-yellow-400'
    : tier === 'substantive' ? 'bg-green-500/20 text-green-400'
    : tier === 'compliant' ? 'bg-emerald-500/30 text-emerald-300'
    : 'bg-muted/40 text-muted-foreground'
  );

  function dnaChip(d: TechniqueDNA | null): string {
    if (!d) return '—';
    const parts: string[] = [];
    if (d.mutatorId) parts.push(d.mutatorId);
    if (d.classifierId) parts.push(d.classifierId);
    if (d.wrapperId) parts.push(d.wrapperId);
    parts.push(d.tempBucket);
    return parts.length > 0 ? parts.join(' · ') : 'empty';
  }
</script>

<li class="rounded border border-border/40 bg-background/30 px-2 py-1.5 text-xs">
  <div class="flex items-center gap-2">
    <span class="font-mono text-[10px] text-muted-foreground">#{idx}</span>

    {#if status === 'running'}
      <Loader class="animate-spin" size={11} />
      <span class="text-muted-foreground">{dnaChip(dna)}</span>
    {:else if status === 'scored'}
      <span class={'rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ' + tierClass}>{tier}</span>
      <span class="text-muted-foreground">{dnaChip(dna)}</span>
      {#if score !== undefined}<span class="ml-auto text-[10px] text-muted-foreground">{score.toFixed(2)}</span>{/if}
    {:else if status === 'failed'}
      <AlertTriangle size={11} class="text-orange-400" />
      <span class="text-muted-foreground">{dnaChip(dna)}</span>
      <span class="ml-auto text-[10px] text-orange-400">{error}</span>
    {/if}

    {#if status === 'scored' && preview}
      <button
        type="button"
        onclick={() => (expanded = !expanded)}
        aria-expanded={expanded}
        class="ml-1 text-muted-foreground hover:text-foreground"
        aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
      >
        <ChevronRight size={11} class={expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
      </button>
    {/if}
  </div>

  {#if expanded && preview}
    <div class="mt-1 rounded bg-muted/20 p-2 text-[11px] leading-snug">
      {preview}
      {#if canPromote}
        <div class="mt-1">
          <button
            type="button"
            onclick={onPromote}
            class="inline-flex items-center gap-1 rounded border border-border/40 px-2 py-0.5 text-[10px] hover:bg-muted/40"
          >
            <ArrowRight size={10} /> Send to main chat
          </button>
        </div>
      {/if}
    </div>
  {/if}
</li>
```

- [ ] **Step 2: Replace the placeholder list in `GodmodeTab.svelte`**

In `app/src/lib/chat/godmode/GodmodeTab.svelte`, add at the top of the `<script>` (after other imports):

```ts
import CandidateRow from './CandidateRow.svelte';
```

Replace the placeholder `{#if candidates.length > 0} … {/each} … {/if}` block (the candidate list) with:

```svelte
{#if candidates.length > 0}
  <ul class="flex flex-col gap-1">
    {#each candidates as c (c.idx)}
      <CandidateRow
        idx={c.idx}
        dna={c.dna}
        status={c.status}
        score={c.score}
        tier={c.tier}
        preview={c.preview}
        response={c.response}
        error={c.error}
        canPromote={c.status === 'scored' && !!c.response}
        onPromote={() => promoteCandidate(c)}
      />
    {/each}
  </ul>
{/if}
```

Note: non-winner candidates don't have `response` populated (SSE only sends `preview`). The preview is shown, but `canPromote` guards against promoting without the full response. We'll address this in Task 12 (engine contract tweak) if UX proves the preview insufficient for promotion — YAGNI for now. As-is, only the winner in the current run can be promoted via this row path; other scored candidates can still be promoted via the history panel (which re-reads the persisted response from Dexie).

Wait — the winner DOES have `response` populated via `applyEvent`'s `'winner'` branch. Other scored candidates get `preview` but not `response`. That's correct and expected.

- [ ] **Step 3: Verify it compiles**

Run: `cd app && npm run app:check`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/chat/godmode/CandidateRow.svelte app/src/lib/chat/godmode/GodmodeTab.svelte
git commit -m "feat(godmode): structured CandidateRow with tier badge + DNA chip

Replaces the raw JSON dump from the dev-grade panel. Running state
shows a spinner + DNA chip; scored state shows tier badge + score;
failed state shows error. Expandable preview + per-candidate
'Send to main chat' for scored candidates that also hold a
full response (winner only during in-flight; history rows always)."
```

---

## Task 8: `WinnerCard.svelte` — dedicated winner block with markdown

**Files:**
- Create: `app/src/lib/chat/godmode/WinnerCard.svelte`
- Modify: `app/src/lib/chat/godmode/GodmodeTab.svelte`

- [ ] **Step 1: Inspect existing markdown renderer**

Check where messages in the main chat render markdown — look in `app/src/lib/components/chat/messages/`. If a small reusable markdown component exists (e.g. `MessageMarkdown.svelte`), import it. If the main pattern is inlined in a larger component, skip markdown rendering in the winner card for now and render as a `<pre class="whitespace-pre-wrap">` — the Godmode winner response is plain text from the model and markdown styling is nice-to-have, not required.

Run: `cd app && grep -l "marked\|markdown" src/lib/components/chat/messages/`

If the grep finds nothing reusable, the winner card will use `<pre class="whitespace-pre-wrap">` — acceptable per the spec's "rendered with markdown (reuse the chat's existing markdown renderer)" which only applies IF one exists cleanly.

- [ ] **Step 2: Create the component (without markdown, fallback to pre)**

Create `app/src/lib/chat/godmode/WinnerCard.svelte`:

```svelte
<script lang="ts">
  import type { TechniqueDNA } from './dna';
  import type { RefusalTier } from '../attack-chain-refusal';
  import Copy from 'lucide-svelte/icons/copy';
  import Check from 'lucide-svelte/icons/check';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  type Props = {
    response: string;
    dna: TechniqueDNA;
    tier: RefusalTier;
    onPromote: () => void;
  };
  let { response, dna, tier, onPromote }: Props = $props();

  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(response);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1500);
    } catch {
      // clipboard blocked — silently no-op
    }
  }

  const tierClass = $derived(
    tier === 'refusal' ? 'bg-red-500/20 text-red-400'
    : tier === 'evasive' ? 'bg-orange-500/20 text-orange-400'
    : tier === 'partial' ? 'bg-yellow-500/20 text-yellow-400'
    : tier === 'substantive' ? 'bg-green-500/20 text-green-400'
    : 'bg-emerald-500/30 text-emerald-300'
  );

  function dnaChip(d: TechniqueDNA): string {
    const parts: string[] = [];
    if (d.mutatorId) parts.push(d.mutatorId);
    if (d.classifierId) parts.push(d.classifierId);
    if (d.wrapperId) parts.push(d.wrapperId);
    parts.push(d.tempBucket);
    return parts.length > 0 ? parts.join(' · ') : 'empty';
  }
</script>

<div class="rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
  <div class="mb-2 flex items-center gap-2">
    <span class="uppercase tracking-wide text-[10px] text-muted-foreground">Winner</span>
    <span class={'rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ' + tierClass}>{tier}</span>
    <span class="text-[10px] text-muted-foreground">{dnaChip(dna)}</span>
  </div>
  <pre class="whitespace-pre-wrap rounded bg-background/40 p-2 text-[11px] leading-snug">{response}</pre>
  <div class="mt-2 flex gap-2">
    <button type="button" onclick={copyToClipboard} class="inline-flex items-center gap-1 rounded border border-border/40 px-2 py-1 hover:bg-muted/40">
      {#if copied}<Check size={10} /> Copied{:else}<Copy size={10} /> Copy{/if}
    </button>
    <button type="button" onclick={onPromote} class="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-primary-foreground hover:bg-primary/90">
      <ArrowRight size={10} /> Send to main chat
    </button>
  </div>
</div>
```

- [ ] **Step 3: Replace the placeholder winner block in `GodmodeTab.svelte`**

Add the import at the top of the `<script>`:

```ts
import WinnerCard from './WinnerCard.svelte';
```

Replace the placeholder `{#if winner} … {/if}` block with:

```svelte
{#if winner}
  <WinnerCard
    response={winner.response}
    dna={winner.dna}
    tier={winner.tier}
    onPromote={promoteWinner}
  />
{/if}
```

- [ ] **Step 4: Verify**

Run: `cd app && npm run app:check`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/chat/godmode/WinnerCard.svelte app/src/lib/chat/godmode/GodmodeTab.svelte
git commit -m "feat(godmode): WinnerCard with copy + promote actions

Dedicated result block with tier badge, DNA chip, pre-wrapped
response, and Copy/Send-to-main-chat buttons. Markdown rendering
deferred — response as plain preformatted text until a reusable
renderer lands."
```

---

## Task 9: `GodmodeHistoryPanel.svelte` — expandable history with candidate promotion

**Files:**
- Create: `app/src/lib/chat/godmode/GodmodeHistoryPanel.svelte`
- Modify: `app/src/lib/chat/godmode/GodmodeTab.svelte`

- [ ] **Step 1: Create the component**

Create `app/src/lib/chat/godmode/GodmodeHistoryPanel.svelte`:

```svelte
<script lang="ts">
  import type { GodmodeRunRow, GodmodeCandidateRecord } from '$lib/chat/types';
  import History from 'lucide-svelte/icons/history';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  type Props = {
    runs: GodmodeRunRow[];
    onPromote: (row: GodmodeRunRow, record: GodmodeCandidateRecord) => void;
    onDelete: (id: string) => void;
  };
  let { runs, onPromote, onDelete }: Props = $props();

  let expanded = $state<Set<string>>(new Set());
  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    expanded = next;
  }

  function relativeTime(ts: number): string {
    const delta = Math.max(0, Date.now() - ts);
    const s = Math.floor(delta / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function tierClass(tier: string): string {
    return tier === 'refusal' ? 'bg-red-500/20 text-red-400'
      : tier === 'evasive' ? 'bg-orange-500/20 text-orange-400'
      : tier === 'partial' ? 'bg-yellow-500/20 text-yellow-400'
      : tier === 'substantive' ? 'bg-green-500/20 text-green-400'
      : tier === 'compliant' ? 'bg-emerald-500/30 text-emerald-300'
      : 'bg-muted/40 text-muted-foreground';
  }

  function preview(s: string): string {
    const t = s.trim();
    return t.length <= 60 ? t : t.slice(0, 60) + '…';
  }
</script>

<details class="group rounded-md border border-border/40 bg-background/40 text-xs" open>
  <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground">
    <ChevronRight size={11} class="transition-transform group-open:rotate-90" />
    <History size={11} />
    <span>History</span>
    <span class="ml-auto text-[10px] text-muted-foreground">
      {runs.length === 0 ? 'none' : `${runs.length} run${runs.length === 1 ? '' : 's'}`}
    </span>
  </summary>

  <div class="flex flex-col gap-1 border-t border-border/40 px-2 py-2">
    {#if runs.length === 0}
      <p class="px-2 py-3 text-center text-[11px] text-muted-foreground">No runs yet for this chat.</p>
    {:else}
      {#each runs as row (row.id)}
        <div class="rounded border border-border/40 bg-background/30">
          <div class="flex items-center gap-2 px-2 py-1.5">
            <button
              type="button"
              onclick={() => toggle(row.id)}
              class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              aria-expanded={expanded.has(row.id)}
            >
              <ChevronRight size={10} class={expanded.has(row.id) ? 'rotate-90 transition-transform' : 'transition-transform'} />
            </button>
            <span class={'rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ' + tierClass(row.winner.tier)}>{row.winner.tier}</span>
            <span class="truncate text-[11px]">{preview(row.task)}</span>
            <span class="ml-auto text-[10px] text-muted-foreground">{relativeTime(row.createdAt)}</span>
            <button type="button" onclick={() => onPromote(row, row.winner)} aria-label="Send winner to main chat" class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground">
              <ArrowRight size={11} />
            </button>
            <button type="button" onclick={() => onDelete(row.id)} aria-label="Delete run" class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-destructive">
              <Trash2 size={11} />
            </button>
          </div>

          {#if expanded.has(row.id)}
            <div class="border-t border-border/40 px-2 py-1.5">
              <div class="mb-1 text-[10px] text-muted-foreground">{row.modelId} · K={row.K} · {row.candidates.length + 1} scored</div>
              <!-- Winner -->
              <div class="mb-1 rounded bg-primary/10 p-1.5">
                <div class="flex items-center gap-1 text-[10px]">
                  <span class={'rounded px-1 py-0.5 ' + tierClass(row.winner.tier)}>{row.winner.tier}</span>
                  <span class="text-muted-foreground">winner · {row.winner.score.toFixed(2)}</span>
                </div>
                <div class="mt-1 line-clamp-2 text-[11px] leading-snug">{row.winner.response}</div>
              </div>
              <!-- Candidates -->
              {#each row.candidates as c, i (i)}
                {#if JSON.stringify(c.dna) !== JSON.stringify(row.winner.dna)}
                  <div class="mb-1 rounded bg-background/40 p-1.5">
                    <div class="flex items-center gap-1 text-[10px]">
                      <span class={'rounded px-1 py-0.5 ' + tierClass(c.tier)}>{c.tier}</span>
                      <span class="text-muted-foreground">{c.score.toFixed(2)}</span>
                      <button
                        type="button"
                        onclick={() => onPromote(row, c)}
                        aria-label="Send this candidate to main chat"
                        class="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      >
                        <ArrowRight size={10} />
                      </button>
                    </div>
                    <div class="mt-1 line-clamp-2 text-[11px] leading-snug">{c.response}</div>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</details>
```

- [ ] **Step 2: Replace the placeholder history block in `GodmodeTab.svelte`**

Add the import at the top of the `<script>`:

```ts
import GodmodeHistoryPanel from './GodmodeHistoryPanel.svelte';
```

Replace the placeholder `{#if history.length > 0} … {/if}` block with:

```svelte
{#if history.length > 0}
  <GodmodeHistoryPanel
    runs={history}
    onPromote={promoteHistory}
    onDelete={deleteRun}
  />
{/if}
```

- [ ] **Step 3: Verify**

Run: `cd app && npm run app:check`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/chat/godmode/GodmodeHistoryPanel.svelte app/src/lib/chat/godmode/GodmodeTab.svelte
git commit -m "feat(godmode): per-chat history panel with candidate promotion

Collapsible history list mirrors AttackChain's HistoryPanel. Each
row expands to show the winner + every scored candidate; every
entry has its own 'Send to main chat' action so power users can
pick the #2 candidate when the #1 winner is off-target."
```

---

## Task 10: `AttackWorkspaceSidebar.svelte` — the shared shell

**Files:**
- Create: `app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte`

- [ ] **Step 1: Create the shell component**

Create `app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte`:

```svelte
<script lang="ts">
  import type { ChatRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import AttackChainTab from '$lib/components/chat/attack-chain/AttackChainTab.svelte';
  import GodmodeTab from '$lib/chat/godmode/GodmodeTab.svelte';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import { GODMODE_ENGINE_ENABLED } from '$lib/chat/techniques/godmode';
  import Zap from 'lucide-svelte/icons/zap';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import X from 'lucide-svelte/icons/x';

  type Props = {
    chat: ChatRow;
    activeTab: 'chain' | 'godmode';
    onTabChange: (t: 'chain' | 'godmode') => void;
    onClose: () => void;
    onInsertToComposer: (text: string) => void;
  };
  let { chat, activeTab, onTabChange, onClose, onInsertToComposer }: Props = $props();

  // Inline notify state — swapped for a toast library later if usage warrants.
  let notify = $state<{ kind: 'info' | 'error'; text: string } | null>(null);
  let notifyTimer: ReturnType<typeof setTimeout> | null = null;
  function pushNotify(kind: 'info' | 'error', text: string) {
    notify = { kind, text };
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => (notify = null), 2500);
  }

  // Per-tab unread dot — flips to true when a run completes on the inactive tab.
  // Resets when the user switches to that tab. In MVP we wire only the Godmode
  // signal (a 'winner' event arriving while chain is active); Chain emits no
  // such signal today and the dot stays off for Chain.
  let chainUnread = $state(false);
  let godmodeUnread = $state(false);

  function selectTab(t: 'chain' | 'godmode') {
    if (t === 'chain') chainUnread = false;
    else godmodeUnread = false;
    onTabChange(t);
  }

  // Per-tab model picker state — reads from tab config, persists on change.
  const chainModel = $derived(chat.settings.attackChainConfig?.modelQualifiedId ?? chat.modelQualifiedId);
  const godmodeModel = $derived(chat.settings.godmodeConfig?.modelQualifiedId ?? chat.modelQualifiedId);

  async function onChainModelChange(v: string) {
    try {
      const fresh = await repo.getChat(chat.id);
      const base = fresh?.settings ?? chat.settings;
      await repo.updateChat(chat.id, {
        settings: {
          ...base,
          attackChainConfig: {
            input: base.attackChainConfig?.input ?? '',
            layers: base.attackChainConfig?.layers ?? ['', ''],
            layerParams: base.attackChainConfig?.layerParams ?? [{}, {}],
            layerOutputEdits: base.attackChainConfig?.layerOutputEdits ?? [null, null],
            executeEnabled: base.attackChainConfig?.executeEnabled ?? true,
            finalSystemPrompt: base.attackChainConfig?.finalSystemPrompt ?? '',
            autoRetryEnabled: base.attackChainConfig?.autoRetryEnabled ?? true,
            modelQualifiedId: v
          }
        }
      });
    } catch (err) {
      console.error('[workspace] chain model persist failed:', err);
    }
  }

  async function onGodmodeModelChange(v: string) {
    try {
      const fresh = await repo.getChat(chat.id);
      const base = fresh?.settings ?? chat.settings;
      await repo.updateChat(chat.id, {
        settings: {
          ...base,
          godmodeConfig: {
            task: base.godmodeConfig?.task ?? '',
            K: base.godmodeConfig?.K ?? 6,
            saveForm: base.godmodeConfig?.saveForm ?? { expanded: false, name: '', decompose: false },
            modelQualifiedId: v
          }
        }
      });
    } catch (err) {
      console.error('[workspace] godmode model persist failed:', err);
    }
  }
</script>

<aside
  class="flex h-full w-[440px] shrink-0 flex-col border-l border-border/50 bg-card/30 backdrop-blur-sm"
  aria-label="Attack workspace"
>
  <!-- Sticky header — tab strip + close -->
  <div class="sticky top-0 z-10 flex shrink-0 flex-col gap-2 border-b border-border/50 bg-card/80 px-3 py-2">
    <div class="flex items-center gap-1">
      <button
        type="button"
        onclick={() => selectTab('chain')}
        aria-pressed={activeTab === 'chain'}
        class={activeTab === 'chain'
          ? 'inline-flex items-center gap-1 rounded-md border border-primary/60 bg-primary/20 px-2 py-1 text-xs text-primary'
          : 'inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground'}
      >
        <Zap size={11} />
        Chain
        {#if chainUnread}<span class="ml-1 h-1.5 w-1.5 rounded-full bg-primary"></span>{/if}
      </button>
      {#if GODMODE_ENGINE_ENABLED}
        <button
          type="button"
          onclick={() => selectTab('godmode')}
          aria-pressed={activeTab === 'godmode'}
          class={activeTab === 'godmode'
            ? 'inline-flex items-center gap-1 rounded-md border border-primary/60 bg-primary/20 px-2 py-1 text-xs text-primary'
            : 'inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground'}
        >
          <Sparkles size={11} />
          Godmode
          {#if godmodeUnread}<span class="ml-1 h-1.5 w-1.5 rounded-full bg-primary"></span>{/if}
        </button>
      {/if}
      <button
        type="button"
        onclick={onClose}
        aria-label="Close workspace"
        class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
    <!-- Per-tab model picker -->
    {#if activeTab === 'chain'}
      <ModelPickerV2
        value={chainModel}
        onChange={onChainModelChange}
        recentsKey="cryptex.workspace.chain.recentModels"
        triggerClass="text-xs text-muted-foreground border border-border/40 rounded-md px-2 py-1 hover:border-border/70 hover:text-foreground transition-colors"
      />
    {:else}
      <ModelPickerV2
        value={godmodeModel}
        onChange={onGodmodeModelChange}
        recentsKey="cryptex.workspace.godmode.recentModels"
        triggerClass="text-xs text-muted-foreground border border-border/40 rounded-md px-2 py-1 hover:border-border/70 hover:text-foreground transition-colors"
      />
    {/if}
  </div>

  <!-- Tab bodies — both mounted, inactive is hidden (survives tab switches) -->
  <div class="flex min-h-0 flex-1 flex-col" hidden={activeTab !== 'chain'}>
    <AttackChainTab {chat} {onInsertToComposer} />
  </div>
  {#if GODMODE_ENGINE_ENABLED}
    <div class="flex min-h-0 flex-1 flex-col" hidden={activeTab !== 'godmode'}>
      <GodmodeTab {chat} onNotify={pushNotify} />
    </div>
  {/if}

  <!-- Inline notify toast -->
  {#if notify}
    <div
      role="status"
      class={notify.kind === 'error'
        ? 'absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-orange-500/40 bg-orange-500/20 px-3 py-1.5 text-xs text-orange-400'
        : 'absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-primary/40 bg-primary/20 px-3 py-1.5 text-xs text-primary'}
    >{notify.text}</div>
  {/if}
</aside>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npm run app:check`
Expected: no new errors. (The old `AttackChainSidebar` may still be referenced by `ChatWorkspace`; that's cleaned up in Task 11.)

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/components/chat/workspace/AttackWorkspaceSidebar.svelte
git commit -m "feat(workspace): AttackWorkspaceSidebar shell with tabs + model picker

Single 440px right drawer hosting Chain + Godmode as tabs. Both tabs
stay mounted (inactive hidden) so runs and form state survive tab
switches. Per-tab model picker binds to the active tab's config;
writes through repo.updateChat with fresh read-merge to avoid clobbering
the tab's debounced form persistence.

GODMODE_ENGINE_ENABLED env flag gates the Godmode tab visibility."
```

---

## Task 11: Wire `ChatWorkspace` + `ChatHeader` to the new sidebar

**Files:**
- Modify: `app/src/lib/components/chat/workspace/ChatWorkspace.svelte`
- Modify: `app/src/lib/components/chat/workspace/ChatHeader.svelte`
- Delete: `app/src/lib/components/chat/attack-chain/AttackChainSidebar.svelte`
- Delete: `app/src/lib/chat/godmode/panel.svelte`

- [ ] **Step 1: Update `ChatHeader.svelte` — both buttons dispatch `chat:open-workspace`**

In `app/src/lib/components/chat/workspace/ChatHeader.svelte`:

Change `Props` (line 14):

```ts
type Props = { chat: ChatRow; workspaceOpen?: boolean; workspaceTab?: 'chain' | 'godmode' };
let { chat, workspaceOpen = false, workspaceTab = 'chain' }: Props = $props();
```

Delete the old destructure `attackChainOpen`, `godmodeOpen`.

Replace the Chain button's `onclick` (line 69) with:

```svelte
onclick={() => window.dispatchEvent(new CustomEvent('chat:open-workspace', { detail: { tab: 'chain' } }))}
```

and its `aria-pressed={attackChainOpen}` with `aria-pressed={workspaceOpen && workspaceTab === 'chain'}`.

Similarly for the Godmode button:

```svelte
onclick={() => window.dispatchEvent(new CustomEvent('chat:open-workspace', { detail: { tab: 'godmode' } }))}
```

`aria-pressed={workspaceOpen && workspaceTab === 'godmode'}`.

The `class={…}` expressions referring to `attackChainOpen` / `godmodeOpen` need matching updates:

Chain button's `class`:
```svelte
class={workspaceOpen && workspaceTab === 'chain'
  ? 'inline-flex h-7 items-center gap-1 rounded border border-primary/70 bg-primary/30 px-2 text-xs text-primary ring-1 ring-primary/50 shadow-sm transition-colors'
  : 'inline-flex h-7 items-center gap-1 rounded border border-border/40 bg-transparent px-2 text-xs text-muted-foreground hover:border-border/70 hover:bg-muted/40 hover:text-foreground transition-colors'}
```

Godmode button's `class`:
```svelte
class={workspaceOpen && workspaceTab === 'godmode'
  ? 'inline-flex h-7 items-center gap-1 rounded border border-primary/70 bg-primary/30 px-2 text-xs text-primary ring-1 ring-primary/50 shadow-sm transition-colors'
  : 'inline-flex h-7 items-center gap-1 rounded border border-border/40 bg-transparent px-2 text-xs text-muted-foreground hover:border-border/70 hover:bg-muted/40 hover:text-foreground transition-colors'}
```

- [ ] **Step 2: Update `ChatWorkspace.svelte` — single sidebar + unified event**

Replace the contents of `app/src/lib/components/chat/workspace/ChatWorkspace.svelte`:

```svelte
<script lang="ts">
  import type { ChatRow, MessageRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import { continueAssistantMessage } from '$lib/chat/dispatch';
  import ChatHeader from './ChatHeader.svelte';
  import MessageList from './MessageList.svelte';
  import Composer from '../composer/Composer.svelte';
  import AttackWorkspaceSidebar from './AttackWorkspaceSidebar.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import { onMount } from 'svelte';

  type Props = { chat: ChatRow };
  let { chat }: Props = $props();
  let messages = $state<MessageRow[]>([]);
  let streaming = $state(false);
  let messageListEl = $state<{ scrollToBottom: () => void; scrollToBottomIfPinned: () => void } | null>(null);

  let streamingContent = $state('');
  let streamingReasoning = $state('');
  let workspaceOpen = $state(chat.settings.workspaceOpen ?? false);
  let workspaceTab = $state<'chain' | 'godmode'>(chat.settings.workspaceTab ?? 'chain');

  // Keep local state synced with prop changes on navigation.
  $effect(() => {
    workspaceOpen = chat.settings.workspaceOpen ?? false;
    workspaceTab = chat.settings.workspaceTab ?? 'chain';
  });

  let activeMode = $state<string | null>(chat.settings.activeMode ?? null);
  $effect(() => { activeMode = chat.settings.activeMode ?? null; });

  async function setActiveMode(id: string | null) {
    activeMode = id;
    try {
      await repo.updateChat(chat.id, { settings: { ...chat.settings, activeMode: id } });
    } catch (err) {
      console.error('[mode] failed:', err);
      alert('Mode update failed: ' + (err as Error).message);
      activeMode = chat.settings.activeMode ?? null;
    }
  }

  async function persistWorkspaceState(open: boolean, tab: 'chain' | 'godmode') {
    try {
      const fresh = await repo.getChat(chat.id);
      const base = fresh?.settings ?? chat.settings;
      await repo.updateChat(chat.id, {
        settings: { ...base, workspaceOpen: open, workspaceTab: tab }
      });
    } catch (err) {
      console.error('[workspace] persist failed:', err);
    }
  }

  async function refresh() { messages = await repo.listMessages(chat.id); }
  $effect(() => { refresh(); });

  $effect(() => {
    messages.length;
    messageListEl?.scrollToBottom();
  });

  function onMessageAppended(msg: MessageRow) {
    messages = [...messages, msg];
    refresh();
    streamingContent = '';
    streamingReasoning = '';
  }

  function onTextDelta(delta: string) {
    streamingContent += delta;
    messageListEl?.scrollToBottomIfPinned();
  }
  function onReasoningDelta(delta: string) { streamingReasoning += delta; }

  let continueCtrl = $state<AbortController | null>(null);

  async function handleContinueMessage(messageId: string) {
    if (streaming) return;
    streaming = true;
    continueCtrl = new AbortController();
    try {
      await continueAssistantMessage(chat, messageId, continueCtrl.signal, {
        onTextDelta,
        onReasoningDelta,
        onFinish: (msg) => onMessageAppended(msg),
        onError: (err) => { console.error('[continue]', err); }
      });
    } finally {
      streaming = false;
      continueCtrl = null;
    }
  }

  onMount(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: 'chain' | 'godmode' }>).detail?.tab;
      if (workspaceOpen && (!tab || tab === workspaceTab)) {
        // Clicking the same button while open closes the drawer.
        workspaceOpen = false;
      } else {
        workspaceOpen = true;
        if (tab) workspaceTab = tab;
      }
      void persistWorkspaceState(workspaceOpen, workspaceTab);
    };
    window.addEventListener('chat:open-workspace', handler);

    const continueHandler = (e: Event) => {
      const id = (e as CustomEvent<{ messageId: string }>).detail?.messageId;
      if (typeof id === 'string') void handleContinueMessage(id);
    };
    window.addEventListener('chat:continue-message', continueHandler);

    return () => {
      window.removeEventListener('chat:open-workspace', handler);
      window.removeEventListener('chat:continue-message', continueHandler);
    };
  });

  function onTabChange(t: 'chain' | 'godmode') {
    workspaceTab = t;
    void persistWorkspaceState(workspaceOpen, t);
  }

  function onWorkspaceClose() {
    workspaceOpen = false;
    void persistWorkspaceState(false, workspaceTab);
  }
</script>

<div class="flex h-full w-full min-h-0 overflow-hidden">
  <div class="fade-in flex h-full min-w-0 min-h-0 flex-1 flex-col gap-2 overflow-hidden">
    <ChatHeader {chat} {workspaceOpen} {workspaceTab} />
    <div class="px-3 pt-1"><NoProviderBanner context="chat" compact={true} /></div>
    <MessageList
      bind:this={messageListEl}
      {chat}
      {messages}
      {streaming}
      {streamingContent}
      {streamingReasoning}
    />

    <Composer
      {chat}
      {activeMode}
      onModeChange={setActiveMode}
      {onMessageAppended}
      {onTextDelta}
      {onReasoningDelta}
      onStreamingChanged={(v) => (streaming = v)}
    />
  </div>

  {#if workspaceOpen}
    <AttackWorkspaceSidebar
      {chat}
      activeTab={workspaceTab}
      {onTabChange}
      onClose={onWorkspaceClose}
      onInsertToComposer={(text) =>
        window.dispatchEvent(new CustomEvent('composer:insert', { detail: { text } }))}
    />
  {/if}
</div>
```

- [ ] **Step 3: Delete the old sidebar + panel files**

```bash
rm app/src/lib/components/chat/attack-chain/AttackChainSidebar.svelte
rm app/src/lib/chat/godmode/panel.svelte
```

- [ ] **Step 4: Verify no stale references remain**

Run: `cd app && grep -r "AttackChainSidebar\|godmode/panel" src/ --include="*.svelte" --include="*.ts"`
Expected: no matches. If any test file still imports from these paths, update the import to the new path (unlikely; neither file had direct imports besides `ChatWorkspace`).

Run: `cd app && grep -r "chat:open-attack-chain\|chat:open-godmode" src/ --include="*.svelte" --include="*.ts"`
Expected: no matches. If any match remains, update to `chat:open-workspace`.

- [ ] **Step 5: Typecheck + build**

Run: `cd app && npm run app:check`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(workspace): swap to unified AttackWorkspaceSidebar

ChatWorkspace mounts one drawer instead of two siblings. Both
Chain + Godmode buttons dispatch chat:open-workspace with a tab
detail; clicking the active tab's button closes the drawer,
clicking the inactive tab's button switches tabs.

Workspace open/close + active tab persist to chat.settings so
reopening a chat restores the drawer state. Old AttackChainSidebar
and panel.svelte deleted."
```

---

## Task 12: Component test — tab-switch state survival

**Files:**
- Create: `app/src/lib/components/chat/workspace/__tests__/AttackWorkspaceSidebar.test.ts`

- [ ] **Step 1: Check how other Svelte component tests are set up**

Run: `cd app && ls src/lib/components/chat/attack-chain/__tests__/ 2>/dev/null; grep -rl "@testing-library/svelte\|vitest-browser-svelte" src/ --include="*.test.ts" | head -5`

If no Svelte-component tests exist in this codebase (only `.ts` unit tests for pure modules), this task becomes an integration-shaped unit test that mocks props and checks the derived state rather than rendering DOM. Proceed with the module-level test below.

- [ ] **Step 2: Write the test**

Create `app/src/lib/components/chat/workspace/__tests__/AttackWorkspaceSidebar.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

beforeEach(() => {
  indexedDB.deleteDatabase('cryptex-chat');
  vi.resetModules();
});

describe('workspace sidebar state persistence', () => {
  it('persistWorkspaceState writes tab + open state to chat.settings', async () => {
    const { repo } = await import('$lib/chat/repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });

    // Simulate the ChatWorkspace persistWorkspaceState helper inline —
    // the helper is a 5-line read-merge-write that we verify by calling
    // repo.updateChat directly with the same shape.
    const fresh = await repo.getChat(chat.id);
    await repo.updateChat(chat.id, {
      settings: { ...fresh!.settings, workspaceOpen: true, workspaceTab: 'godmode' }
    });

    const after = await repo.getChat(chat.id);
    expect(after!.settings.workspaceOpen).toBe(true);
    expect(after!.settings.workspaceTab).toBe('godmode');
  });

  it('chain model change does not overwrite godmode model (and vice versa)', async () => {
    const { repo } = await import('$lib/chat/repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'base' });

    // First: set chain model
    await repo.updateChat(chat.id, {
      settings: {
        ...chat.settings,
        attackChainConfig: {
          input: '', layers: [], layerParams: [], layerOutputEdits: [],
          executeEnabled: true, finalSystemPrompt: '', autoRetryEnabled: true,
          modelQualifiedId: 'chain-model'
        }
      }
    });

    // Then: set godmode model
    const mid = await repo.getChat(chat.id);
    await repo.updateChat(chat.id, {
      settings: {
        ...mid!.settings,
        godmodeConfig: {
          task: '', K: 6,
          saveForm: { expanded: false, name: '', decompose: false },
          modelQualifiedId: 'godmode-model'
        }
      }
    });

    const after = await repo.getChat(chat.id);
    expect(after!.settings.attackChainConfig?.modelQualifiedId).toBe('chain-model');
    expect(after!.settings.godmodeConfig?.modelQualifiedId).toBe('godmode-model');
  });
});
```

- [ ] **Step 3: Run the test**

Run: `cd app && npx vitest run src/lib/components/chat/workspace/__tests__/AttackWorkspaceSidebar.test.ts`
Expected: PASS. Both cases use only `repo` (no component mount), verifying the state-persistence contract the workspace relies on.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/components/chat/workspace/__tests__/AttackWorkspaceSidebar.test.ts
git commit -m "test(workspace): state persistence contract for workspace sidebar

Covers tab+open persistence and the independence of per-tab
model-picker writes. Verifies the repo shape AttackWorkspaceSidebar's
persist helpers depend on."
```

---

## Task 13: Component test — GodmodeTab run persistence

**Files:**
- Create: `app/src/lib/chat/godmode/__tests__/GodmodeTab.test.ts`

- [ ] **Step 1: Write the test**

Create `app/src/lib/chat/godmode/__tests__/GodmodeTab.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

beforeEach(() => {
  indexedDB.deleteDatabase('cryptex-chat');
  vi.resetModules();
});

describe('godmode run history contract', () => {
  it('saveGodmodeRun + listGodmodeRuns round-trip with successful candidates only', async () => {
    const { repo } = await import('$lib/chat/repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const winnerDna = { mutatorId: 'roleplay', classifierId: null, wrapperId: null, modeId: null, prefillId: null, tempBucket: 'med' as const, source: 'builtin' as const };
    const loserDna = { mutatorId: null, classifierId: 'base64_like', wrapperId: null, modeId: null, prefillId: null, tempBucket: 'low' as const, source: 'builtin' as const };
    await repo.saveGodmodeRun({
      chatId: chat.id,
      task: 'hello',
      K: 3,
      modelId: 'anthropic:claude-sonnet-4-6',
      winner: { dna: winnerDna, response: 'hi!', score: 0.85, tier: 'substantive', preview: 'hi!' },
      candidates: [
        { dna: winnerDna, response: 'hi!', score: 0.85, tier: 'substantive', preview: 'hi!' },
        { dna: loserDna, response: 'hello', score: 0.6, tier: 'partial', preview: 'hello' }
      ]
    });
    const list = await repo.listGodmodeRuns(chat.id);
    expect(list).toHaveLength(1);
    expect(list[0].winner.tier).toBe('substantive');
    expect(list[0].candidates).toHaveLength(2);
  });

  it('injectGodmodeTurn emits tagged messages that the Dataset Inspector surface picks up', async () => {
    const { injectGodmodeTurn } = await import('$lib/chat/dispatch');
    const { repo } = await import('$lib/chat/repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const winnerDna = { mutatorId: 'roleplay', classifierId: null, wrapperId: null, modeId: null, prefillId: null, tempBucket: 'med' as const, source: 'builtin' as const };
    await injectGodmodeTurn(chat.id, {
      task: 'hello',
      winningResponse: 'hi!',
      winningDna: winnerDna,
      modelId: 'anthropic:claude-sonnet-4-6',
      durationMs: 100
    });
    const msgs = await repo.listMessages(chat.id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].modeApplied).toBe('__godmode__');
    expect(msgs[0].tags).toContain('godmode');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].parentId).toBe(msgs[0].id);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd app && npx vitest run src/lib/chat/godmode/__tests__/GodmodeTab.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/chat/godmode/__tests__/GodmodeTab.test.ts
git commit -m "test(godmode): run history + promote-to-main contract

Covers the two integration points GodmodeTab.svelte depends on:
saveGodmodeRun round-trip preserves winner + all successful
candidates; injectGodmodeTurn writes tagged user+assistant pair
the Dataset Inspector surfaces under '__godmode__' modeApplied."
```

---

## Task 14: Full-suite verification + manual smoke pass

**Files:** —

- [ ] **Step 1: Run full unit test suite**

Run: `cd app && npm run app:test`
Expected: PASS for all the new tests. The 4 pre-existing flaky cases in `repo.test.ts` / `dispatch.test.ts` (verified earlier in the session to be unrelated to this feature) may still flake — re-run once if they do. Any NEW failures must be fixed before proceeding.

- [ ] **Step 2: Svelte-check**

Run: `cd app && npm run app:check`
Expected: no new errors from files in this plan's scope.

- [ ] **Step 3: Build**

Run: `npm run build` (from root)
Expected: build succeeds; promote-dist writes `dist/`.

- [ ] **Step 4: Manual smoke (Chromium) — scenarios**

Start dev: `npm run app:dev` (from root, default port 5173).

Perform all scenarios. Each that passes is a `✅` line in the commit message; each failure is a bug to fix before marking the task complete.

**Scenario A — single drawer, two tabs.** Open a chat. Click Chain button → drawer opens on Chain tab. Click Godmode button → same drawer switches to Godmode tab. Click Chain button again → drawer switches back to Chain. Only one drawer visible throughout.

**Scenario B — tab state survives close/reopen.** Open drawer, Chain tab, type "hello" in the layer input. Close drawer (X button). Reopen via Chain button. Input still shows "hello".

**Scenario C — per-tab model picker.** On Chain tab, pick model `openrouter:anthropic/claude-sonnet-4.5`. Switch to Godmode tab. Pick different model `anthropic:claude-haiku-4-5`. Switch back to Chain. Model still shows `claude-sonnet-4.5`. Switch to Godmode. Still shows `haiku-4-5`. Neither picker affected the main chat header's model.

**Scenario D — Godmode run + winner card + promote.** On Godmode tab, enter a benign task ("write a haiku about clouds"), K=3, Run. Verify: candidate rows appear with spinners → swap to tier badges. Winner card appears with tier badge + DNA chip + Copy + Send to main chat. Click Send → toast "Sent to main chat". Scroll main chat → user message "write a haiku about clouds" + assistant with the winning haiku, both tagged godmode.

**Scenario E — Godmode history + non-winner promote.** After Scenario D, close drawer. Reopen via Godmode button. History panel shows the prior run. Expand → see winner + any non-winner candidates. Click Send on a non-winner → main chat shows a second user+assistant pair using that candidate's response.

**Scenario F — switch tabs mid-run.** Start a Godmode run. Switch to Chain tab while spinners still visible. Switch back to Godmode. The spinners/scored rows are still the same ones — run didn't restart.

**Scenario G — close mid-run.** Start a Godmode run. Close drawer. Wait 10s. Reopen. Run is still in flight or completed; no state loss.

- [ ] **Step 5: Commit the smoke report as a comment**

If all 7 scenarios passed:

```bash
git commit --allow-empty -m "chore(workspace): manual smoke pass for unified sidebar

✅ A: single drawer, two tabs
✅ B: tab state survives close/reopen
✅ C: per-tab model picker independence
✅ D: Godmode run → winner card → promote-to-main
✅ E: history → non-winner candidate promotion
✅ F: tab switch mid-run preserves state
✅ G: close mid-run preserves run state"
```

If any scenario failed: the implementer fixes the failure before marking this task complete — do not proceed to finishing-a-development-branch with known regressions.

---

## Scope Check / Spec Coverage

Mapping every spec section to its implementing task:

| Spec section | Task(s) |
|---|---|
| D1 (shared shell + Godmode polish) | 6, 7, 8, 9, 10 |
| D2 (per-chat full run history) | 1, 2, 3, 6, 9 |
| D3 (per-tab independent model picker) | 1, 5, 10, 12 |
| D4 (single-run promote; winner + non-winner) | 4, 6, 7, 9 |
| D5 (winner + successful candidates only) | 1, 6, 13 |
| Architecture — new `AttackWorkspaceSidebar` | 10 |
| Architecture — extracted tabs | 5, 6 |
| Data shape changes (ChatSettings, GodmodeConfig, GodmodeRunRow) | 1 |
| Dexie schema bump | 2 |
| Repo methods | 3 |
| Persistence triggers (tab, open, form debounce, run completion) | 6, 10, 11 |
| UI polish — candidate rows, winner card, history panel, K pills, empty state, keyboard shortcut | 6, 7, 8, 9 |
| Error handling (toasts, non-blocking saves) | 6, 10 |
| Tests — repo, dispatch, component | 2, 3, 4, 12, 13 |
| Manual smoke scenarios | 14 |
| Rollout — atomic PR, no feature flag (beyond GODMODE_ENGINE_ENABLED) | 11 |

## Known deferred items (not this plan)

Per spec's "Out of scope":
- OpenRouter / OpenAI-compat adapters (F3 follow-up).
- Counter-based round-robin / memoization perf (F4 follow-up).
- Custom-techniques library browser (Subsystem D).
- "Continue from here" auto mode+model switch on promote.
- Bulk promote of full history as a thread.
- Markdown rendering in WinnerCard — text-only `<pre>` until a reusable renderer lands (Task 8).
- Native toast library — inline banner in workspace for now (Task 10).
