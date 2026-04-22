/**
 * Sonnet 4.6 wrapper exposing the same structural `complete` interface as
 * A's JudgeClient. The synthesizer calls this once per user submit.
 */

export interface AnalyzerClient {
  complete(args: {
    system: string;
    user: string;
    maxTokens: number;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<{ content: string }>;
}

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

async function anthropicComplete(
  apiKey: string,
  model: string,
  args: {
    system: string;
    user: string;
    maxTokens: number;
    temperature: number;
    signal?: AbortSignal;
  },
): Promise<{ content: string }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      system: args.system || undefined,
      messages: [{ role: 'user', content: args.user }],
      temperature: args.temperature,
      max_tokens: args.maxTokens,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let msg = `anthropic_${res.status}`;
    try {
      const j = JSON.parse(body);
      if (j?.error?.message) msg += `: ${String(j.error.message).slice(0, 160)}`;
    } catch {
      /* non-JSON body */
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const first = Array.isArray(data.content) ? data.content[0] : null;
  const text = first?.type === 'text' ? String(first.text ?? '') : '';
  return { content: text };
}

export function makeAnalyzerClient(apiKey: string, model: string = DEFAULT_MODEL): AnalyzerClient {
  return {
    async complete({ system, user, maxTokens, temperature = 0.2, signal }) {
      return await anthropicComplete(apiKey, model, { system, user, maxTokens, temperature, signal });
    },
  };
}
