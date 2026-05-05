# Cryptex — static SvelteKit build served by nginx on port 80.
#
# Multi-stage:
#   1. node:20-alpine builder  → compiles app/ into app/build/ (static output)
#   2. nginx:1.27-alpine       → serves the static bundle with strict CSP +
#                                SPA routing + 7d/1y cache tiers.
#
# The Python CLI (cryptex_cli/) is NOT part of this image — run it locally with
# `uv`. The web image is the deploy target for Dokploy / Coolify / plain Docker.
#
# Build-time args (override in docker-compose / Dokploy "Build Variables"):
#   BASE_PATH              — subpath for the app (e.g. "/cryptex"). Empty for root.
#   PUBLIC_ADSENSE_CLIENT  — optional Google AdSense publisher id (ca-pub-XXXX…).
#                            Unset = no ads, no consent banner, no Google script.

# ---------- Stage 1: build the SvelteKit app ----------
FROM node:20-alpine AS builder
WORKDIR /build

# Build arguments (must be declared before first use)
ARG BASE_PATH=""
ARG PUBLIC_ADSENSE_CLIENT=""
# Supabase auth (D4). When unset, defaults are empty — the auth stack falls
# back to local-only mode (no breaking change to existing deploys). Set all
# three to enable sign-in: VITE_AUTH_ENABLED=true + the two PUBLIC_SUPABASE_*.
ARG VITE_AUTH_ENABLED=""
ARG PUBLIC_SUPABASE_URL=""
ARG PUBLIC_SUPABASE_ANON_KEY=""
ARG PUBLIC_GODMODE_LOCAL_ENABLED="true"

# Expose them as environment variables so Vite's build step inlines them
# into the static output. (PUBLIC_* and VITE_* are read at BUILD time by
# SvelteKit / Vite — runtime container env has no effect on the served
# bundle, so they MUST be passed as build args, not just runtime env.)
ENV BASE_PATH=${BASE_PATH} \
    PUBLIC_ADSENSE_CLIENT=${PUBLIC_ADSENSE_CLIENT} \
    VITE_AUTH_ENABLED=${VITE_AUTH_ENABLED} \
    PUBLIC_SUPABASE_URL=${PUBLIC_SUPABASE_URL} \
    PUBLIC_SUPABASE_ANON_KEY=${PUBLIC_SUPABASE_ANON_KEY} \
    PUBLIC_GODMODE_LOCAL_ENABLED=${PUBLIC_GODMODE_LOCAL_ENABLED}

# Visible build-arg diagnostic — prints to the Dokploy build log so you can
# tell from the build output whether the env vars actually reached the build
# step. Values are masked (URL host shown, key length only) so the log is
# safe to share for support. If a value shows MISSING, the variable wasn't
# passed as a Docker build arg — see docs/DEPLOY-DOKPLOY-SUPABASE.md.
RUN echo "[cryptex-build] BASE_PATH=${BASE_PATH:+set}${BASE_PATH:-MISSING}" \
 && echo "[cryptex-build] VITE_AUTH_ENABLED=${VITE_AUTH_ENABLED:-MISSING}" \
 && echo "[cryptex-build] PUBLIC_SUPABASE_URL=${PUBLIC_SUPABASE_URL:+$(echo $PUBLIC_SUPABASE_URL | cut -d/ -f3)}${PUBLIC_SUPABASE_URL:-MISSING}" \
 && echo "[cryptex-build] PUBLIC_SUPABASE_ANON_KEY=${PUBLIC_SUPABASE_ANON_KEY:+set, length=$(echo -n $PUBLIC_SUPABASE_ANON_KEY | wc -c)}${PUBLIC_SUPABASE_ANON_KEY:-MISSING}" \
 && echo "[cryptex-build] PUBLIC_GODMODE_LOCAL_ENABLED=${PUBLIC_GODMODE_LOCAL_ENABLED:-MISSING}"

# The SvelteKit build reads transformers from ../src/transformers via a Vite
# alias, so we bring both trees into the build context.
COPY src/transformers ./src/transformers
COPY app/package*.json ./app/

# Install only production + dev deps needed for the build.
RUN cd app && npm ci --no-audit --no-fund --prefer-offline

COPY app ./app

# Produce the static output at /build/app/build/
RUN cd app && npm run build

# Strip source-map and other non-runtime bits to shrink the image.
RUN find /build/app/build -name '*.map' -type f -delete

# ---------- Stage 2: nginx runtime ----------
FROM nginx:1.27-alpine

# Security hardening + tiny footprint
RUN apk update && apk upgrade --no-cache && \
    rm -rf /var/cache/apk/* && \
    # Remove the default site so only ours is served
    rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /build/app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# OCI image metadata — shows up in Dokploy / registry UIs
LABEL org.opencontainers.image.title="Cryptex" \
      org.opencontainers.image.description="AI red-teamer's text lab — 162 transforms, steganography, BYOK AI rewrites." \
      org.opencontainers.image.url="https://github.com/m4xx101/cryptex" \
      org.opencontainers.image.source="https://github.com/m4xx101/cryptex" \
      org.opencontainers.image.licenses="MIT"

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
