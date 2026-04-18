// Dataset Inspector is a dynamic, client-only page — it cannot be prerendered
// because it reads from Dexie (IndexedDB) which only exists in the browser.
export const prerender = false;
export const ssr = false;
