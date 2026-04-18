# Using custom OpenAI-compatible endpoints

Cryptex ships with presets for Groq, Together, Fireworks, DeepInfra, Cerebras,
and SambaNova. You can add any other OpenAI-compatible endpoint via
**Settings → Add provider → Custom endpoint**.

## Requirements

1. **CORS must be enabled** on the endpoint for your Cryptex origin. If you
   self-host vLLM, run it with `--allowed-origins '*'` (or your specific
   origin). If you self-host Ollama behind a proxy, the proxy must set
   `Access-Control-Allow-Origin`. Without CORS, Cryptex shows a `cors` error
   banner on the first call.

2. **`/chat/completions` compatibility** — the endpoint must accept the
   OpenAI Chat Completions request shape.

3. **(Optional) `/models` endpoint** — if the endpoint supports `GET /models`,
   Cryptex auto-populates the model picker. If not, use the model picker's
   free-text fallback (search for any string, press Enter) to specify the
   model id manually.

## Content Security Policy

If you self-host Cryptex behind a CSP, add your custom endpoint's host to
`connect-src`. Example for a local vLLM on `https://llm.internal`:

```
connect-src 'self' https://openrouter.ai https://api.anthropic.com \
  https://api.groq.com https://api.together.xyz https://api.fireworks.ai \
  https://api.deepinfra.com https://api.cerebras.ai https://api.sambanova.ai \
  https://llm.internal;
```

The gateway's CORS error banner includes a "Learn why" link that points here.

## Why no direct OpenAI / Google Gemini

`api.openai.com` and `generativelanguage.googleapis.com` don't return
`Access-Control-Allow-Origin` to browser requests as of April 2026. There is
no browser-only workaround. For GPT-5 / o-series / Gemini models, use
OpenRouter — it accepts your BYOK for those providers and proxies
transparently.
