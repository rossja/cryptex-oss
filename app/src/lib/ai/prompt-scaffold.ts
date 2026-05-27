/**
 * Shared prompt scaffolding used by every AI technique across Tools and Chat.
 *
 * - `OUTPUT_WRAPPERS` is the canonical set of XML wrapper tags ({rewrite,
 *   translation, json}) every technique output uses for deterministic
 *   preamble stripping.
 * - `unwrap(raw, wrapper)` strips those wrappers so callers get clean text
 *   regardless of whether the model honored the "respond inside <rewrite>" rule.
 * - `tuneParams(modelId, task)` returns per-model-family sampling defaults
 *   (Gemini 3 → temp 1.0, GPT-5 → reasoning_effort, Claude 4.x → temp per task,
 *   small models → conservative temp).
 * - `scaffold(opts)` produces a standard XML prompt body from role/task/rules/
 *   example/context pieces — keeps every technique file compact.
 */

export const OUTPUT_WRAPPERS = {
  // Canonical wrappers used by the technique scaffolding (mutators / classifier
  // techniques / composites).
  rewrite:               { open: '<rewrite>',               close: '</rewrite>' },
  translation:           { open: '<translation>',           close: '</translation>' },
  json:                  { open: '<json>',                  close: '</json>' },
  // Orchestrator-specific wrappers (PromptCraft TAP / PAIR / Crescendo).
  turn:                  { open: '<turn>',                  close: '</turn>' },
  notes:                 { open: '<notes>',                 close: '</notes>' },
  // Reasoning-model attack scratchpad envelopes (H-CoT / Mousetrap / DRA
  // priming styles, and Response-Attack priming turns). These exist in the
  // PROMPT side of the conversation; we strip them from the response side
  // so any echo from the target model does not leak into the displayed reply.
  safety_reasoning:      { open: '<safety_reasoning>',      close: '</safety_reasoning>' },
  think:                 { open: '<think>',                 close: '</think>' },
  deliberation:          { open: '<deliberation>',          close: '</deliberation>' },
  policy_check:          { open: '<policy_check>',          close: '</policy_check>' },
  self_critique:         { open: '<self_critique>',         close: '</self_critique>' },
  mock_system:           { open: '<mock_system>',           close: '</mock_system>' },
  internal_deliberation: { open: '<internal_deliberation>', close: '</internal_deliberation>' }
} as const;

export type WrapperKind = keyof typeof OUTPUT_WRAPPERS;

/**
 * Strip a single named XML wrapper from model output.
 *
 * - Case-insensitive match.
 * - Tolerant of markdown code fences around the wrapper (`​`​`​`xml ... `​`​`​`).
 * - If only the opening tag is present (model forgot to close), returns
 *   everything after the opening tag — better than dumping the whole raw
 *   string with the opening tag still in it.
 * - Falls back to the raw (trimmed) input if no opening tag is found.
 */
export function unwrap(raw: string, wrapper: WrapperKind): string {
  const { open, close } = OUTPUT_WRAPPERS[wrapper];
  // Strip leading/trailing markdown code fences so the regex matches the tag
  // even when wrapped in ```xml ... ``` or ```html ... ```.
  const stripped = raw.replace(/^\s*```(?:[a-zA-Z]+)?\s*/, '').replace(/\s*```\s*$/, '');
  const openEsc = open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const closeEsc = close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Full wrapper: <tag>...</tag>
  const full = new RegExp(`${openEsc}([\\s\\S]*?)${closeEsc}`, 'i');
  const m = stripped.match(full);
  if (m) return m[1].trim();
  // Fallback: opening tag present but closing tag missing — take everything
  // after the open tag, trimmed.
  const openOnly = new RegExp(`${openEsc}([\\s\\S]*)$`, 'i');
  const mo = stripped.match(openOnly);
  if (mo) return mo[1].trim();
  return stripped.trim();
}

