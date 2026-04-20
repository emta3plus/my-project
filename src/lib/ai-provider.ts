/**
 * Universal AI Provider — MULTI-PROVIDER free tier system.
 *
 * Providers (in priority order):
 *  1. OpenRouter — 24+ free models (50 req/day free, 1000 with $5 credits)
 *  2. Google Gemini — FREE, 1500 req/day, no credit card needed!
 *  3. Groq — FREE, ultra-fast, 14400 req/day
 *
 * Smart fallback: If OpenRouter hits rate limit → auto-switches to Gemini → Groq
 * The user gets essentially UNLIMITED free AI chat across 3 providers!
 *
 * API Keys needed (ALL FREE):
 *  - OPENROUTER_API_KEY: https://openrouter.ai/keys
 *  - GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY: https://aistudio.google.com/apikey
 *  - GROQ_API_KEY: https://console.groq.com/keys
 */

// ── Types ──
export interface ChatCompletionOptions {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message?: { content?: string };
    delta?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: Record<string, number>;
  error?: { code?: string; message?: string };
}

export type AIProvider = 'openrouter' | 'gemini' | 'groq' | 'zai' | 'openai';
export type ModelHint = 'auto' | 'coder';

// ── Verified free models on OpenRouter (April 2026) ──
const OPENROUTER_GENERAL_FREE = [
  'z-ai/glm-4.5-air:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-3-27b-it:free',
  'arcee-ai/trinity-large-preview:free',
  'minimax/minimax-m2.5:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'google/gemma-3-12b-it:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'google/gemma-3-4b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

const OPENROUTER_CODER_FREE = [
  'qwen/qwen3-coder:free',
  'z-ai/glm-4.5-air:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-120b:free',
  'google/gemma-3-27b-it:free',
  'arcee-ai/trinity-large-preview:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
];

// ── Google Gemini free models ──
const GEMINI_MODELS = [
  'gemini-2.5-flash-preview-05-20',   // Newest, best quality
  'gemini-2.0-flash',                  // Fast, reliable
  'gemini-2.0-flash-lite',             // Ultra-fast, lightweight
];

const GEMINI_CODER_MODELS = [
  'gemini-2.5-flash-preview-05-20',   // Best for code
  'gemini-2.0-flash',                  // Fast coding
];

// ── Groq free models ──
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',           // Best Groq model
  'llama-3.1-8b-instant',              // Ultra-fast
  'gemma2-9b-it',                       // Good quality
  'mixtral-8x7b-32768',                // Large context
];

const GROQ_CODER_MODELS = [
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

// ── Provider detection ──
export interface ProviderInfo {
  provider: AIProvider;
  hasKey: boolean;
  apiKey: string;
  baseUrl: string;
}

export function detectAllProviders(): ProviderInfo[] {
  const providers: ProviderInfo[] = [];

  // 1. OpenRouter
  const orKey = process.env.OPENROUTER_API_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith('sk-or-v1-') ? process.env.OPENAI_API_KEY : '');
  if (orKey) {
    if (process.env.OPENAI_API_KEY?.startsWith('sk-or-v1-') && !process.env.OPENROUTER_API_KEY) {
      process.env.OPENROUTER_API_KEY = orKey;
    }
    providers.push({ provider: 'openrouter', hasKey: true, apiKey: orKey, baseUrl: 'https://openrouter.ai/api/v1' });
  }

  // 2. Google Gemini (supports multiple env var names)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    providers.push({ provider: 'gemini', hasKey: true, apiKey: geminiKey, baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' });
  }

  // 3. Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    providers.push({ provider: 'groq', hasKey: true, apiKey: groqKey, baseUrl: 'https://api.groq.com/openai/v1' });
  }

  // 4. OpenAI (for users who have their own key)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && !openaiKey.startsWith('sk-or-v1-')) {
    providers.push({ provider: 'openai', hasKey: true, apiKey: openaiKey, baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' });
  }

  // 5. Z.ai sandbox (only works in Z.ai platform)
  const zaiKey = process.env.ZAI_API_KEY;
  if (zaiKey) {
    const zaiBaseUrl = process.env.ZAI_BASE_URL || '';
    if (zaiBaseUrl.includes('172.') || zaiBaseUrl.includes('localhost') || zaiBaseUrl.includes('127.0.0.1')) {
      providers.push({ provider: 'zai', hasKey: true, apiKey: zaiKey, baseUrl: zaiBaseUrl });
    }
  }

  return providers;
}

// Legacy compat
export function detectProvider(): { provider: AIProvider; hasKey: boolean } {
  const all = detectAllProviders();
  if (all.length > 0) return { provider: all[0].provider, hasKey: true };
  return { provider: 'zai', hasKey: false };
}

