/**
 * Sync layer (v2.2): opt-in BYO cloud-sync for history runs + Vault customs.
 *
 * Design constraints (locked):
 *   - Default OFF. Nothing syncs unless the user enables it in Settings.
 *   - BYOK provider keys (OpenAI / Anthropic / OpenRouter / etc.) NEVER sync.
 *     They stay in localStorage, period.
 *   - "BYO Supabase" — user provides their own Supabase project URL + anon key.
 *     We never see their data; the sync goes browser -> their Supabase only.
 *   - Fire-and-forget — sync calls do not block local writes. If the network
 *     is down or the project is misconfigured, local-first UX is preserved.
 *   - Adapter pattern: new providers (Firebase, custom REST, etc.) plug in
 *     by implementing the SyncProvider interface. Today only Supabase is
 *     shipped, but the surface is provider-agnostic.
 */

import type { ToolRun } from '$lib/history/types';
import type { VaultItem } from '$lib/vault/types';

/** Provider identity. Add a new id when introducing a second backend. */
export type SyncProviderId = 'supabase';

/** Sync configuration stored in localStorage under `cryptex.sync.config`. */
export interface SyncConfig {
  enabled: boolean;
  provider: SyncProviderId;
  /** Supabase project URL, e.g. `https://abcdefgh.supabase.co`. */
  supabaseUrl?: string;
  /** Supabase anon key (project-scoped). */
  supabaseAnonKey?: string;
  /** Local timestamp of the most recent successful round-trip. */
  lastSyncedAt?: number;
}

/** Status surface for the Settings Cloud Sync panel. */
export type SyncStatus =
  | { kind: 'disabled' }
  | { kind: 'idle'; lastSyncedAt?: number }
  | { kind: 'syncing'; queued: number }
  | { kind: 'error'; message: string; lastSyncedAt?: number };

/**
 * Adapter contract. Each operation is fire-and-forget from the caller's
 * perspective — implementations must NOT throw synchronously past the
 * Promise boundary; surface errors via the rejection only.
 */
export interface SyncProvider {
  /** Provider identity (for telemetry / future multi-provider configs). */
  readonly id: SyncProviderId;

  /** Sanity-check the configuration before enabling. Returns ok or an explicit error. */
  validate(): Promise<{ ok: true } | { ok: false; error: string }>;

  /** Upsert a history run by id. Idempotent. */
  syncRun(run: ToolRun): Promise<void>;

  /** Delete a history run by id. */
  deleteRun(id: string): Promise<void>;

  /**
   * Upsert a Vault custom item by id. `toolId` is the per-tool namespace,
   * required by the table schema for filter / cleanup queries.
   */
  syncVaultItem(toolId: string, item: VaultItem<unknown>): Promise<void>;

  /** Delete a Vault item by id, scoped to a tool. */
  deleteVaultItem(toolId: string, id: string): Promise<void>;

  /**
   * Bulk-upload everything currently in local stores. Used on initial
   * "enable sync" so the user's existing local history + customs land
   * in the cloud project. Returns the number of records pushed.
   */
  initialSync(args: {
    runs: ToolRun[];
    vaultByTool: Record<string, VaultItem<unknown>[]>;
  }): Promise<{ runsPushed: number; vaultPushed: number }>;
}
