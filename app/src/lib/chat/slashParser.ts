export function parseSlash(text: string): { techniqueId: string; input: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) return { techniqueId: trimmed.slice(1), input: '' };
  return {
    techniqueId: trimmed.slice(1, firstSpace),
    input: trimmed.slice(firstSpace + 1).trim()
  };
}
