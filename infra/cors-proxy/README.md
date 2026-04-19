# Cryptex CORS Proxy

A single-file Cloudflare Worker that lets Cryptex reach provider APIs that
don't emit browser CORS headers (Groq, direct OpenAI, Google Gemini, and
several OpenAI-compatible endpoints).

## Why this exists

Cryptex is a static site. Browser requests to provider APIs that don't
return `Access-Control-Allow-Origin` are blocked by the browser before
they reach the server. That's why direct Groq/OpenAI/Gemini calls fail
with "Can't reach X from the browser."

This proxy forwards the request for you and adds the CORS headers the
browser needs. Your API key never leaves your browser except to reach
the same provider it was always going to reach — the proxy pipes it
through unchanged.

## Deploy (5 minutes)

### Cloudflare Worker (recommended, free tier fits personal use)

1. Go to https://dash.cloudflare.com → Workers & Pages → Create.
2. Paste the contents of `cloudflare-worker.js`.
3. Click **Save and Deploy**.
4. Under **Settings → Variables** set:
   - `UPSTREAM` = the provider base URL, e.g.
     - `https://api.groq.com/openai/v1`
     - `https://api.openai.com/v1`
     - `https://generativelanguage.googleapis.com`
   - `SHARED_SECRET` (optional but recommended) = any long random string.
5. Copy your worker URL (e.g. `https://cryptex-proxy.<you>.workers.dev`).

### Cryptex config

1. Open Cryptex → Settings → Add provider → **Custom (openai-compat)**.
2. Name it something recognizable, e.g. `Groq (via proxy)`.
3. Base URL = your worker URL.
4. API key = your upstream provider key (the worker passes it through).
5. If you set `SHARED_SECRET`, also add a header `X-Cryptex-Proxy-Secret`
   with the same value. (Cryptex will add a header field for this in a
   future update; for now, paste the secret as an extra header if your
   provider card exposes headers, or skip the secret and deploy to a
   private domain.)

## One worker per provider

If you use several CORS-restricted providers, deploy one worker per
`UPSTREAM`. Each gets its own URL and is added to Cryptex as its own
openai-compat provider.

## Deno Deploy alternative

Prefer Deno Deploy? Same logic works — start with `cloudflare-worker.js`
as reference; the fetch API is identical. The only Deno-specific change
is reading environment with `Deno.env.get(...)`.

## Local dev

```bash
# One-liner for testing — no deploy needed
wrangler dev cloudflare-worker.js --var UPSTREAM:https://api.groq.com/openai/v1
```

Point Cryptex at `http://localhost:8787`.

## Security

- The worker logs nothing. API keys flow straight through the
  Authorization header.
- Cloudflare's free tier covers normal personal usage (100k requests/day).
- For shared/embedded deployments, always set `SHARED_SECRET` so random
  visitors can't burn your rate limits.
- For maximum trust, audit the 80 lines of `cloudflare-worker.js` before
  deploying — that's the whole proxy.

## What if the upstream has extra auth (like Gemini `?key=...`)?

The proxy forwards query strings as-is. Your client passes the API key
however the upstream expects it. For Gemini, include `?key=<your-key>`
in the outgoing URL; for OpenAI-compat providers, use the standard
`Authorization: Bearer <key>` header.