// ── OpenAI-compatible chat (works for OpenRouter, Gemini, Groq) ──
async function openAICompatChat(
  apiKey: string,
  baseUrl: string,
  model: string,
  provider: AIProvider,
  options: ChatCompletionOptions,
): Promise<ReadableStream<Uint8Array> | ChatCompletionResponse> {
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // OpenRouter-specific headers
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'https://my-project.vercel.app';
    headers['X-Title'] = 'Personal AI System';
  }

  const body = JSON.stringify({
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 8192,
    stream: options.stream ?? false,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `[${provider}] API error (${response.status})`;
    let retriable = false;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = `[${provider}] ${errorJson.error?.message || errorJson.message || errorJson.error?.code || errorMsg}`;
      if (response.status === 429 || response.status === 404 || response.status === 503) retriable = true;
      if (response.status === 400 && (errorMsg.includes('location') || errorMsg.includes('not available') || errorMsg.includes('context') || errorMsg.includes('token') || errorMsg.includes('too many'))) retriable = true;
      if (errorMsg.includes('Provider returned error') || errorMsg.includes('No endpoints found') || errorMsg.includes('rate limit') || errorMsg.includes('overloaded') || errorMsg.includes('capacity') || errorMsg.includes('exceeded')) retriable = true;
    } catch {
      errorMsg += `: ${errorText.slice(0, 200)}`;
      retriable = response.status >= 500;
    }
    const err = new Error(errorMsg);
    (err as Record<string, unknown>).retriable = retriable;
    (err as Record<string, unknown>).provider = provider;
    throw err;
  }

  if (options.stream && response.body) {
    return response.body;
  }

  return await response.json() as ChatCompletionResponse;
}

// ── Vision ──
async function openAICompatVision(
  apiKey: string,
  baseUrl: string,
  model: string,
  provider: AIProvider,
  options: {
    messages: Array<{
      role: string;
      content: Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }>;
  },
): Promise<ChatCompletionResponse> {
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'https://my-project.vercel.app';
    headers['X-Title'] = 'Personal AI System';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: options.messages, max_tokens: 4096 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  return await response.json() as ChatCompletionResponse;
}

// ── Unified AI Client with MULTI-PROVIDER fallback ──
export class AIClient {
  private providers: ProviderInfo[];
  private zai: InstanceType<typeof import('z-ai-web-dev-sdk').default> | null = null;
  private currentProvider: AIProvider = 'openrouter';
  private currentModel = '';
  private modelHint: ModelHint = 'auto';

  private constructor(providers: ProviderInfo[], hint: ModelHint = 'auto') {
    this.providers = providers;
    this.modelHint = hint;
  }

  static async create(hint: ModelHint = 'auto'): Promise<AIClient> {
    const providers = detectAllProviders();
    const client = new AIClient(providers, hint);

    if (providers.length === 0) {
      throw new Error(
        'No AI providers configured! Set at least one of:\n' +
        '  • GEMINI_API_KEY (FREE — get one at https://aistudio.google.com/apikey)\n' +
        '  • OPENROUTER_API_KEY (free — https://openrouter.ai/keys)\n' +
        '  • GROQ_API_KEY (FREE — https://console.groq.com/keys)'
      );
    }

    // Try to init Z.ai SDK if available
    const zaiProvider = providers.find(p => p.provider === 'zai');
    if (zaiProvider) {
      try {
        const { getZAI } = await import('@/lib/zai');
        client.zai = await getZAI();
      } catch {
        // Z.ai init failed, but other providers are available
      }
    }

    // Set initial provider/model
    const first = providers[0];
    client.currentProvider = first.provider;
    client.currentModel = client.getDefaultModel(first.provider);

    console.log(`[AI Provider] Available: ${providers.map(p => p.provider).join(', ')} | Using: ${client.currentProvider}/${client.currentModel}`);
    return client;
  }

  private getDefaultModel(provider: AIProvider): string {
    if (process.env.OPENROUTER_MODEL && provider === 'openrouter') return process.env.OPENROUTER_MODEL;
    const models = this.getModelsForProvider(provider);
    return models[0] || 'unknown';
  }

  private getModelsForProvider(provider: AIProvider): string[] {
    const hint = this.modelHint;
    switch (provider) {
      case 'openrouter': return hint === 'coder' ? OPENROUTER_CODER_FREE : OPENROUTER_GENERAL_FREE;
      case 'gemini': return hint === 'coder' ? GEMINI_CODER_MODELS : GEMINI_MODELS;
      case 'groq': return hint === 'coder' ? GROQ_CODER_MODELS : GROQ_MODELS;
      case 'openai': return [process.env.OPENAI_MODEL || 'gpt-4o-mini'];
      default: return [];
    }
  }

  get providerName(): string { return this.currentProvider; }
  get modelName(): string { return this.currentModel || 'unknown'; }

