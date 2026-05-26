/**
 * Supabase sync provider — direct PostgREST (no @supabase/supabase-js SDK).
 *
 * Rationale for skipping the SDK:
 *   - The SDK is ~100KB minified+gzipped. Cryptex's whole rationale is a
 *     lean static bundle.
 *   - Our access pattern is two REST endpoints (synced_runs,
 *     synced_vault_items) with upsert + delete. The SDK adds no value here.
 *   - Direct fetch keeps the bundle dependency surface small + auditable.
 *
 * PostgREST upsert: `Prefer: resolution=merge-duplicates` header on POST.
 * RLS expected: user owns their own Supabase project, anon key has full
 * access via `using (true)`. The user runs the schema in docs/SUPABASE.md.
 */

import type { ToolRun } from '$lib/history/types';
import type { VaultItem } from '$lib/vault/types';
import type { SyncConfig, SyncProvider } from './types';

const RUNS_TABLE = 'synced_runs';
const VAULT_TABLE = 'synced_vault_items';

/**
 * Construct a Supabase sync provider from a validated SyncConfig.
 * Throws synchronously if URL/key are missing — call validateConfig() first.
 */
export function createSupabaseProvider(config: SyncConfig): SyncProvider {
  const url = (config.supabaseUrl ?? '').replace(/\/+$/, '');
  const key = config.supabaseAnonKey ?? '';
  if (!url || !key) {
    throw new Error('Supabase URL and anon key are required to create the provider.');
  }
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  async function postUpsert(table: string, body: unknown): Promise<void> {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase upsert ${table} failed (${res.status}): ${text || res.statusText}`);
    }
  }

  async function deleteById(table: string, idValue: string, extraFilter = ''): Promise<void> {
    const q = `id=eq.${encodeURIComponent(idValue)}${extraFilter ? `&${extraFilter}` : ''}`;
    const res = await fetch(`${url}/rest/v1/${table}?${q}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase delete ${table} failed (${res.status}): ${text || res.statusText}`);
    }
  }

  function runToRow(run: ToolRun): Record<string, unknown> {
    return {
      id: run.id,
      tool_id: run.toolId,
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      duration_ms: run.durationMs,
      status: run.status,
      input_summary: run.inputSummary,
      output_summary: run.outputSummary,
      params: run.params ?? {},
      size_bytes: run.sizeBytes,
      pinned: run.pinned ?? false,
      annotation: run.annotation ?? null,
      error_category: run.errorCategory ?? null,
      error_message: run.errorMessage ?? null
    };
  }

  function vaultItemToRow(toolId: string, item: VaultItem<unknown>): Record<string, unknown> {
    return {
      id: item.id,
      tool_id: toolId,
      title: item.title,
      description: item.description ?? null,
      payload: item.payload,
      tags: item.tags,
      source: item.source,
      source_url: (item as { sourceUrl?: string }).sourceUrl ?? null,
      license: (item as { license?: string }).license ?? null,
      added_at: item.addedAt,
      pinned: item.pinned ?? false,
      notes: (item as { notes?: string }).notes ?? null
    };
  }

  return {
    id: 'supabase',

    async validate() {
      try {
        // Cheapest reachable check: HEAD on the runs table. PostgREST returns
        // 200 with an empty body when the table exists and the anon key is valid.
        const res = await fetch(`${url}/rest/v1/${RUNS_TABLE}?select=id&limit=1`, {
          method: 'GET',
          headers
        });
        if (res.ok) return { ok: true };
        const text = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 403) {
          return { ok: false, error: 'Anon key rejected (401/403). Check the key.' };
        }
        if (res.status === 404 || /relation .* does not exist/i.test(text)) {
          return {
            ok: false,
            error: `Table "${RUNS_TABLE}" not found. Run the schema in docs/SUPABASE.md inside your Supabase SQL Editor.`
          };
        }
        return { ok: false, error: `HTTP ${res.status}: ${text || res.statusText}` };
      } catch (err) {
        return { ok: false, error: (err as Error).message ?? 'Network unreachable.' };
      }
    },

    async syncRun(run) {
      await postUpsert(RUNS_TABLE, runToRow(run));
    },

    async deleteRun(id) {
      await deleteById(RUNS_TABLE, id);
    },

    async syncVaultItem(toolId, item) {
      await postUpsert(VAULT_TABLE, vaultItemToRow(toolId, item));
    },

    async deleteVaultItem(toolId, id) {
      await deleteById(VAULT_TABLE, id, `tool_id=eq.${encodeURIComponent(toolId)}`);
    },

    async initialSync({ runs, vaultByTool }) {
      let runsPushed = 0;
      let vaultPushed = 0;
      // Chunked upsert to stay under PostgREST's payload limits.
      const CHUNK = 100;

      for (let i = 0; i < runs.length; i += CHUNK) {
        const slice = runs.slice(i, i + CHUNK).map(runToRow);
        if (slice.length === 0) continue;
        await postUpsert(RUNS_TABLE, slice);
        runsPushed += slice.length;
      }

      for (const [toolId, items] of Object.entries(vaultByTool)) {
        const userItems = items.filter((it) => it.source === 'user');
        for (let i = 0; i < userItems.length; i += CHUNK) {
          const slice = userItems.slice(i, i + CHUNK).map((it) => vaultItemToRow(toolId, it));
          if (slice.length === 0) continue;
          await postUpsert(VAULT_TABLE, slice);
          vaultPushed += slice.length;
        }
      }

      return { runsPushed, vaultPushed };
    }
  };
}

/** Quick string check for the Settings panel. Does not hit the network. */
export function isLikelyValidConfig(c: Partial<SyncConfig>): boolean {
  if (!c.supabaseUrl || !c.supabaseAnonKey) return false;
  try {
    const u = new URL(c.supabaseUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (!u.hostname.length) return false;
  } catch {
    return false;
  }
  // Anon keys are JWT-shaped: three base64url segments separated by '.'.
  return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(c.supabaseAnonKey);
}
