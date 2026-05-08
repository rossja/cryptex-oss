/**
 * Per-tool form-state persistence for redteam workbenches.
 *
 * Namespaces under `cryptex.tool.<toolId>.<field>` so each tool's form state
 * is naturally isolated. Used by routes under `app/src/routes/redteam/` so
 * switching tabs doesn't wipe in-flight form input.
 *
 * Manual getter/setter pattern (mirrors chatMode.svelte.ts) — synchronous
 * localStorage writes on assignment, so tests can assert on the storage key
 * without waiting for an effect flush.
 */
import { browser } from '$app/environment';

export function useToolState<T>(toolId: string, field: string, initial: T) {
  const key = 'cryptex.tool.' + toolId + '.' + field;

  function read(): T {
    if (!browser) return initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* corrupt entry — fall back to initial */
    }
    return initial;
  }

  function persist(next: T): void {
    if (!browser) return;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* quota / disabled — silently drop */
    }
  }

  let _value = $state<T>(read());

  return {
    get value(): T {
      return _value;
    },
    set value(next: T) {
      _value = next;
      persist(next);
    }
  };
}
