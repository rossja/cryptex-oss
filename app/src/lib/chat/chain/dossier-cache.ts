/**
 * localStorage-backed cache for runDossierPhase results. Keyed by FNV-1a hash
 * of (lowercase + trimmed) objective. Entry value carries the original
 * normalized objective so on read we can verify exact match (defeats hash
 * collisions — 32-bit FNV has ~1/65K collision rate).
 *
 * TTL 7 days. On parse error or quota exceeded, silently no-op so the
 * caller falls back to a fresh judge call.
 */

export interface CachedDossier {
  /** Exact normalized objective for collision verification on read. */
  objective: string;
  dossier: string;
  citations: string[];
  cachedAt: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'cryptex.dossier.';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function hashObjective(normalized: string): string {
  // FNV-1a 32-bit, base36 encoded. Used only as a lookup key — exact-match
  // verification on the entry's `objective` field defeats collisions.
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function getCachedDossier(objective: string): { dossier: string; citations: string[] } | null {
  if (typeof localStorage === 'undefined') return null;
  const norm = normalize(objective);
  const key = KEY_PREFIX + hashObjective(norm);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  let parsed: CachedDossier;
  try {
    parsed = JSON.parse(raw) as CachedDossier;
  } catch {
    return null;
  }
  if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
    try { localStorage.removeItem(key); } catch { /* best effort */ }
    return null;
  }
  if (parsed.objective !== norm) return null;
  return { dossier: parsed.dossier, citations: parsed.citations };
}

export function setCachedDossier(objective: string, dossier: string, citations: string[]): void {
  if (typeof localStorage === 'undefined') return;
  const norm = normalize(objective);
  const key = KEY_PREFIX + hashObjective(norm);
  const value: CachedDossier = {
    objective: norm,
    dossier,
    citations,
    cachedAt: Date.now()
  };
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or other storage failure — silently skip.
  }
}
