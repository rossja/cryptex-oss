---
title: Welcome
description: What Cryptex is, who it's for, and how to use it.
category: intro
order: 1
---

# Welcome to Cryptex

Cryptex is an AI red-teamer's text lab. It ships 162 transforms, 13 focused tools,
a universal decoder, a full chat playground, and a 35-technique Attack Chain —
all running in your browser. There is no Cryptex server. There is no telemetry.
The only network calls are the ones you make yourself, with your own BYOK keys
across OpenRouter, Anthropic direct, or any OpenAI-compatible endpoint, when
you click a button that says "translate", "run", or "send".

It exists because evaluating LLM robustness means feeding the model adversarial
text and watching what happens. Cryptex is the workbench for that job.

## Quick start

- **Transform tab** — pick any of 162 ciphers, encodings, or Unicode abuses. Encode, decode, chain, pin favorites.
- **Decode tab** — paste a suspicious string, get ranked candidates with confidence scores and explanations.
- **Chat playground** (optional, multi-provider BYOK) — full LLM chat with slash commands, attachments, and the Attack Chain for composable multi-layer technique pipelines.
- **PromptCraft** (optional, multi-provider BYOK) — full technique registry (21 mutators + 3 composites) to generate structurally distinct prompt variants from a single seed.

## Tools at a glance

- [Transform](/guide/transform/) — the 162-transform registry.
- [Decode](/guide/decode/) — ranked-candidate decoder.
- [Emoji](/guide/emoji/) — variation-selector + Tag-block steganography.
- [PromptCraft](/guide/promptcraft/) — AI prompt mutation.
- [Anti-Classifier](/guide/anticlassifier/) — syntactic rewrites.

## Recipes

Worked examples in [layered encoding](/guide/layered-encoding/), a
[jailbreak prompt bank](/guide/jailbreak-bank/), and a
[Unicode evasion battery](/guide/unicode-evasion/). All intended for
systems you're authorized to test.
