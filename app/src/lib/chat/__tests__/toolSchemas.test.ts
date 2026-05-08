import { describe, it, expect } from 'vitest';
import { buildToolSchemas } from '../toolSchemas';
import { find } from '$lib/techniques/registry';

describe('buildToolSchemas', () => {
  it('returns OpenAI-style function defs for each enabled technique id', () => {
    const tech = find('rephrase');
    if (!tech) throw new Error('rephrase mutator missing');
    const schemas = buildToolSchemas([tech.id]);
    expect(schemas.rephrase).toBeDefined();
    expect(schemas.rephrase.description).toBeTruthy();
    expect(schemas.rephrase.inputSchema).toBeDefined();
  });

  it('silently skips ids that do not resolve', () => {
    const schemas = buildToolSchemas(['rephrase', 'nonexistent']);
    expect(Object.keys(schemas)).toEqual(['rephrase']);
  });
});
