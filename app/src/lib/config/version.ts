/**
 * App version + repo metadata.
 *
 * Version is injected at build time via `define:` in app/vite.config.ts
 * reading from the ROOT package.json. The version-display footer chip,
 * About page line, and update-check fetch all consume these constants.
 */

export const APP_VERSION: string = __APP_VERSION__;
export const APP_REPO: string = __APP_REPO__;

/** Full URL to the Releases page. */
export const APP_RELEASES_URL = `https://github.com/${APP_REPO}/releases`;

/** Full URL to the CHANGELOG. */
export const APP_CHANGELOG_URL = `https://github.com/${APP_REPO}/blob/main/CHANGELOG.md`;

/** GitHub Releases API endpoint for the "latest" release. */
export const APP_RELEASES_API_LATEST = `https://api.github.com/repos/${APP_REPO}/releases/latest`;

/** Public-facing release URL for a specific tag (e.g. APP_RELEASE_URL_FOR('v2.5.0')). */
export function APP_RELEASE_URL_FOR(tag: string): string {
  const t = tag.startsWith('v') ? tag : `v${tag}`;
  return `${APP_RELEASES_URL}/tag/${t}`;
}
