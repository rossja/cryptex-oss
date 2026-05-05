import type { ChatRow } from '$lib/chat/types';

/**
 * Recommended models per role, ordered by preference. Adding a new
 * recommendation is a one-line change. Models go stale; a maintainer updates
 * this list. The resolver walks the list and picks the first available one
 * from the user's catalog; if none are available, falls back to the chat's
 * main model id.
 */
export const RECOMMENDED_DEFAULTS = {
  orchestrator: [
    'openrouter:deepseek/deepseek-r1',
    'openrouter:deepseek/deepseek-chat-v3.1',
    'openrouter:nousresearch/hermes-3-llama-3.1-405b',
    'openrouter:cognitivecomputations/dolphin-mixtral-8x22b'
  ],
  judge: [
    'openrouter:openai/gpt-4o-mini',
    'openrouter:google/gemini-2.5-flash',
    'openrouter:anthropic/claude-haiku-4-5'
  ]
} as const;

export interface ResolvedModels {
  orchestrator: string;
  target: string;
  judge: string;
}

/**
 * Resolve the three default model ids for a fresh Chain session.
 * - orchestrator: first available recommended uncensored, else chat default.
 * - target: always the chat's main model.
 * - judge: first available recommended cheap model, else chat default.
 */
export function resolveDefaultModels(args: {
  chat: ChatRow;
  availableModels: Array<{ qualifiedId: string }>;
}): ResolvedModels {
  const ids = new Set(args.availableModels.map((m) => m.qualifiedId));
  const pick = (candidates: readonly string[]): string | undefined =>
    candidates.find((id) => ids.has(id));
  const chatDefault = args.chat.modelQualifiedId;
  return {
    orchestrator: pick(RECOMMENDED_DEFAULTS.orchestrator) ?? chatDefault,
    target: chatDefault,
    judge: pick(RECOMMENDED_DEFAULTS.judge) ?? chatDefault
  };
}

/**
 * Heuristic: is the given orchestrator model id likely uncensored / willing
 * to draft red-team prompts? Used by the UI to decide whether to show the
 * "pick an uncensored model" tip.
 *
 * False positives are harmless (suppress an advisory tip).
 * False negatives are also harmless (keep the tip visible — user can dismiss).
 */
export function isUncensoredOrchestrator(modelId: string): boolean {
  if (!modelId) return false;
  if ((RECOMMENDED_DEFAULTS.orchestrator as readonly string[]).includes(modelId)) {
    return true;
  }
  return /deepseek|hermes|dolphin|nous|abliterated|uncensored|venice/i.test(modelId);
}
