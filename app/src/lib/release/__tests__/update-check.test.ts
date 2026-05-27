/**
 * Update-check unit tests.
 *
 * Covers the semver-compare helper, sessionStorage cache hit/miss, and
 * the silent-failure contract for the network paths.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { compareSemver, checkForUpdate, clearUpdateCheckCache } from '../update-check';

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('compareSemver', () => {
  test('detects newer patch', () => {
    expect(compareSemver('2.4.2', '2.4.1')).toBe(1);
    expect(compareSemver('2.4.1', '2.4.2')).toBe(-1);
  });

  test('detects newer minor + patch reset', () => {
    expect(compareSemver('2.5.0', '2.4.9')).toBe(1);
  });

  test('detects newer major', () => {
    expect(compareSemver('3.0.0', '2.99.99')).toBe(1);
  });

  test('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  test('strips leading v', () => {
    expect(compareSemver('v2.5.0', '2.5.0')).toBe(0);
    expect(compareSemver('V2.5.0', 'v2.5.0')).toBe(0);
  });

  test('ignores pre-release suffix (treats as base version for our needs)', () => {
    expect(compareSemver('2.5.0-rc1', '2.5.0')).toBe(0);
    expect(compareSemver('2.5.0+build.42', '2.5.0')).toBe(0);
  });

  test('non-numeric segments fall back to 0', () => {
    expect(compareSemver('garbage', '0.0.0')).toBe(0);
    expect(compareSemver('1.x.y', '1.0.0')).toBe(0);
  });
});

describe('checkForUpdate', () => {
  test('cache miss issues one fetch and caches the result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v9.0.0',
        html_url: 'https://github.com/m4xx101/cryptex-oss/releases/tag/v9.0.0'
      })
    } as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const r1 = await checkForUpdate();
    expect(r1).not.toBeNull();
    expect(r1!.latest).toBe('9.0.0');
    expect(r1!.hasUpdate).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call within the same session reuses the cache.
    const r2 = await checkForUpdate();
    expect(r2).toEqual(r1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('non-OK response returns null silently', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response) as unknown as typeof fetch;
    expect(await checkForUpdate()).toBeNull();
  });

  test('thrown fetch returns null silently (no error propagates)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    expect(await checkForUpdate()).toBeNull();
  });

  test('malformed JSON (no tag_name) returns null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ /* missing tag_name */ })
    } as Response) as unknown as typeof fetch;
    expect(await checkForUpdate()).toBeNull();
  });

  test('clearUpdateCheckCache forces a refetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.0.1',
        html_url: 'https://github.com/m4xx101/cryptex-oss/releases/tag/v0.0.1'
      })
    } as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await checkForUpdate();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    clearUpdateCheckCache();
    await checkForUpdate();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('latest equals current returns hasUpdate=false', async () => {
    // The running APP_VERSION is whatever the build injected; we cannot
    // know it statically here without coupling. So we just assert the
    // hasUpdate flag matches compareSemver semantics by feeding a known
    // OLDER version into the mock and asserting hasUpdate === false.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.0.1',
        html_url: 'https://example.invalid/v0.0.1'
      })
    } as Response) as unknown as typeof fetch;

    const r = await checkForUpdate();
    expect(r).not.toBeNull();
    expect(r!.hasUpdate).toBe(false);
  });
});
