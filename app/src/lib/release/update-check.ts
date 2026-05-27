/**
 * Update-available check for self-hosted Cryptex deployments.
 *
 * Once per session (6h cache TTL), fetch the latest GitHub release for the
 * configured repo, compare against the running APP_VERSION, and report
 * whether a newer version is available.
 *
 * Design rules:
 *   - Silent on every failure path (network, 4xx, CORS, malformed JSON,
 *     rate limit). Returns `null` so the caller can no-op.
 *   - Cache result in sessionStorage so a page refresh during the same
 *     browser session doesn't re-fetch.
 *   - Cache key is repo-aware so a forked deployment talking to a
 *     different repo doesn't see stale data from this repo.
 *   - The CSP at nginx.conf:73 already permits `connect-src https:`,
 *     so api.github.com is reachable without a CSP change.
 */

import { APP_VERSION, APP_REPO, APP_RELEASES_API_LATEST, APP_RELEASE_URL_FOR } from '$lib/config/version';

export interface UpdateInfo {
  current: string;
  latest: string;
  url: string;
  hasUpdate: boolean;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_KEY = `cryptex.updateCheck.${APP_REPO}`;

interface CacheEntry {
  fetchedAt: number;
  info: UpdateInfo;
}

/**
 * Parse a semver-ish string into a [major, minor, patch] tuple. Tolerates
 * a leading "v" and ignores any pre-release / build-metadata suffix.
 * Non-numeric segments fall back to 0 so an unparseable string sorts low.
 */
function parseSemver(raw: string): [number, number, number] {
  const stripped = raw.trim().replace(/^v/i, '').split(/[-+]/)[0];
  const parts = stripped.split('.').map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Returns 1 if a > b, -1 if a < b, 0 if equal. Compares major / minor /
 * patch numerically. Pre-release identifiers are intentionally ignored;
 * any v2.6.0 release supersedes v2.6.0-rc1 for our update-check purposes
 * (we treat a published GitHub release as authoritative regardless of
 * suffix).
 */
export function compareSemver(a: string, b: string): number {
  const [aMa, aMi, aPa] = parseSemver(a);
  const [bMa, bMi, bPa] = parseSemver(b);
  if (aMa !== bMa) return aMa > bMa ? 1 : -1;
  if (aMi !== bMi) return aMi > bMi ? 1 : -1;
  if (aPa !== bPa) return aPa > bPa ? 1 : -1;
  return 0;
}

function readCache(): UpdateInfo | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry || typeof entry.fetchedAt !== 'number') return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.info;
  } catch {
    return null;
  }
}

function writeCache(info: UpdateInfo): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), info };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled. Silently swallow; the next
    // session will just re-fetch.
  }
}

/**
 * One-shot update check. Returns the comparison result or `null` if the
 * fetch failed for any reason. Idempotent for the session (cached for 6h).
 */
export async function checkForUpdate(opts: { signal?: AbortSignal } = {}): Promise<UpdateInfo | null> {
  const cached = readCache();
  if (cached) return cached;

  try {
    const res = await fetch(APP_RELEASES_API_LATEST, {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json' },
      signal: opts.signal
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { tag_name?: unknown; html_url?: unknown };
    if (typeof json.tag_name !== 'string') return null;

    const latest = json.tag_name.replace(/^v/i, '');
    const cmp = compareSemver(latest, APP_VERSION);
    const info: UpdateInfo = {
      current: APP_VERSION,
      latest,
      url: typeof json.html_url === 'string' ? json.html_url : APP_RELEASE_URL_FOR(latest),
      hasUpdate: cmp > 0
    };
    writeCache(info);
    return info;
  } catch {
    return null;
  }
}

/** Clear cache (test hook + Settings "Re-check" button). */
export function clearUpdateCheckCache(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
