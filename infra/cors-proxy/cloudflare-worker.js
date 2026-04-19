// Cryptex CORS proxy — Cloudflare Worker
//
// Why this exists: browsers block cross-origin requests to provider APIs
// (Groq, direct OpenAI, Gemini, many OpenAI-compatible endpoints) that don't
// emit Access-Control-Allow-Origin headers. This worker forwards such
// requests to the upstream you configure, adds permissive CORS headers so
// the browser accepts the reply, and optionally gates traffic behind a
// shared secret so random visitors can't burn your API key.
//
// Deploy:
//   1. Copy this file as a new Cloudflare Worker (dashboard or `wrangler`).
//   2. Set the UPSTREAM env var to the provider base URL, e.g.
//        UPSTREAM = "https://api.groq.com/openai/v1"
//        UPSTREAM = "https://api.openai.com/v1"
//        UPSTREAM = "https://generativelanguage.googleapis.com"
//   3. (Recommended) Set a secret SHARED_SECRET. Clients must send it via
//      the X-Cryptex-Proxy-Secret header; requests without the secret are
//      rejected with 401.
//   4. Paste the worker URL (e.g. https://cryptex-proxy.<you>.workers.dev)
//      into Cryptex → Settings → Add provider → Custom openai-compat
//      as the Base URL. Provide your upstream API key; the worker passes
//      it through unchanged.
//
// Security notes:
//   - The worker never stores or logs your API key — it streams the
//     Authorization header straight to the upstream.
//   - Set SHARED_SECRET in production. Without it anyone who knows the
//     worker URL can proxy requests using their OWN key, which is harmless
//     for you, but still — set the secret.
//   - Cloudflare's free tier comfortably covers normal personal usage.

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS =
  'authorization, content-type, x-api-key, anthropic-version, ' +
  'anthropic-dangerous-direct-browser-access, openai-beta, ' +
  'x-cryptex-proxy-secret';

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': ALLOWED_METHODS,
    'access-control-allow-headers': ALLOWED_HEADERS,
    'access-control-max-age': '86400',
    'access-control-expose-headers': 'retry-after, x-request-id'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '*';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Secret check (only enforced if SHARED_SECRET is configured)
    if (env.SHARED_SECRET) {
      const provided = request.headers.get('x-cryptex-proxy-secret');
      if (provided !== env.SHARED_SECRET) {
        return new Response('Proxy secret mismatch', {
          status: 401,
          headers: corsHeaders(origin)
        });
      }
    }

    if (!env.UPSTREAM) {
      return new Response('Proxy is missing UPSTREAM configuration', {
        status: 500,
        headers: corsHeaders(origin)
      });
    }

    const url = new URL(request.url);
    const upstream = new URL(env.UPSTREAM);
    // Preserve path + query relative to the upstream host
    upstream.pathname =
      (upstream.pathname.replace(/\/$/, '')) +
      (url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`);
    upstream.search = url.search;

    // Copy headers, strip ones the upstream shouldn't see or set
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete('host');
    forwardHeaders.delete('x-cryptex-proxy-secret');
    forwardHeaders.delete('cf-connecting-ip');
    forwardHeaders.delete('cf-ray');
    forwardHeaders.delete('cf-visitor');

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(upstream.toString(), {
        method: request.method,
        headers: forwardHeaders,
        body:
          request.method === 'GET' || request.method === 'HEAD'
            ? undefined
            : request.body,
        redirect: 'follow'
      });
    } catch (err) {
      return new Response(
        `Upstream fetch failed: ${(err && err.message) || err}`,
        { status: 502, headers: corsHeaders(origin) }
      );
    }

    // Stream the upstream response back with our CORS headers added.
    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      responseHeaders.set(k, v);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  }
};
