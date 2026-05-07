# Cryptex — Auth Hardening + UX polish handoff (2026-05-07)

Comprehensive snapshot of everything shipped in this session, written so a
post-compact agent can pick up where we left off without re-reading
the full transcript.

## TL;DR for the next agent

- **Production auth flow is now PKCE.** OAuth (Google + GitHub) returns
  to `/auth/callback?code=…` (single-use, useless without verifier).
  No more `#access_token` in URL. Email OTP flows untouched and intact.
- **Five email-template flows are documented** (`docs/SUPABASE-EMAIL-TEMPLATES.md`)
  with `{{ .SiteURL }}` everywhere and a `<img>` referencing
  `app/static/cryptex-mark.png` (real PNG, ships with the build).
- **Sign-out button is in the header** next to History / Guide / Settings.
- **Email masking + provider badge** in `Settings → Account`. Click eye
  to reveal, click copy to clipboard.
- **Client-side rate-limit** on password / OTP / re-auth (Phase 2.2).
- **Hard-locked deploy contract still respected**: `Dockerfile`,
  `docker-compose.yml`, `nginx.conf`, `app/vite.config.ts envPrefix`,
  `app/svelte.config.js` adapter, `.github/workflows/*.yml`. Any
  deeper hardening (HSTS, CSP nonces) needs explicit user OK.
- **Plan file** for ongoing security work:
  `C:\Users\m4xx\.claude\plans\jazzy-gathering-kernighan.md`.

## Commits since last handoff (chronological)

| SHA | What landed |
|---|---|
| `5f6ff25` | PKCE config + sanitized callback errors (PRE-bug-cycle) |
| `652a11a` | Switched to implicit flow as workaround for PKCE 404 (REVERTED LOGICALLY in 12590e5) |
| `b7074d2` | Brand-mark PNG + favicon + apple-touch-icon + og-image wired |
| `e6a15c9` | Removed dangling `apple-touch-icon.png` / `og-image.png` refs that broke prerender |
| `cfadbb1` | Email templates: `{{ .SiteURL }}` everywhere + per-feature copy + logo |
| `12590e5` | **Phase 1A + 2.1 + 2.2** — PKCE flip back, OAuth signup error generic, client-side rate-limit |
| (this commit) | OAuth-safe verifyCurrentPassword + email mask + sign-out button + this handoff |

## Where things live

### Auth pipeline

| File | Owns |
|---|---|
| `app/src/lib/auth/supabase.ts` | Client config (`flowType: 'pkce'` + `detectSessionInUrl: true`); env validation that surfaces friendly errors via `supabaseConfigStatus` |
| `app/src/lib/auth/session.svelte.ts` | The session API: `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle`, `signInWithGitHub`, `verifyEmailOtp`, `sendPasswordReset`, `requestEmailChange`, `updatePassword`, `verifyCurrentPassword`, `signOut`, `signOutAllDevices`, `resendSignupOtp`. Plus three NEW getters: `hasEmailIdentity` (true iff user has a password), `primaryProvider` (`'email' \| 'google' \| 'github' \| 'unknown'`), `supabaseSession`. Module-scope `_allow()` token bucket for password / OTP / reauth rate-limits. |
| `app/src/lib/auth/key-vault.ts` | BYOK API key storage — PBKDF2 600k + AES-GCM. Unchanged this session. |
| `app/src/lib/auth/migration.ts` | Atomic local→authenticated chat claim. Unchanged. |

### Auth UI

| File | Owns |
|---|---|
| `app/src/routes/login/+page.svelte` | Sign-in form (password only — magic-link UI removed), Forgot-password OTP flow, Google + GitHub buttons. Generic error handlers throughout. |
| `app/src/routes/signup/+page.svelte` | Sign-up form + post-submit OTP-entry screen. **OAuth catch handlers now use generic message** (Phase 2.1 fix). |
| `app/src/routes/auth/callback/+page.svelte` | Polls `getSession()` for up to 4s after the SDK auto-handles the URL on init. Flow-aware error UI (email-flow errors get OTP fallback, OAuth errors get "Try again, or use email + password"). |
| `app/src/lib/components/settings/SecurityPanel.svelte` | Settings → Account / Password / Email change / Sessions panels. **Now masks email**, **shows provider badge** (Google/GitHub/Email), reveal-on-click toggle, copy-email button. Uses `session.hasEmailIdentity` instead of duplicating the identities check. |
| `app/src/lib/components/shell/HeaderBar.svelte` | Top bar. **Sign-out button** rendered next to Settings (only when auth enabled + signed in). |

