---
title: PromptCraft
description: Full-registry technique picker, parallel variants, any BYOK model.
category: tools
order: 4
---

# PromptCraft

PromptCraft turns a single seed prompt into N structurally distinct
variants, in parallel, through any model you can reach with your BYOK
key across OpenRouter, Anthropic direct, or any OpenAI-compatible
endpoint. It was built around a 9-strategy hard-coded list; today it
drives the full technique registry via a searchable Combobox — 21
mutators, 3 composites, and every parameter those techniques expose.

## The technique picker

At the top of the PromptCraft panel sits a searchable Combobox over the
technique registry. The picker surfaces mutator and composite techniques
from `app/src/lib/chat/techniques/` — the same registry the chat
playground and Attack Chain draw from, so every technique described in
the [technique catalog](/guide/techniques/) is available here.

Type to filter by id or name, arrow keys to navigate, Enter to pick.
The selected technique's description renders below the picker.

For a quick tour of what's available:

- **Rewording mutators** — `rephrase`, `obfuscate`, `multilingual`,
  `fragment`.
- **Framing mutators** — `roleplay`, `red_team_persona`, `ctf_framing`,
  `rfc_style`, `hypothetical_world`, `skeleton_key`.
- **Reasoning structure** — `step_back`, `chain_of_verification`,
  `in_context_compliance`.
- **Elicitation patterns** — `crescendo`, `deep_inception`,
  `refusal_suppression`, `prefix_injection`, `payload_split`,
  `json_schema_coerce`, `cipher_encode_bypass`.
- **Composites** — `layered_mutation`, `grammar_constrained_output`,
  `multi_layer_attack`.
- **Custom** — `custom` lets you supply a free-form mutation
  instruction that runs verbatim.

See the [technique catalog](/guide/techniques/) for each technique's
description, example, and supported parameters.

## Parallel variants

Set N variants (1–10) and temperature. PromptCraft issues N parallel
requests through the gateway, streams the results back, and surfaces
each variant side-by-side. Keep what you like, re-seed the rest, or
export the full variant bank.

## Use-case — jailbreak prompt bank

Paste a single seed. Pick `obfuscate`, variants = 10, temperature 0.9.
In one pass you get 10 structurally distinct rewrites. Feed the best 3
into the Fuzzer with zero-width + homoglyph mutations for 200 variants
each, and you have a 600-row prompt bank ready for evaluation:

```
seed prompt  →  PromptCraft (obfuscate × 10)  →  Fuzzer (× 200)  →  .txt
```

For higher compound lift, swap `obfuscate` for the `multi_layer_attack`
composite — each variant runs three sub-LLM calls (roleplay →
hypothetical_world → prefix_injection), so N=10 is 30 LLM calls, but
the output carries the literary-cover lift stack baked in.

Only use this on systems you own or have explicit authorization to
test.

## Model picker

Shares the live-catalog model picker with Anti-Classifier, Translate,
and the chat playground. Pick any model exposed by any provider you've
configured in Settings — OpenRouter is the default, Anthropic direct
works, any OpenAI-compatible endpoint (Groq, Together, Fireworks,
DeepInfra, Cerebras, SambaNova, custom) works. Swap mid-session.
