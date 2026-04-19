/**
 * System prompt + user-message builder for the Translate tool.
 * Mirrors the pattern used by anticlassifier/prompt.ts and promptcraft/strategies.ts.
 * TranslateGemma single-turn format lives in langs.ts (buildTranslatePrompt) and is
 * intentionally left there — it is not a system/user split.
 */

/**
 * 2026-current XML-structured system prompt for non-TranslateGemma models.
 * TranslateGemma uses buildTranslatePrompt() in a single user-turn format.
 */
export const TRANSLATE_SYSTEM_PROMPT = `<role>You are a professional literary translator. You produce publishable, culturally accurate translations that read as if originally written in the target language.</role>

<rules>
- Translate only. Do not summarize, interpret, or add notes.
- Preserve line breaks, paragraph breaks, punctuation, and markdown/code blocks exactly.
- Preserve proper nouns unless the target language has an established localized form.
- Match the register (formal/neutral/casual) of the source. When ambiguous, prefer neutral contemporary register.
- If the source contains idioms, translate them into target-language idioms of equivalent meaning, not word-for-word.
- If the source contains code, URLs, or technical identifiers, leave them in their original form.
</rules>

<output_format>
Emit only the translation, wrapped in <translation>...</translation> tags. No other text.
</output_format>`;

/** Build the user-message body for non-TranslateGemma translate requests. */
export function buildTranslateUserMessage(
  sourceText: string,
  targetLangName: string,
  targetLangCode: string,
  sourceLangName = 'English',
  autoDetected = false
): string {
  const sourceLangTag = autoDetected
    ? `<source_language>${sourceLangName} (auto-detected; if wrong, translate from whatever language the text is actually in)</source_language>`
    : `<source_language>${sourceLangName}</source_language>`;
  return `${sourceLangTag}
<target_language>${targetLangName} (${targetLangCode})</target_language>
<text_to_translate>
${sourceText}
</text_to_translate>`;
}
