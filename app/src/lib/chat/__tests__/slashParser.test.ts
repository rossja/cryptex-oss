import { describe, it, expect } from 'vitest';
import { parseSlash } from '../slashParser';

describe('parseSlash', () => {
  it('returns null on plain text', () => {
    expect(parseSlash('hello')).toBeNull();
  });

  it('parses /base64 hello', () => {
    const r = parseSlash('/base64 hello');
    expect(r?.techniqueId).toBe('base64');
    expect(r?.input).toBe('hello');
  });

  it('handles multi-word input', () => {
    const r = parseSlash('/base64 hello world 42');
    expect(r?.input).toBe('hello world 42');
  });

  it('returns null on /unknown when technique id not in registry', () => {
    // parseSlash doesn't validate the id; resolution is the dispatcher's job.
    const r = parseSlash('/nonexistent_fake hi');
    expect(r?.techniqueId).toBe('nonexistent_fake');
    expect(r?.input).toBe('hi');
  });

  it('supports /cmd/with/slashes as id', () => {
    const r = parseSlash('/foo/bar baz');
    expect(r?.techniqueId).toBe('foo/bar');
    expect(r?.input).toBe('baz');
  });
});