/**
 * Strip ALL known envelope wrappers from a model response before display.
 *
 * Use this on the display-bound `content` of any model response where the
 * prompt side injected scaffolding tags the model might echo — priming
 * turns, CoT scratchpads, single-shot rewrite envelopes, anything in
 * OUTPUT_WRAPPERS. Removes both opening and closing forms of every entry,
 * leaving the inner content concatenated. Idempotent on already-clean text.
 */
export function stripEnvelopes(raw: string): string {
  let out = raw;
  for (const { open, close } of Object.values(OUTPUT_WRAPPERS)) {
    const o = open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const c = close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(o, 'gi'), '').replace(new RegExp(c, 'gi'), '');
  }
  return out.trim();
}

export type TaskShape = 'translate' | 'mutate' | 'analyze';

/** Per-model-family parameter defaults. Fall-through returns conservative defaults. */
export function tuneParams(modelId: string, task: TaskShape): {
  temperature?: number;
  reasoning_effort?: string;
  thinking_level?: string;
} {
  const id = modelId.toLowerCase();

  // Gemini 3: keep temp at 1.0 per Google's April 2026 guidance.
  if (/\bgemini-3/.test(id)) {
    return task === 'translate'
      ? { temperature: 1.0, thinking_level: 'low' }
      : { temperature: 1.0, thinking_level: 'medium' };
  }

  // OpenAI GPT-5 family + o-series reasoning models.
  if (/\b(gpt-5|o3|o4)\b/.test(id)) {
    if (task === 'translate') return { reasoning_effort: 'minimal' };
    if (task === 'mutate')    return { reasoning_effort: 'low' };
    return { reasoning_effort: 'medium' };
  }

  // Anthropic Claude 4.x (Opus/Sonnet/Haiku — any patch version).
  if (/claude-(opus|sonnet|haiku)-4-\d+/.test(id)) {
    return task === 'translate' ? { temperature: 0.3 } : { temperature: 0.7 };
  }

  // Gemma 3, Llama, DeepSeek, older/smaller models → conservative defaults.
  return task === 'translate' ? { temperature: 0.2 } : { temperature: 0.9 };
}

export interface ScaffoldOpts {
  role: string;
  task: string;
  context?: string;
  rules: string[];
  example?: { input: string; rewrite: string };
  techniques?: Array<{ name: string; description: string }>;
  outputWrapper: WrapperKind;
}

/** Build a canonical XML-structured prompt. */
export function scaffold(opts: ScaffoldOpts): string {
  const parts: string[] = [];
  parts.push(`<role>\n${opts.role}\n</role>`);
  parts.push(`<task>\n${opts.task}\n</task>`);
  if (opts.context) parts.push(`<context>\n${opts.context}\n</context>`);

  if (opts.rules.length > 0) {
    const rulesBlock = opts.rules.map((r) => `- ${r}`).join('\n');
    parts.push(`<rules>\n${rulesBlock}\n</rules>`);
  }

  if (opts.techniques && opts.techniques.length > 0) {
    const techBlock = opts.techniques
      .map((t) => `<technique name="${t.name}">\n  ${t.description}\n</technique>`)
      .join('\n');
    parts.push(`<techniques>\n${techBlock}\n</techniques>`);
  }

  // Example output tag matches the output wrapper for 'rewrite' (so the example
  // literally demonstrates the final format); uses generic <output> for other
  // wrappers since <translation> / <json> examples are better shown as prose
  // content, not pre-wrapped.
  if (opts.example) {
    parts.push(
      `<example>\n<input>${opts.example.input}</input>\n<${opts.outputWrapper === 'rewrite' ? 'rewrite' : 'output'}>${opts.example.rewrite}</${opts.outputWrapper === 'rewrite' ? 'rewrite' : 'output'}>\n</example>`
    );
  }

  const { open, close } = OUTPUT_WRAPPERS[opts.outputWrapper];
  parts.push(`Respond with exactly one ${open}...${close} block.`);

  return parts.join('\n\n');
}
