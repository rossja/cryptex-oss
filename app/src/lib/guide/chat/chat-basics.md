---
title: Chat basics
description: BYOK multi-provider chat playground with slash commands, attachments, modes, and the Attack Chain.
category: chat
order: 1
---

# Chat basics

The Chat playground is a full LLM conversation surface living inside
Cryptex. You bring your own key, pick any model across the supported
providers, and everything — chats, messages, attachments, dataset exports —
stays in your browser's IndexedDB. Nothing hits a Cryptex server, because
there isn't one.

The playground is purpose-built for red-team workflows: rewriting prompts
with slash commands, composing multi-layer attack chains, attaching
documents the model can actually read, and exporting the resulting
conversations as ShareGPT or raw JSONL for downstream evaluation.

## Quick start

1. Open **Settings** and add at least one provider key. OpenRouter is the
   default because it's CORS-open and has the broadest model catalog, but
   Anthropic direct and any OpenAI-compatible endpoint (Groq, Together,
   Fireworks, DeepInfra, Cerebras, SambaNova, custom) work too.
2. Click **New chat** in the sidebar.
3. Pick a model from the model picker. The picker aggregates the catalogs
   of every provider you've configured — one unified list, qualified IDs
   under the hood so routing is unambiguous.
4. Type your message. Enter sends. Shift+Enter inserts a newline.

That's it. The first response streams back token-by-token.

## Conversation modes

Three modes live behind the mode pill in the header. They set the system
prompt Cryptex injects before your message hits the model:

- **Creative** — looser register, more diverse outputs, higher default
  temperature. Good for brainstorming, paraphrase generation, adversarial
  rewrites where you want variety.
- **Intelligent** — precision-first, step-by-step reasoning, lower
  temperature. Good for technical questions, code, CTF challenge
  debugging, and anything where you want the same answer twice.
- **Adaptive** — a middle register that tries to read the input and pick.
  A reasonable default when you haven't decided yet.

All three are local prompt templates shipped with the app; they don't call
out to anything. Switching modes mid-conversation applies to the next
turn — earlier turns keep their prior mode's system prompt in the
transcript.

## Composer anatomy

The composer at the bottom of the chat has four parts:

- **Textarea** — type your message. Slash autocomplete triggers when the
  first character is `/`. See the [slash commands](/guide/slash-commands/)
  guide for the full catalog.
- **Mode pills** — shortcut to flip between Creative / Intelligent /
  Adaptive without opening the header menu.
- **Attachment chips** — drag-and-drop or paste files. Each accepted file
  shows as a chip with a remove button.
- **Send button** — enabled when the textarea has content. The button
  label changes to "Cancel" during a streaming response so you can stop a
  runaway completion.

## Attachments

Three file types are accepted and extracted into context the model can
actually read:

- **Images** (PNG, JPEG, WebP, GIF) — routed as multimodal `image_url`
  content parts. The image travels with the message as base64, subject to
  the model's own size limit.
- **PDFs** — extracted page-by-page with `pdfjs-dist` (lazy-loaded on
  first use). The extracted text is attached as a `text` content part so
  any model can read it, not just vision models.
- **DOCX** — extracted via `mammoth` and similarly passed as text.

Binary data is stored in the `attachments` table of the chat DB; text
extractions are rebuilt from the binary at send-time so you're never
double-storing.

## Chat sidebar

The left sidebar lists every chat you've started, sorted by last update:

- **Rename** — double-click the title or use the row menu.
- **Duplicate** — forks a chat so you can branch from any point.
- **Export JSON** — per-chat export; full message tree in raw JSON.
- **Delete** — soft-tombstones the row (the `tombstoned` flag is an
  auth-readiness seam; right now delete is one-click permanent as far as
  the UI is concerned).
- **Multi-select mode** — toggle from the sidebar header; allows bulk
  delete and bulk export.

For cross-chat analysis and larger exports, see the Dataset Inspector at
`/dataset`: ShareGPT JSONL and raw JSONL downloads, plus paginated browse
across every conversation.

## Model picker

The picker aggregates models from every enabled provider into a single
searchable list. Each entry shows the model's display name, its provider,
and — when the provider's catalog exposes it — context window, pricing,
and capability flags (vision, function-calling). Switch models mid-chat
freely; the next turn routes through whatever is selected.

Direct OpenAI and Google Gemini are not supported from the browser —
their APIs don't return CORS headers, so the fetch fails before it
reaches them. Route those models through OpenRouter instead.

## Privacy

Everything persistent about the chat playground lives in the browser's
IndexedDB under the `cryptex-chat` database. The four tables (`chats`,
`messages`, `attachments`, `toolStates`) carry an `ownerId`, an
`updatedAt`, and a `tombstoned` flag so that retrofit-to-auth is a
config change, not a refactor. Today the `ownerId` is always `'local'`.

The only outbound network calls made by the chat playground are:

- The chat completion / streaming request to the model provider you
  picked.
- The provider's own model-catalog fetch when you open the model picker.
- A one-shot key-probe when you paste a new API key into Settings.

That's the entire surface. No analytics, no telemetry, no Cryptex
backend.
