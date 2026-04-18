import type { MessageRow } from '$lib/chat/types';
import type { DatasetFilters } from './queries';

export interface RawManifest {
  exportedAt: string;
  version: 1;
  rowCount: number;
  filters: DatasetFilters;
}

export interface RawExportPayload {
  manifest: RawManifest;
  rows: MessageRow[];
}

/**
 * Convert MessageRow array to raw JSONL — one JSON object per line.
 */
export function rawToJsonl(rows: MessageRow[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n');
}

/**
 * Build a manifest header comment line + raw JSONL body.
 * Format:
 *   // cryptex-dataset-export v1 {...manifest JSON...}
 *   {"id":"...","chatId":"...",...}
 *   ...
 */
export function withManifest(rows: MessageRow[], filtersSummary: DatasetFilters = {}): string {
  const manifest: RawManifest = {
    exportedAt: new Date().toISOString(),
    version: 1,
    rowCount: rows.length,
    filters: filtersSummary
  };
  const header = `// cryptex-dataset-export v1 ${JSON.stringify(manifest)}`;
  const body = rawToJsonl(rows);
  return body.length > 0 ? `${header}\n${body}` : header;
}
