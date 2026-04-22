import { SHIBBOLETH_PATTERNS } from 'app-chat/attack-chain-refusal';

const MAX_MATCH_CHARS = 60;

/**
 * Return the shibboleth substrings detected in `text`, truncated to 60 chars each.
 * Canonical regex list lives in app/src/lib/chat/attack-chain-refusal.ts and is
 * imported via the app-chat/ Deno import alias.
 */
export function detectShibboleths(text: string): string[] {
  if (!text) return [];
  const matches: string[] = [];
  for (const pattern of SHIBBOLETH_PATTERNS) {
    // Use a fresh regex with global flag for multi-match; preserve original
    // case-insensitivity by copying the i flag.
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    for (const m of text.matchAll(global)) {
      matches.push(m[0].slice(0, MAX_MATCH_CHARS));
    }
  }
  return matches;
}

export { SHIBBOLETH_PATTERNS };