### OAuth-safe verifyCurrentPassword (the bug fixed this commit)

`session.verifyCurrentPassword(currentPassword)` previously assumed the
caller had already gated on `hasPassword`. If a caller forgot, an
OAuth-only user would see a confusing `signInWithPassword`
"Invalid credentials" error. Now:

```ts
const identities = _session?.user?.identities ?? [];
const hasEmailIdentity = identities.some((i) => i.provider === 'email');
if (!hasEmailIdentity) {
  throw new Error('No password to verify — this account uses OAuth.');
}
```

This is the safe-by-default contract for the API: regardless of which
caller invokes it, an OAuth-only account fails fast with a clear
message instead of going through `signInWithPassword`.

### Rate-limit primitive (Phase 2.2)

`app/src/lib/auth/session.svelte.ts` module-scope:

```ts
const _attempts = new Map<string, number[]>();
const _LIMITS = {
  password: { max: 5, windowMs: 60_000 }, // sign-in
  otp:      { max: 6, windowMs: 60_000 }, // verifyEmailOtp
  reauth:   { max: 5, windowMs: 60_000 }, // verifyCurrentPassword
};
function _allow(action, key) { … }
```

Per-email + per-action token bucket. Defends against in-tab brute-force
(XSS-injected loop, malicious extension, automated harness piggy-backing
on the open session) — server-side limits don't block these because
they fire faster than the network round-trip. For 6-digit OTP
(~1M codespace), 6/min raises brute-force horizon from ~28h to
~115 days per email.

## Email templates (Supabase dashboard)

Source: `docs/SUPABASE-EMAIL-TEMPLATES.md`. Five templates, each:

- Logo `<img src="{{ .SiteURL }}/cryptex-mark.png" width=56 height=56>` (real PNG ships in `app/static/`).
- Wordmark fallback below the image (CSS-rendered — always shows).
- 6-digit `{{ .Token }}` displayed prominently.
- Clickable `{{ .ConfirmationURL }}` button as fallback.
- Footer with `{{ .SiteURL }}` + Privacy + Terms links.
- Per-feature copy (Verification code / Sign-in code / Reset code / Invite code / Confirmation code).

After deploy, paste each block into Supabase → Authentication → Email
Templates. Site URL is set once in Authentication → URL Configuration;
all templates pick it up.

## Static assets that ship at the site root

`app/static/`:

- `favicon.svg` — primary brand mark for browser tabs (modern clients).
- `cryptex-mark.png` — same mark as PNG for emails / OAuth consent screens.
- `cryptex-mark.svg` — 96×96 vector for any modern context.
- `apple-touch-icon.png` — iOS home-screen icon (same source as cryptex-mark.png).
- `og-image.png` — Twitter/Facebook/Slack/Discord link previews.
- `google38b800bca0b4c7a9.html` — Google Search Console verification.
- `robots.txt`, `sitemap.xml` — standard.

## Deploy contract (HARD-LOCKED — do not touch without explicit user OK)

- `Dockerfile`
- `docker-compose.yml`
- `nginx.conf`
- `app/vite.config.ts` envPrefix
- `app/svelte.config.js` adapter
- `.github/workflows/*.yml`

Build args plumbed through Dockerfile + docker-compose:

