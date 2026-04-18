/**
 * Shared blob download helper.
 * revokeObjectURL is deferred 100 ms to avoid Firefox/Safari timing issues
 * where synchronous revocation can cancel the download before it starts.
 */
export function downloadBlob(filename: string, content: string, mime = 'application/jsonl'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
