/**
 * True if `model` is served by one of the user's enabled providers.
 *
 * Used by ModelPickerV2 to scope the model list to what the user has actually
 * configured — so an Anthropic-only or OpenAI-compatible-only user sees their
 * own models instead of the shipped OpenRouter fallback (which they cannot
 * route to). With zero configured providers, returns true so the picker is
 * still browseable (showing the shipped fallback) before any setup.
 *
 * Matching is by provider id (`openrouter` / `anthropic` / `openai-compat`),
 * which is the `provider` field on a catalog Model and the `id` on a
 * ProviderRecord. For openai-compat the qualifiedId still encodes the instance,
 * so selection routes correctly even with multiple instances configured.
 *
 * Structurally typed (rather than importing Model / ProviderRecord) so it is
 * trivially unit-testable and decoupled; real Model[] / ProviderRecord[] from
 * the call site satisfy these shapes.
 */
export function modelMatchesProviders(
  model: { provider?: string },
  enabledProviders: ReadonlyArray<{ id: string }>
): boolean {
  if (enabledProviders.length === 0) return true;
  return enabledProviders.some((p) => p.id === model.provider);
}
