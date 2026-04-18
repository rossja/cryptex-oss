import { browser } from '$app/environment';
import type { Model } from './types';
import { listProviders } from './providers.svelte';
import { openrouterAdapter } from './adapters/openrouter';
import { anthropicAdapter } from './adapters/anthropic';
import { openaiCompatAdapter } from './adapters/openai-compat';

const FALLBACK_MODELS: ReadonlyArray<Model> = Object.freeze([
  { id: 'openrouter/auto',                      qualifiedId: 'openrouter:openrouter/auto',                      name: 'Auto (best for price)', provider: 'openrouter', upstreamProvider: 'OpenRouter' },
  { id: 'anthropic/claude-sonnet-4.5',          qualifiedId: 'openrouter:anthropic/claude-sonnet-4.5',          name: 'Claude Sonnet 4.5',     provider: 'openrouter', upstreamProvider: 'Anthropic' },
  { id: 'anthropic/claude-haiku-4.5',           qualifiedId: 'openrouter:anthropic/claude-haiku-4.5',           name: 'Claude Haiku 4.5',      provider: 'openrouter', upstreamProvider: 'Anthropic' },
  { id: 'openai/gpt-4o',                        qualifiedId: 'openrouter:openai/gpt-4o',                        name: 'GPT-4o',                provider: 'openrouter', upstreamProvider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini',                   qualifiedId: 'openrouter:openai/gpt-4o-mini',                   name: 'GPT-4o Mini',           provider: 'openrouter', upstreamProvider: 'OpenAI' },
  { id: 'google/gemini-2.5-flash-preview',      qualifiedId: 'openrouter:google/gemini-2.5-flash-preview',      name: 'Gemini 2.5 Flash',      provider: 'openrouter', upstreamProvider: 'Google' },
  { id: 'google/gemma-3-27b-it',                qualifiedId: 'openrouter:google/gemma-3-27b-it',                name: 'Gemma 3 27B',           provider: 'openrouter', upstreamProvider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct',    qualifiedId: 'openrouter:meta-llama/llama-3.3-70b-instruct',    name: 'Llama 3.3 70B',         provider: 'openrouter', upstreamProvider: 'Meta' },
  { id: 'deepseek/deepseek-chat-v3-0324',       qualifiedId: 'openrouter:deepseek/deepseek-chat-v3-0324',       name: 'DeepSeek V3',           provider: 'openrouter', upstreamProvider: 'DeepSeek' },
  { id: 'x-ai/grok-4',                          qualifiedId: 'openrouter:x-ai/grok-4',                          name: 'Grok 4',                provider: 'openrouter', upstreamProvider: 'xAI' }
]);

const CACHE_KEY = 'cryptex.catalogCache.v2';
const CACHE_TTL_MS = 60 * 60 * 1000;

type Status = 'idle' | 'loading' | 'ready' | 'error';
type CacheShape = { models: Model[]; fetchedAt: number };

let status = $state<Status>('idle');
let items = $state<Model[]>([]);
let fetchedAt = $state<number | null>(null);
let error = $state<string>('');
let abortController: AbortController | null = null;

function loadCache(): CacheShape | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch { return null; }
}
function saveCache(models: Model[], ts: number): void {
  if (!browser) return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ models, fetchedAt: ts })); } catch { /* ignore */ }
}

async function fetchAll(signal: AbortSignal): Promise<Model[]> {
  const providers = listProviders().filter((p) => p.enabled);
  const results: Model[] = [];
  for (const p of providers) {
    try {
      switch (p.id) {
        case 'openrouter': {
          const a = openrouterAdapter(p);
          results.push(...await a.fetchCatalog(signal));
          break;
        }
        case 'anthropic': {
          const a = anthropicAdapter(p);
          results.push(...await a.fetchCatalog(signal));
          break;
        }
        case 'openai-compat': {
          const a = openaiCompatAdapter(p);
          results.push(...await a.fetchCatalog(signal));
          break;
        }
      }
    } catch (e) {
      // per-provider failure does not fail the whole catalog
      if ((e as Error)?.name === 'AbortError') throw e;
      console.warn(`[catalog] ${p.id} fetch failed:`, e);
    }
  }
  return results;
}

export async function refreshCatalog(force = false, signal?: AbortSignal): Promise<void> {
  if (!browser) return;
  if (!force && fetchedAt && Date.now() - fetchedAt < CACHE_TTL_MS && items.length > 0) return;
  if (abortController) abortController.abort();
  abortController = new AbortController();
  signal?.addEventListener('abort', () => abortController?.abort(), { once: true });
  status = 'loading';
  error = '';
  try {
    const models = await fetchAll(abortController.signal);
    items = models;
    fetchedAt = Date.now();
    status = 'ready';
    saveCache(models, fetchedAt);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
    error = (e as Error)?.message ?? 'catalog fetch failed';
    status = 'error';
  } finally {
    abortController = null;
  }
}

function hydrate(): void {
  if (status !== 'idle') return;
  const cached = loadCache();
  if (cached) { items = cached.models; fetchedAt = cached.fetchedAt; status = 'ready'; }
}

export const catalog = {
  get status(): Status { return status; },
  get error(): string { return error; },
  get list(): ReadonlyArray<Model> { return items.length > 0 ? items : FALLBACK_MODELS; },
  get isLive(): boolean { return items.length > 0; },
  get fetchedAt(): number | null { return fetchedAt; },
  refresh(force = true): Promise<void> { return refreshCatalog(force); },
  find(qualifiedId: string): Model | undefined {
    const list = items.length > 0 ? items : FALLBACK_MODELS;
    return list.find((m) => m.qualifiedId === qualifiedId || m.id === qualifiedId);
  },
  get byUpstream(): Record<string, Model[]> {
    const list = items.length > 0 ? items : FALLBACK_MODELS;
    const out: Record<string, Model[]> = {};
    for (const m of list) (out[m.upstreamProvider || 'Other'] ||= []).push(m);
    return out;
  }
};

export function initCatalogStore(): void {
  if (!browser) return;
  hydrate();
  if (status === 'idle' || (fetchedAt && Date.now() - fetchedAt > CACHE_TTL_MS)) {
    queueMicrotask(() => { refreshCatalog(false); });
  }
}