  /** Main chat method — tries ALL providers with model fallback within each */
  async chat(options: ChatCompletionOptions): Promise<ReadableStream<Uint8Array> | ChatCompletionResponse> {
    // Z.ai SDK path
    if (this.currentProvider === 'zai' && this.zai) {
      try {
        return await this.zai.chat.completions.create({
          messages: options.messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          stream: options.stream,
        } as Parameters<typeof this.zai.chat.completions.create>[0]);
      } catch (zaiErr) {
        console.warn('[AI Provider] Z.ai failed, falling back to other providers');
      }
    }

    // If user set a specific model, use only that
    if (process.env.OPENROUTER_MODEL) {
      const orProvider = this.providers.find(p => p.provider === 'openrouter');
      if (orProvider) {
        return openAICompatChat(orProvider.apiKey, orProvider.baseUrl, process.env.OPENROUTER_MODEL, 'openrouter', options);
      }
    }

    // Multi-provider fallback: try each provider, with model fallback within each
    const errors: string[] = [];

    for (const providerInfo of this.providers) {
      if (providerInfo.provider === 'zai') continue; // Already tried above

      const models = this.getModelsForProvider(providerInfo.provider);
      console.log(`[AI Provider] Trying ${providerInfo.provider} with ${models.length} models...`);

      for (let m = 0; m < models.length; m++) {
        const model = models[m];
        try {
          console.log(`[AI Provider] → ${providerInfo.provider}/${model} (${m + 1}/${models.length})`);
          const result = await openAICompatChat(
            providerInfo.apiKey,
            providerInfo.baseUrl,
            model,
            providerInfo.provider,
            options,
          );
          this.currentProvider = providerInfo.provider;
          this.currentModel = model;
          console.log(`[AI Provider] ✓ Success: ${providerInfo.provider}/${model}`);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown';
          const isRetriable = (err as Record<string, unknown>)?.retriable === true;
          errors.push(`${providerInfo.provider}/${model}: ${errMsg.slice(0, 80)}`);

          // Auth errors = this provider is done, try next provider
          if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Invalid API key') || errMsg.includes('Authentication')) {
            console.warn(`[AI Provider] Auth error for ${providerInfo.provider}, skipping to next provider`);
            break; // Break model loop, move to next provider
          }

          // Rate limit for this provider = try next model, or next provider if all models fail
          if (isRetriable && m < models.length - 1) {
            await new Promise(r => setTimeout(r, Math.min(300 * (m + 1), 2000)));
            continue;
          }

          // If all models in this provider failed, try next provider
          if (m === models.length - 1) {
            console.warn(`[AI Provider] All ${models.length} models failed for ${providerInfo.provider}`);
          }
        }
      }
    }

    // All providers and models failed
    throw new Error(
      `All providers exhausted. Errors:\n${errors.slice(0, 5).join('\n')}\n\n` +
      `To fix: Add more free API keys on Vercel:\n` +
      `• GEMINI_API_KEY — FREE, 1500 req/day! → https://aistudio.google.com/apikey\n` +
      `• GROQ_API_KEY — FREE, ultra-fast → https://console.groq.com/keys`
    );
  }

  /** Vision chat completion */
  async vision(options: {
    messages: Array<{
      role: string;
      content: Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }>;
  }): Promise<ChatCompletionResponse> {
    if (this.zai) {
      return this.zai.chat.completions.createVision({
        messages: options.messages as Parameters<typeof this.zai.chat.completions.createVision>[0]['messages'],
        thinking: { type: 'disabled' },
      });
    }

    const provider = this.providers.find(p => p.provider === 'openrouter') || this.providers[0];
    const visionModel = provider.provider === 'openrouter'
      ? 'nvidia/nemotron-nano-12b-v2-vl:free'
      : this.currentModel;

    return openAICompatVision(provider.apiKey, provider.baseUrl, visionModel, provider.provider, options);
  }

  /** Image generation */
  async imageGeneration(options: { prompt: string; size?: string }): Promise<{ data: Array<{ base64?: string; url?: string }> }> {
    if (this.zai) {
      return this.zai.images.generations.create({ prompt: options.prompt, size: options.size || '1024x1024' });
    }
    throw new Error('Image generation requires Z.ai API key.');
  }

  /** TTS */
  async tts(options: { text: string }): Promise<Response> {
    if (this.zai) return this.zai.audio.tts.create({ input: options.text });
    throw new Error('TTS requires Z.ai API key.');
  }

  /** Web search */
  async webSearch(options: { query: string; num?: number }): Promise<unknown> {
    if (this.zai) return this.zai.functions.invoke('web_search', { query: options.query, num: options.num || 10 });
    throw new Error('Web search requires Z.ai API key.');
  }
}
