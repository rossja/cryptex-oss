# Deployment

Cryptex deploys via **Dokploy** from the `master` branch. Every push to `master` triggers a Docker build and container redeploy. There is no GitHub Actions deploy step for the Dokploy path — the Pages workflow in `.github/workflows/deploy.yml` is independent.

## Architecture

- **Build**: SvelteKit static adapter compiles `app/` → `app/build/`. The Dockerfile copies `app/build/` into an nginx:1.27-alpine container.
- **Serve**: nginx serves the static bundle on port 80. SPA fallback to `index.html` covers client-side routing.
- **No backend service** — every external call (Supabase, OpenRouter, Anthropic, OpenAI-compatible endpoints) goes browser-direct using the user's own API keys.
- **Routing/TLS**: Traefik labels in `docker-compose.yml` wire the container to Dokploy's external `dokploy-network`. Certs come from Let's Encrypt via the labels' `tls.certresolver=letsencrypt` directive.

## Build-time environment variables

SvelteKit inlines `PUBLIC_*` vars at build time. Set these in Dokploy's Environment tab (or the host's docker-compose env). When unset, every var defaults to a value that preserves the existing deploy.

| Var | Default | Purpose |
|---|---|---|
| `DOMAIN` | `cryptex.localhost` | Public hostname for Traefik routing + Let's Encrypt cert |
| `BASE_PATH` | empty | Subpath when serving under a non-root URL (e.g. `/cryptex`) |
| `PUBLIC_ADSENSE_CLIENT` | empty | Optional Google AdSense publisher id; unset = no ads |
| `PUBLIC_SUPABASE_URL` | empty | (D4) Supabase project URL — empty = auth stack falls back to local-only |
| `PUBLIC_SUPABASE_ANON_KEY` | empty | (D4) Supabase anon public key — empty = auth disabled |
| `PUBLIC_GODMODE_LOCAL_ENABLED` | `true` | Show the browser-only Godmode path (no auth required) |
| `TZ` | `UTC` | Container timezone |

## Files in the deploy contract

**Do not modify these without explicit deploy-contract review.** Each is part of the moving parts that make Dokploy auto-deploy succeed:

- `Dockerfile`
- `docker-compose.yml`
- `nginx.conf`
- `.dockerignore`
- `scripts/promote-dist.js`
- `package.json` `build` script
- `app/svelte.config.js` (adapter must remain `@sveltejs/adapter-static`)

Changes to any of the above must be tested against a local `docker build` before push. Use:

```bash
docker build -t cryptex:test .
docker run --rm -p 8080:80 cryptex:test
# visit http://localhost:8080
```

## Rollback

If a `master` push breaks the deploy, Dokploy keeps the previous container running until the new build succeeds. Recovery flow:

1. Identify the breaking commit: `git log --oneline -10`.
2. Revert it: `git revert <sha>`.
3. Push: `git push origin master`.
4. Dokploy picks up the revert and redeploys.

For a verification commit pattern (used by the master plan sub-projects D1-D5), look for `chore(<area>): D<n> verification pass` empty commits — these mark a complete, verified sub-project boundary.

## Troubleshooting

- **Cert won't issue**: Confirm DNS A record points at the VPS public IP BEFORE first deploy. Let's Encrypt's HTTP-01 challenge fails if DNS isn't already resolving.
- **404 on every route**: Traefik probably can't see the container. Check `docker network inspect dokploy-network` and confirm the cryptex container is attached.
- **Stale build**: Dokploy caches Docker layers. Force a clean build via Dokploy UI ("Clean Build" toggle) or by bumping the `BASE_PATH` ARG to invalidate the layer.
- **Supabase env not present in browser**: `PUBLIC_*` vars are inlined at build time, not runtime. Re-deploy after setting them.
