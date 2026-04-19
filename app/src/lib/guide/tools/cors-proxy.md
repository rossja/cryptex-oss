---
title: CORS proxy
description: Reach Groq, direct OpenAI, Gemini, and other CORS-restricted providers via a 5-minute self-deployed proxy.
category: tools
order: 10
---

# CORS proxy

## Why direct Groq / OpenAI / Gemini calls fail

Cryptex is a static site. When your browser makes a request to a provider
API, that provider's server decides whether cross-origin browsers are
allowed by returning the `Access-Control-Allow-Origin` HTTP header.

**Providers that return it → work direct from Cryptex:**

- OpenRouter
- Anthropic (via the `anthropic-dangerous-direct-browser-access` header)
- Some OpenAI-compatible endpoints (Together, Fireworks, DeepInfra
  typically do; others vary)

**Providers that don't return it → blocked by your browser:**

- Groq (`api.groq.com`)
- Direct OpenAI (`api.openai.com`)
- Google Gemini (`generativelanguage.googleapis.com`)
- Cerebras, SambaNova — often no CORS either
- Many enterprise endpoints

When the browser blocks the call you see **"Can't reach X from the
browser."** The server is reachable; your browser refuses to send the
request because the server hasn't promised to accept cross-origin
callers.

Cryptex can't change another server's response headers. But you can run
a 80-line proxy that adds them. Your API key never leaves your browser
except to reach the provider — the proxy just forwards.

## Option A — route through OpenRouter (zero setup)

If the model you want is available on OpenRouter, this is easiest. Add
OpenRouter in Settings, pick the same model (Groq models are available
as `groq/...` on OpenRouter), and you're done. OpenRouter handles CORS
for you.

## Option B — deploy your own CORS proxy (5 minutes)

### Step 1 — deploy the Cloudflare Worker

The worker is one file: `infra/cors-proxy/cloudflare-worker.js` in the
Cryptex repo. It's ~80 lines.

1. Sign in at [Cloudflare dashboard](https://dash.cloudflare.com) (free
   tier is fine).
2. Workers & Pages → Create → Create Worker.
3. Paste the contents of `cloudflare-worker.js` into the editor.
4. Click **Save and Deploy**.
5. Settings → Variables — add:
   - `UPSTREAM` = the provider URL you want to reach, e.g.
     `https://api.groq.com/openai/v1`
   - `SHARED_SECRET` (optional, recommended) = any long random string
6. Copy the worker URL — e.g. `https://cryptex-groq.<you>.workers.dev`.

### Step 2 — add it as a Cryptex provider

1. Cryptex → Settings → **Add provider** → pick **Custom
   (openai-compat)**.
2. Name: `Groq (via proxy)` or whatever is memorable.
3. Base URL: your worker URL.
4. API key: your Groq API key (the proxy passes it through).
5. Save.

That's it. Groq models now appear in the model picker under your
proxy'd provider.

### Step 3 — one worker per provider

Each provider gets its own worker. Deploy again with a different
`UPSTREAM` for OpenAI, Gemini, etc. Each worker gets its own URL and
lands in Cryptex as its own openai-compat provider.

## Is this safe?

- The worker never stores or logs anything. Audit the 80 lines before
  deploying.
- Cloudflare's free tier covers 100k requests/day — plenty for
  personal use.
- Set `SHARED_SECRET` so random visitors who somehow learn your worker
  URL can't pin requests to your rate limit.
- For the paranoid: run the worker on your own domain + WAF rule
  limiting origins to your Cryptex domain.

## What the proxy does (in 3 lines)

```js
// Core of the worker — deliberately boring
const upstream = env.UPSTREAM + new URL(request.url).pathname;
const response = await fetch(upstream, { method, headers, body });
return response with Access-Control-Allow-Origin: *;
```

No AI, no logging, no middleware. Headers in → headers out with CORS
appended → that's it.