- `BASE_PATH` (subpath, empty for root)
- `VITE_AUTH_ENABLED`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_GODMODE_LOCAL_ENABLED`
- `PUBLIC_ADSENSE_CLIENT` (optional)
- `PUBLIC_GA_ID` (optional)

`[cryptex-build]` masked diagnostic prints to Dokploy build log.

## Documentation guides

`docs/`:

- `DEPLOY-DOKPLOY-SUPABASE.md` — primary deploy guide
- `DEPLOY-OAUTH-AND-EMAIL.md` — Google + GitHub OAuth setup, Resend SMTP
- `DEPLOY-ANALYTICS-AND-ADSENSE.md` — GA4 + AdSense + Search Console verification
- `SUPABASE-EMAIL-TEMPLATES.md` — paste-ready 5-template HTML
- `2026-05-06-handoff-redteam-expansion.md` — older handoff (still relevant for redteam tools)
- `2026-05-07-handoff-auth-hardening.md` — **THIS FILE**

## Test plan after Dokploy rebuild

1. **OAuth (incognito)** — Click Continue with Google → consent → URL bar shows `?code=…` (NOT `#access_token=…`). Land on `/chat`. Repeat for GitHub.
2. **Settings → Account** — email is masked by default (e.g. `m••••••••@g••••l.com`); eye icon reveals; copy icon copies real email; provider badge shows Google/GitHub icon.
3. **Settings → Password** (OAuth user) — message says "You signed in via Google. You don't have a password — keep using OAuth, or set one below…". No "Current password" field. Submit "Set password" works.
4. **Settings → Email change** (OAuth user) — message says "Verifying ownership of the new email is the security check." No "Current password" field. Send code → enter OTP → email updates.
5. **Settings → Email change** (password user) — message says "Re-auth with your current password is required." Current password field shows. Both required.
6. **Header → Sign out** (signed in) — icon visible next to Settings. Click → toast "Signed out" → land on `/login`.
7. **Brute-force throttle** — try wrong password 6 times in 60s → 6th shows "Too many attempts". Different email works. Same for OTP (6/min).
8. **Burp / proxy** — load Cryptex through Burp on local. Trigger Google OAuth. Confirm only auth-relevant traffic is `POST /auth/v1/token?grant_type=pkce` over HTTPS. The intercepted `?code=…` is single-use; replay returns 400.

## Known deferred items (per plan)

- **Phase 2.3** HSTS in nginx (deploy-contract — needs approval)
- **Phase 3.1** Drop CSP `'unsafe-inline'` via inline-script SHA hash (biggest XSS hardening; needs `nginx.conf` + `app.html` change)
- **Phase 3.2** CSP `report-uri` to a new Edge Function for violation telemetry
- **Phase 3.3** Optional: API key sessionStorage opt-in (currently localStorage with PBKDF2 + AES-GCM encryption)
- **Phase 3.4** SRI on third-party scripts (gated)

## Threat model — current state

| Threat | Status |
|---|---|
| OAuth token in URL fragment | ✓ never (PKCE flow) |
| Token in Referer to next nav | ✓ no token in URL |
| Burp/proxy intercept of usable token | ✓ TLS-only single-use code |
| OAuth provider error leak (signup) | ✓ generic |
| OTP brute force from compromised tab | ✓ 6/min throttle |
| Login brute force from compromised tab | ✓ 5/min throttle |
| Re-auth bypass on OAuth-only accounts | ✓ verifyCurrentPassword fails-loud |
| Email exposure in screen-share | ✓ masked by default |
| IDOR (cross-user data) | ✓ ownerId enforced everywhere |
| XSS via chat/tool surface | ✓ no `@html`, all rendered as text/markdown |
| Privilege escalation | ✓ no admin/user role split exists |
| /btw context leak | ✓ filtered in both dispatch.ts history loops |
| HarmBench false positives | ✓ judge prompt now includes target prompt |

## Build assumptions

- Supabase URL: `https://zoqzyczfmunxmztcvjcy.supabase.co` (project alive; PKCE endpoint confirmed routable via curl probe)
- Production domain: `https://cryptex.m4xx.cfd`
- Auth enabled in build (`VITE_AUTH_ENABLED=true`)
- No real users yet (per CLAUDE.md as of 2026-05-06)
- Dexie chat DB schema unchanged

## What to NOT touch

- Dexie schema + ownerId enforcement (audit-confirmed strong)
- BYOK key-vault encryption layer (PBKDF2 600k + AES-GCM is solid)
- The 36 mutators / 26 redteam tools / slash routing (post-E5)
- Static-adapter SvelteKit configuration

## Quick-reference debugging

If OAuth fails again with `?code=` returning 404 on PKCE exchange:
1. Confirm `flowType: 'pkce'` AND `detectSessionInUrl: true` in `supabase.ts`
2. Probe endpoint: `curl -X POST "https://[ref].supabase.co/auth/v1/token?grant_type=pkce" -H "apikey: $KEY"` → expect 400 (route exists, rejects probe). 404 = route gone, project migration needed.
3. Verify localStorage key `sb-{ref}-auth-token-code-verifier` exists when /auth/callback runs (DevTools → Application → Local Storage). Missing = the OAuth tab and callback tab are different (cross-tab race).
4. The plan file at `C:\Users\m4xx\.claude\plans\jazzy-gathering-kernighan.md` documents Phase 1B (project migration) for the structurally-broken case.
