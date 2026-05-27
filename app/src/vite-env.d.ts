/// <reference types="svelte" />
/// <reference types="vite/client" />

/**
 * Build-time globals injected via `define:` in app/vite.config.ts.
 * Sourced from the ROOT package.json at build time.
 */
declare const __APP_VERSION__: string;
declare const __APP_REPO__: string;
