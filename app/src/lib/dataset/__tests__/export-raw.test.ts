import { describe, it, expect } from 'vitest';
import { rawToJsonl, withManifest } from '../export-raw';
import type { MessageRow } from '$lib/chat/types';

function makeMsg(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    ownerId: 'user-1',
    chatId: 'chat-1',
    role: 'user',
    content: 'Hello',
    createdAt: 1000,
    tags: [],
    ...overrides
  };
}

describe('rawToJsonl', () => {
  it('produces one JSON line per row', () => {
    const rows = [makeMsg({ id: 'a' }), makeMsg({ id: 'b' })];
    const jsonl = rawToJsonl(rows);
    const lines = jsonl.split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe('a');
    expect(JSON.parse(lines[1]).id).toBe('b');
  });

  it('returns empty string for empty array', () => {
    expect(rawToJsonl([])).toBe('');
  });
});

describe('withManifest', () => {
  it('starts with the manifest comment line', () => {
    const rows = [makeMsg()];
    const output = withManifest(rows, {});
    const lines = output.split('\n');
    expect(lines[0]).toMatch(/^\/\/ cryptex-dataset-export v1 /);
  });

  it('includes correct rowCount in manifest', () => {
    const rows = [makeMsg({ id: 'x' }), makeMsg({ id: 'y' })];
    const output = withManifest(rows, {});
    const headerJson = output.split('\n')[0].replace('// cryptex-dataset-export v1 ', '');
    const manifest = JSON.parse(headerJson);
    expect(manifest.rowCount).toBe(2);
    expect(manifest.version).toBe(1);
  });

  it('body lines are parseable MessageRow objects', () => {
    const rows = [makeMsg({ id: 'z', content: 'test' })];
    const output = withManifest(rows, {});
    const lines = output.split('\n');
    // line 0 is manifest comment, line 1 is first row
    const parsed = JSON.parse(lines[1]);
    expect(parsed.id).toBe('z');
    expect(parsed.content).toBe('test');
  });

  it('returns just the header when rows is empty', () => {
    const output = withManifest([], {});
    expect(output.startsWith('// cryptex-dataset-export v1')).toBe(true);
    expect(output.split('\n')).toHaveLength(1);
  });
});
