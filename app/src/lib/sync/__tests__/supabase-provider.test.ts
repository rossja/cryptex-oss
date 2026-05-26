/**
 * Supabase sync provider unit tests · v2.2 Wave 10.1
 *
 * Pure-function tests for the config validator + row converters. The
 * network-side surface (validate / syncRun / etc.) is mocked here; an
 * integration test against a real Supabase project lives in docs/SUPABASE.md
 * as a manual smoke step.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSupabaseProvider,
  isLikelyValidConfig
} from '$lib/sync/supabase-provider';

describe('isLikelyValidConfig', () => {
  test('rejects when URL or anon key is missing', () => {
    expect(isLikelyValidConfig({})).toBe(false);
    expect(isLikelyValidConfig({ supabaseUrl: 'https://x.supabase.co' })).toBe(false);
    expect(isLikelyValidConfig({ supabaseAnonKey: 'eyJ.x.y' })).toBe(false);
  });

  test('rejects non-http(s) URLs', () => {
    expect(
      isLikelyValidConfig({
        supabaseUrl: 'ftp://x.supabase.co',
        supabaseAnonKey: 'eyJaaa.bbb.ccc'
      })
    ).toBe(false);
  });

  test('rejects malformed JWT-shaped key', () => {
    expect(
      isLikelyValidConfig({
        supabaseUrl: 'https://x.supabase.co',
        supabaseAnonKey: 'not-a-jwt'
      })
    ).toBe(false);
  });

  test('accepts well-shaped URL + JWT-shaped key', () => {
    expect(
      isLikelyValidConfig({
        supabaseUrl: 'https://abcdefgh.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abcdef'
      })
    ).toBe(true);
  });
});

describe('createSupabaseProvider', () => {
  const validConfig = {
    enabled: true,
    provider: 'supabase' as const,
    supabaseUrl: 'https://abcdefgh.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abcdef'
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('')
      } as Response)
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('throws synchronously when URL or key is missing', () => {
    expect(() => createSupabaseProvider({ enabled: true, provider: 'supabase' })).toThrow(
      /Supabase URL and anon key are required/
    );
  });

  test('syncRun POSTs the row with upsert headers', async () => {
    const p = createSupabaseProvider(validConfig);
    await p.syncRun({
      id: 'r_abc',
      schemaVersion: 1,
      toolId: 'transforms',
      startedAt: 1000,
      finishedAt: 2000,
      durationMs: 1000,
      status: 'done',
      inputSummary: 'hi',
      outputSummary: 'aGk=',
      params: { transform: 'base64' },
      sizeBytes: 4
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abcdefgh.supabase.co/rest/v1/synced_runs');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      apikey: validConfig.supabaseAnonKey,
      Prefer: expect.stringContaining('resolution=merge-duplicates')
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      id: 'r_abc',
      tool_id: 'transforms',
      status: 'done'
    });
  });

  test('deleteRun issues DELETE with id filter', async () => {
    const p = createSupabaseProvider(validConfig);
    await p.deleteRun('r_xyz');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abcdefgh.supabase.co/rest/v1/synced_runs?id=eq.r_xyz');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  test('deleteVaultItem scopes the delete by tool_id', async () => {
    const p = createSupabaseProvider(validConfig);
    await p.deleteVaultItem('jbb', 'v_qqq');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abcdefgh.supabase.co/rest/v1/synced_vault_items?id=eq.v_qqq&tool_id=eq.jbb');
  });

  test('initialSync skips bundled items, only pushes user-source', async () => {
    const p = createSupabaseProvider(validConfig);
    const result = await p.initialSync({
      runs: [],
      vaultByTool: {
        jbb: [
          {
            id: 'v_b1',
            schemaVersion: 1,
            title: 'bundled',
            payload: {},
            tags: [],
            source: 'bundled',
            addedAt: 1
          },
          {
            id: 'v_u1',
            schemaVersion: 1,
            title: 'user',
            payload: {},
            tags: [],
            source: 'user',
            addedAt: 2
          }
        ]
      }
    });
    expect(result.runsPushed).toBe(0);
    expect(result.vaultPushed).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('v_u1');
  });

  test('validate returns ok on 200 response', async () => {
    const p = createSupabaseProvider(validConfig);
    const r = await p.validate();
    expect(r).toEqual({ ok: true });
  });

  test('validate surfaces 401 with key-rejected message', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('JWT expired')
    } as Response);
    const p = createSupabaseProvider(validConfig);
    const r = await p.validate();
    expect(r).toEqual({ ok: false, error: expect.stringContaining('Anon key rejected') });
  });

  test('validate surfaces table-missing as a setup hint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('relation "synced_runs" does not exist')
    } as Response);
    const p = createSupabaseProvider(validConfig);
    const r = await p.validate();
    expect(r).toEqual({ ok: false, error: expect.stringContaining('docs/SUPABASE.md') });
  });
});
