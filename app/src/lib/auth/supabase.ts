import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { featureFlags } from '$lib/config/featureFlags';

/** Diagnostic snapshot of what the build saw for the Supabase env vars.
 *  Read by the /login + /signup pages so the browser can show a precise
 *  banner ("KEY missing", "URL malformed", etc.) without forcing the user
 *  to open DevTools. The boolean values are NOT secrets — they only say
 *  whether the var was present and well-formed at build time. */
export type SupabaseConfigStatus =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'auth-flag-off'
        | 'url-missing'
        | 'key-missing'
        | 'url-malformed'
        | 'key-malformed';
      detail: string;
    };

function inspect(): SupabaseConfigStatus {
  if (!featureFlags.authEnabled) {
    return {
      ok: false,
      reason: 'auth-flag-off',
      detail: 'VITE_AUTH_ENABLED is not "true" in this build.'
    };
  }
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || url === 'undefined') {
    return {
      ok: false,
      reason: 'url-missing',
      detail: 'PUBLIC_SUPABASE_URL was not present at build time.'
    };
  }
  if (!key || key === 'undefined') {
    return {
      ok: false,
      reason: 'key-missing',
      detail: 'PUBLIC_SUPABASE_ANON_KEY was not present at build time.'
    };
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/i.test(url)) {
    return {
      ok: false,
      reason: 'url-malformed',
      detail: `PUBLIC_SUPABASE_URL does not look like a Supabase project URL (got: "${url.slice(0, 60)}…"). It should look like https://abcdefgh.supabase.co.`
    };
  }
  // Anon keys are JWTs (3 dot-separated base64 segments). Very loose check —
  // just enough to catch "pasted the project URL into the key field" mistakes.
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    return {
      ok: false,
      reason: 'key-malformed',
      detail: 'PUBLIC_SUPABASE_ANON_KEY does not look like a Supabase anon JWT (should start with "eyJ" and contain two dots). Make sure you copied the "anon public" key, not the project URL or the service_role key.'
    };
  }
  return { ok: true };
}

export const supabaseConfigStatus: SupabaseConfigStatus = inspect();

/** Null when VITE_AUTH_ENABLED is off OR when the URL/KEY pair is missing
 *  / malformed. Callers MUST null-check before use; the /login + /signup
 *  pages additionally surface `supabaseConfigStatus` so the browser can
 *  explain exactly what went wrong without forcing DevTools. */
export const supabase: SupabaseClient | null = (() => {
  if (!supabaseConfigStatus.ok) {
    if (supabaseConfigStatus.reason !== 'auth-flag-off') {
      console.error(`[auth] ${supabaseConfigStatus.detail}`);
    }
    return null;
  }
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /*
       * Why implicit flow (and not the more modern PKCE):
       *
       * We previously ran flowType: 'pkce'. PKCE requires a second
       * round-trip from /auth/callback to Supabase's
       * /auth/v1/token?grant_type=pkce endpoint to exchange the
       * server-issued ?code=… for a session. On at least one Supabase
       * project (gotrue version mismatch / pause-resume side-effect /
       * undocumented), that endpoint returns 404 — which manifests as
       * "GitHub OAuth fails" right at the very last step of the dance,
       * AFTER the user has already approved on GitHub.
       *
       * Implicit flow sidesteps the second round-trip entirely.
       * Supabase redirects the OAuth completion straight back to our
       * redirect_to with `#access_token=…&refresh_token=…&expires_in=…`
       * in the URL fragment. The SDK parses it and sets the session —
       * no /token call, no PKCE endpoint to 404 on.
       *
       * Email-based flows (signup confirmation, password reset, email
       * change) all use verifyOtp() with an explicit (email, token,
       * type) tuple — they don't rely on URL state, so flowType doesn't
       * affect them.
       *
       * Trade-off: implicit puts tokens in the URL fragment, which means
       * they show up briefly in `window.location.href` and could be
       * captured by extensions or the browser's history if the page
       * doesn't immediately strip them. Our /auth/callback page calls
       * goto() to /chat as soon as the session lands, replacing the URL
       * — so the window of exposure is sub-second.
       */
      flowType: 'implicit',
      /*
       * detectSessionInUrl=true is required for implicit flow. The SDK
       * inspects window.location on init, finds #access_token=…,
       * decodes it, and sets the session automatically. Our
       * /auth/callback page just waits for the resulting session to
       * appear via getSession() — no manual exchange step.
       */
      detectSessionInUrl: true
    }
  });
})();
