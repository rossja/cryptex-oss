import type { ProviderPreset } from './types';

/**
 * OpenAI-compatible preset templates.
 *
 * Each preset is editable in the ProviderCard after creation — if a baseURL or
 * default model goes stale, users can fix it in-place.
 *
 * Local-model providers (Ollama, LM Studio, vLLM, Llama.cpp) use localhost URLs
 * and don't require API keys (supportsAuthProbe: false). Cloud providers require
 * the user's own API key and validate via /v1/models on save.
 *
 * `defaultModels` is the fallback list shown when the live `/v1/models` fetch
 * fails (CORS, network, auth, or anything else). Cloud providers ship with a
 * curated set of known model IDs so the picker is never empty. Local providers
 * (Ollama, LM Studio, vLLM, Llama.cpp) leave it empty — users define their own
 * model names there, and the picker free-text input handles that case.
 */
export const OPENAI_COMPAT_PRESETS: ProviderPreset[] = [
  { id: 'openai',     name: 'OpenAI',     baseURL: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    defaultTestModel: 'gpt-4o-mini', supportsAuthProbe: true,
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'] },
  { id: 'gemini',     name: 'Google Gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
    defaultTestModel: 'gemini-2.5-flash', supportsAuthProbe: true,
    defaultModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'] },
  { id: 'groq',       name: 'Groq',       baseURL: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/docs/api-reference',
    defaultTestModel: 'llama-3.3-70b-versatile', supportsAuthProbe: true,
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'deepseek-r1-distill-llama-70b'] },
  { id: 'together',   name: 'Together',   baseURL: 'https://api.together.xyz/v1',
    docsUrl: 'https://docs.together.ai/reference/chat-completions-1',
    defaultTestModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', supportsAuthProbe: true,
    defaultModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'mistralai/Mistral-7B-Instruct-v0.3', 'Qwen/Qwen2.5-72B-Instruct-Turbo'] },
  { id: 'fireworks',  name: 'Fireworks',  baseURL: 'https://api.fireworks.ai/inference/v1',
    docsUrl: 'https://docs.fireworks.ai/api-reference/introduction',
    defaultTestModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    supportsAuthProbe: true,
    defaultModels: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct', 'accounts/fireworks/models/qwen2p5-72b-instruct'] },
  { id: 'deepinfra',  name: 'DeepInfra',  baseURL: 'https://api.deepinfra.com/v1/openai',
    docsUrl: 'https://deepinfra.com/docs/advanced/openai_api',
    defaultTestModel: 'meta-llama/Llama-3.3-70B-Instruct', supportsAuthProbe: true,
    defaultModels: ['meta-llama/Llama-3.3-70B-Instruct', 'meta-llama/Meta-Llama-3.1-70B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'] },
  { id: 'cerebras',   name: 'Cerebras',   baseURL: 'https://api.cerebras.ai/v1',
    docsUrl: 'https://inference-docs.cerebras.ai/api-reference/chat-completions',
    defaultTestModel: 'llama-3.3-70b', supportsAuthProbe: true,
    defaultModels: ['llama-3.3-70b', 'llama-3.1-8b', 'llama3.1-70b', 'llama3.1-8b'] },
  { id: 'deepseek',   name: 'DeepSeek',   baseURL: 'https://api.deepseek.com/v1',
    docsUrl: 'https://api-docs.deepseek.com/',
    defaultTestModel: 'deepseek-chat', supportsAuthProbe: true,
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'sambanova',  name: 'SambaNova',  baseURL: 'https://api.sambanova.ai/v1',
    docsUrl: 'https://docs.sambanova.ai/cloud/api-reference/endpoints/chat',
    defaultTestModel: 'Meta-Llama-3.3-70B-Instruct', supportsAuthProbe: true,
    defaultModels: ['Meta-Llama-3.3-70B-Instruct', 'Meta-Llama-3.1-70B-Instruct', 'Meta-Llama-3.1-8B-Instruct'] },
  { id: 'nvidia',     name: 'NVIDIA',     baseURL: 'https://integrate.api.nvidia.com/v1',
    docsUrl: 'https://docs.api.nvidia.com/nim/reference/llm-apis',
    defaultTestModel: 'meta/llama-3.3-70b-instruct', supportsAuthProbe: true,
    defaultModels: ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1', 'meta/llama-3.1-8b-instruct'] },
  { id: 'ollama',     name: 'Ollama',     baseURL: 'http://localhost:11434/v1',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
    defaultTestModel: 'llama3.2', supportsAuthProbe: false },
  { id: 'lmstudio',   name: 'LM Studio',  baseURL: 'http://localhost:1234/v1',
    docsUrl: 'https://lmstudio.ai/docs/api/openai-api',
    defaultTestModel: 'local-model', supportsAuthProbe: false },
  { id: 'vllm',       name: 'vLLM',       baseURL: 'http://localhost:8000/v1',
    docsUrl: 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html',
    defaultTestModel: 'meta-llama/Llama-3.3-70B-Instruct', supportsAuthProbe: false },
  { id: 'llamacpp',   name: 'Llama.cpp',  baseURL: 'http://localhost:8080/v1',
    docsUrl: 'https://github.com/ggml-org/llama.cpp/tree/master/tools/server',
    defaultTestModel: 'gpt-3.5-turbo', supportsAuthProbe: false },
  { id: 'custom',     name: 'Custom',     baseURL: '', docsUrl: '',
    defaultTestModel: undefined, supportsAuthProbe: false }
];

export function getPreset(id: string): ProviderPreset | undefined {
  return OPENAI_COMPAT_PRESETS.find((p) => p.id === id);
}

/**
 * IDs of openai-compat presets that point at a local server with no API key.
 * These run on localhost (Ollama, LM Studio, vLLM, Llama.cpp) and don't
 * require auth — a configured baseURL is enough for them to count as ready.
 */
const LOCAL_PRESET_IDS = new Set(['ollama', 'lmstudio', 'vllm', 'llamacpp']);

/**
 * True when an openai-compat preset requires the user to provide an API key.
 *
 * - Local presets (ollama / lmstudio / vllm / llamacpp): false — no auth.
 * - 'custom' or unknown / undefined: true — safe default; we don't know what
 *   the user's endpoint expects, so don't claim "configured" without a key.
 * - Everything else (cloud presets): true.
 */
export function presetRequiresKey(presetId: string | undefined): boolean {
  if (!presetId) return true;
  if (presetId === 'custom') return true;
  return !LOCAL_PRESET_IDS.has(presetId);
}
