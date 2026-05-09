import type { ProviderRecord, ProviderId } from './types';
import { getKeyStorage } from './storage-strategy';
import { presetRequiresKey } from './presets';

const STORAGE_KEY = 'cryptex.providers';

// Storage selection is delegated to `storage-strategy.ts` so the user can
// flip between localStorage (default) and sessionStorage (ephemeral, opt-in
// in Settings → Security). Reads check both so a flip mid-session still
// finds existing data.
//
// API keys are kept as plaintext in localStorage (or sessionStorage when the
// ephemeral toggle is on). No server-side storage or encryption is used.

function tryGetLS(key: string): string | null {
  try {
    const primary = getKeyStorage();
    if (primary) {
      const v = primary.getItem(key);
      if (v !== null) return v;
    }
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    }
    if (typeof sessionStorage !== 'undefined') return sessionStorage.getItem(key);
  } catch { /* ignore */ }
  return null;
}

function trySetLS(key: string, value: string): void {
  try {
    const target = getKeyStorage();
    if (target) target.setItem(key, value);
  } catch { /* ignore */ }
}

function seedInitial(): ProviderRecord[] {
  // Try to read legacy key from localStorage (works in browser and in test mocks on globalThis)
  const legacyKey = (tryGetLS('cryptex.openrouterApiKey') || '').trim();
  return [{ id: 'openrouter', apiKey: legacyKey, enabled: true }];
}

function loadPersisted(): ProviderRecord[] | null {
  const raw = tryGetLS(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as ProviderRecord[]; } catch { return null; }
}

// Module-level state — rune-backed so Svelte components re-render on change
let _records = $state<ProviderRecord[]>(loadPersisted() ?? seedInitial());

function persist(): void {
  trySetLS(STORAGE_KEY, JSON.stringify(_records));
}

// Public functions are synchronous and work in both SSR and browser environments.
// Svelte components can read _records directly via listProviders(); $state ensures
// reactive re-renders whenever a mutating function replaces the array.

export function listProviders(): ProviderRecord[] {
  return _records;
}

export function getProvider(id: ProviderId, instanceId?: string): ProviderRecord | undefined {
  return _records.find((p) => {
    if (p.id !== id) return false;
    if (id === 'openai-compat' && instanceId) return (p as { instanceId: string }).instanceId === instanceId;
    return true;
  });
}

// Lazy import to avoid circular dependency: catalog.svelte.ts imports listProviders from here.
async function triggerCatalogRefresh(): Promise<void> {
  try {
    const { refreshCatalog } = await import('./catalog.svelte');
    refreshCatalog(true).catch((err) => console.warn('[providers] catalog refresh failed:', err));
  } catch (err) {
    console.warn('[providers] could not load catalog module:', err);
  }
}

export function addProvider(record: ProviderRecord): void {
  _records = [..._records, record];
  persist();
  triggerCatalogRefresh();
}

export function updateProvider(
  id: ProviderId,
  patch: Partial<ProviderRecord>,
  instanceId?: string
): void {
  _records = _records.map((p) => {
    if (p.id !== id) return p;
    if (id === 'openai-compat' && instanceId && (p as { instanceId: string }).instanceId !== instanceId) return p;
    return { ...p, ...patch } as ProviderRecord;
  });
  persist();
  triggerCatalogRefresh();
}

export function removeProvider(id: ProviderId, instanceId?: string): void {
  _records = _records.filter((p) => {
    if (p.id !== id) return true;
    if (id === 'openai-compat' && instanceId) return (p as { instanceId: string }).instanceId !== instanceId;
    return false;
  });
  persist();
  triggerCatalogRefresh();
}

/**
 * True when at least one enabled provider is fully configured and ready to
 * accept calls. This is the gate the AI-backed tools use to decide whether
 * to enable their run buttons.
 *
 * "Configured" means one of:
 *   - a keyed provider (OpenRouter / Anthropic / cloud openai-compat) with
 *     a non-empty apiKey, OR
 *   - a key-less local openai-compat provider (Ollama, LM Studio, vLLM,
 *     Llama.cpp) with a non-empty baseURL.
 *
 * The previous `hasAnyKey()` semantics gated runs on apiKey alone, which
 * incorrectly excluded local providers that have no auth. Tools using only
 * a local server saw "no provider configured" banners and disabled buttons.
 */
export function hasAnyConfiguredProvider(): boolean {
  return _records.some((p) => {
    if (!p.enabled) return false;
    if (p.id === 'openai-compat') {
      const rec = p as Extract<ProviderRecord, { id: 'openai-compat' }>;
      if (!presetRequiresKey(rec.presetId)) {
        return Boolean(rec.baseURL);
      }
      return Boolean(rec.apiKey && rec.baseURL);
    }
    return 'apiKey' in p && Boolean(p.apiKey);
  });
}

/**
 * @deprecated Use `hasAnyConfiguredProvider`. Kept as an alias so existing
 * call-sites (tool pages, NoProviderBanner, gateway re-export) inherit the
 * broader semantics without churn.
 */
export const hasAnyKey = hasAnyConfiguredProvider;

// Provider records are backed by $state (see _records above); Svelte components
// re-render automatically when any mutating function (addProvider, updateProvider,
// removeProvider) assigns a new array to _records.
