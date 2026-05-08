/**
 * Per-run cost accumulator for the chain workspace.
 *
 * The chain engines (v4 PAIR / TAP / Crescendo) emit `usage` OrchEvents
 * after every gateway call. AttackChainTab.svelte forwards each event
 * into `chainCostActions.accumulate()`, which sums tokens per role and
 * computes USD via `pricing.ts` lookups. The compact `CostChip.svelte`
 * in the chain sidebar header reads `chainCost` directly to render the
 * live total + breakdown popover.
 *
 * Idle semantics: when no run is in progress and no saved row has been
 * loaded, `chainCost.totalInputTokens === 0 && !chainCost.running` —
 * the chip hides itself.
 *
 * Pricing semantics: when ANY model in the run lacks pricing data,
 * `totalCostUsd` becomes null for the entire run. The chip falls back
 * to displaying tokens-only ("12.5K tokens") in that case so users
 * still see scope.
 */
import { costFromUsage } from '$lib/ai/pricing';

type Role = 'orchestrator' | 'target' | 'judge';

export type RoleUsage = {
  inputTokens: number;
  outputTokens: number;
  /** USD attributed to this role; null when ANY of its models lacks pricing. */
  costUsd: number | null;
  /** Number of usage events accumulated for this role. */
  calls: number;
};

export type ChainCostState = {
  /** True while a run is actively emitting usage events. */
  running: boolean;
  /** The AttackSessionRow.id of the run we're tracking, or null. */
  sessionId: string | null;
  /** Sum of all roles' input tokens. */
  totalInputTokens: number;
  /** Sum of all roles' output tokens. */
  totalOutputTokens: number;
  /** USD total. Null when at least one usage event came from a model
   *  without pricing data. */
  totalCostUsd: number | null;
  /** Per-role accumulated usage. */
  byRole: Record<Role, RoleUsage>;
  /** Per-model accumulated usage (model id → totals). */
  byModel: Map<string, RoleUsage>;
  /** When the run started, for elapsed-time display. Null when idle. */
  startedAt: number | null;
};

function emptyRoleUsage(): RoleUsage {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 };
}

function emptyState(): ChainCostState {
  return {
    running: false,
    sessionId: null,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    byRole: {
      orchestrator: emptyRoleUsage(),
      target: emptyRoleUsage(),
      judge: emptyRoleUsage()
    },
    byModel: new Map(),
    startedAt: null
  };
}

let _state = $state<ChainCostState>(emptyState());

export const chainCost = {
  get running() { return _state.running; },
  get sessionId() { return _state.sessionId; },
  get totalInputTokens() { return _state.totalInputTokens; },
  get totalOutputTokens() { return _state.totalOutputTokens; },
  get totalCostUsd() { return _state.totalCostUsd; },
  get byRole() { return _state.byRole; },
  get byModel() { return _state.byModel; },
  get startedAt() { return _state.startedAt; },
  /** True when the chip should be hidden (no data and no active run). */
  get isEmpty() {
    return !_state.running && _state.totalInputTokens === 0 && _state.totalOutputTokens === 0;
  }
};

export type UsageEvent = {
  role: Role;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export const chainCostActions = {
  /** Reset for a new run. Called from AttackChainTab.run(). */
  resetForRun(sessionId: string): void {
    _state = {
      ...emptyState(),
      running: true,
      sessionId,
      startedAt: Date.now()
    };
  },

  /** Accumulate one `usage` OrchEvent into the current run state. */
  accumulate(ev: UsageEvent): void {
    if (!ev || (ev.inputTokens === 0 && ev.outputTokens === 0)) return;
    const cost = costFromUsage(ev.model, ev.inputTokens, ev.outputTokens);

    // Update totals — if cost is null for this event, the whole-run total
    // becomes null too (we can't honestly report a $ figure when part of
    // the run isn't priced).
    const newTotal =
      _state.totalCostUsd === null || cost === null
        ? null
        : _state.totalCostUsd + cost;

    // Update per-role bucket.
    const prevRole = _state.byRole[ev.role];
    const nextRole: RoleUsage = {
      inputTokens: prevRole.inputTokens + ev.inputTokens,
      outputTokens: prevRole.outputTokens + ev.outputTokens,
      costUsd:
        prevRole.costUsd === null || cost === null ? null : prevRole.costUsd + cost,
      calls: prevRole.calls + 1
    };

    // Update per-model bucket.
    const prevModel = _state.byModel.get(ev.model) ?? emptyRoleUsage();
    const nextModel: RoleUsage = {
      inputTokens: prevModel.inputTokens + ev.inputTokens,
      outputTokens: prevModel.outputTokens + ev.outputTokens,
      costUsd:
        prevModel.costUsd === null || cost === null ? null : prevModel.costUsd + cost,
      calls: prevModel.calls + 1
    };

    const nextByModel = new Map(_state.byModel);
    nextByModel.set(ev.model, nextModel);

    _state = {
      ..._state,
      totalInputTokens: _state.totalInputTokens + ev.inputTokens,
      totalOutputTokens: _state.totalOutputTokens + ev.outputTokens,
      totalCostUsd: newTotal,
      byRole: { ..._state.byRole, [ev.role]: nextRole },
      byModel: nextByModel
    };
  },

  /** Mark the run as finished — stops the elapsed-time clock from
   *  advancing in the chip but keeps the totals visible. */
  markFinished(): void {
    _state = { ..._state, running: false };
  },

  /** Restore a saved AttackSessionRow's cached cost into the chip.
   *  We only have the total (per-role breakdown isn't persisted), so
   *  callers see a single dollar figure — no popover detail rows.
   *  Pass null for `costEstimateUsd` (or omit) to clear back to idle. */
  loadSaved(sessionId: string, costEstimateUsd: number | null | undefined): void {
    if (!costEstimateUsd && costEstimateUsd !== 0) {
      // No cost data — clear chip.
      _state = emptyState();
      return;
    }
    _state = {
      ...emptyState(),
      sessionId,
      totalCostUsd: costEstimateUsd
    };
  },

  /** Clear all state — used when the user closes the chain workspace
   *  or the chat is unmounted. */
  clear(): void {
    _state = emptyState();
  }
};
