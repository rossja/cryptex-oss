import { describe, it, expect } from 'vitest';
import { buildToolSchemas } from '../toolSchemas';
import { find } from '../techniques/registry';

describe('buildToolSchemas', () => {
  it('returns OpenAI-style function defs for each enabled technique id', () => {
    const base = find('base64');
    if (!base) throw new Error('base64 transformer missing');
    const schemas = buildToolSchemas([base.id]);
    expect(schemas.base64).toBeDefined();
    expect(schemas.base64.description).toContain('Base');
    expect(schemas.base64.inputSchema).toBeDefined();
  });

  it('silently skips ids that do not resolve', () => {
    const schemas = buildToolSchemas(['base64', 'nonexistent']);
    expect(Object.keys(schemas)).toEqual(['base64']);
  });
});
