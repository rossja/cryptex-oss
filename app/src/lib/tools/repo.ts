import { browser } from '$app/environment';

const STORAGE_KEY = 'cryptex.toolStates';

function readAll(): Record<string, unknown> {
  if (!browser) return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, unknown>): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — best-effort */ }
}

export const toolRepo = {
  async saveToolState(toolId: string, state: unknown): Promise<void> {
    const all = readAll();
    all[toolId] = state;
    writeAll(all);
  },
  async loadToolState<T = unknown>(toolId: string): Promise<T | null> {
    const all = readAll();
    return (all[toolId] as T) ?? null;
  },
  async deleteToolState(toolId: string): Promise<void> {
    const all = readAll();
    delete all[toolId];
    writeAll(all);
  }
};
