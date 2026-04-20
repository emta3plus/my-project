/**
 * Universal AI Provider — Z.ai FIRST, then multi-provider fallback.
 *
 * Priority order:
 *  1. Z.ai SDK — FREE, unlimited, GLM-4-plus (works in sandbox)
 *  2. Google Gemini — FREE, 1500 req/day
 *  3. OpenRouter — 24+ free models (50-1000 req/day)
 *  4. Groq — FREE, ultra-fast, 14400 req/day
 *
 * The Z.ai SDK works in the sandbox environment (internal IP).
 * On Vercel, it falls back to Gemini → OpenRouter → Groq.
 *
 * API Keys (ALL FREE):
 *  - Z.ai: Auto-detected from /etc/.z-ai-config (sandbox) or ZAI_API_KEY
 *  - GEMINI_API_KEY: https://aistudio.google.com/apikey (FREE, 1500/day!)
 *  - OPENROUTER_API_KEY: https://openrouter.ai/keys (free, 50/day)
 *  - GROQ_API_KEY: https://console.groq.com/keys (FREE)
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

export type AIProvider = 'zai' | 'gemini' | 'openrouter' | 'groq' | 'openai';
export type ModelHint = 'auto' | 'coder';

// ── Provider info ──
export interface ProviderInfo {
  provider: AIProvider;
  hasKey: boolean;
  apiKey: string;
  baseUrl: string;
  models: string[];
}

// ── Free models per provider ──
const ZAI_MODELS = ['glm-4-plus', 'glm-4-flash', 'glm-4-long'];

const GEMINI_MODELS = [
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

const GEMINI_CODER_MODELS = [
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash',
];

const OPENROUTER_GENERAL_FREE = [
  'z-ai/glm-4.5-air:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  'google/gemma-3-27b-it:free',
  'arcee-ai/trinity-large-preview:free',
  'minimax/minimax-m2.5:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'google/gemma-3-12b-it:free',
  'nvidia/nemotron-nano-9b-v2:free',
];

const OPENROUTER_CODER_FREE = [
  'qwen/qwen3-coder:free',
  'z-ai/glm-4.5-air:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-120b:free',
  'google/gemma-3-27b-it:free',
];

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
];

const GROQ_CODER_MODELS = [
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

// ── Detect all available providers ──
export function detectAllProviders(hint: ModelHint = 'auto'): ProviderInfo[] {
  const providers: ProviderInfo[] = [];

  // 1. Z.ai SDK (sandbox or public API)
  const zaiKey = process.env.ZAI_API_KEY;
  const zaiBaseUrl = process.env.ZAI_BASE_URL;
  if (zaiKey && zaiBaseUrl) {
    // Only use Z.ai if base URL is reachable (internal or public)
    providers.push({
      provider: 'zai',
      hasKey: true,
      apiKey: zaiKey,
      baseUrl: zaiBaseUrl,
      models: ZAI_MODELS,
    });
  }

  // 2. Google Gemini (FREE, 1500 req/day!)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    providers.push({
      provider: 'gemini',
      hasKey: true,
      apiKey: geminiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: hint === 'coder' ? GEMINI_CODER_MODELS : GEMINI_MODELS,
    });
  }

  // 3. OpenRouter
  const orKey = process.env.OPENROUTER_API_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith('sk-or-v1-') ? process.env.OPENAI_API_KEY : '');
  if (orKey) {
    if (process.env.OPENAI_API_KEY?.startsWith('sk-or-v1-') && !process.env.OPENROUTER_API_KEY) {
      process.env.OPENROUTER_API_KEY = orKey;
    }
    providers.push({
      provider: 'openrouter',
      hasKey: true,
      apiKey: orKey,
      baseUrl: 'https://openrouter.ai/api/v1',
      models: hint === 'coder' ? OPENROUTER_CODER_FREE : OPENROUTER_GENERAL_FREE,
    });
  }

  // 4. Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    providers.push({
      provider: 'groq',
      hasKey: true,
      apiKey: groqKey,
      baseUrl: 'https://api.groq.com/openai/v1',
      models: hint === 'coder' ? GROQ_CODER_MODELS : GROQ_MODELS,
    });
  }

  return providers;
}

// Legacy compat
export function detectProvider(): { provider: AIProvider; hasKey: boolean } {
  const all = detectAllProviders();
  if (all.length > 0) return { provider: all[0].provider, hasKey: true };
  return { provider: 'zai', hasKey: false };
}

// ── OpenAI-compatible chat (Gemini, OpenRouter, Groq) ──
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
    let errorMsg = `[${provider}/${model}] API error (${response.status})`;
    let retriable = false;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = `[${provider}/${model}] ${errorJson.error?.message || errorJson.message || errorJson.error?.code || errorMsg}`;
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

// ── Unified AI Client ──
export class AIClient {
  private providers: ProviderInfo[];
  private zai: InstanceType<typeof import('z-ai-web-dev-sdk').default> | null = null;
  private currentProvider: AIProvider = 'zai';
  private currentModel = 'glm-4-plus';
  private modelHint: ModelHint = 'auto';

  private constructor(providers: ProviderInfo[], hint: ModelHint = 'auto') {
    this.providers = providers;
    this.modelHint = hint;
  }

  static async create(hint: ModelHint = 'auto'): Promise<AIClient> {
    const providers = detectAllProviders(hint);
    const client = new AIClient(providers, hint);

    // Try to init Z.ai SDK first (if available)
    try {
      const { getZAI } = await import('@/lib/zai');
      client.zai = await getZAI();
      client.currentProvider = 'zai';
      client.currentModel = 'glm-4-plus';
      console.log(`[AI Provider] Z.ai SDK initialized (GLM-4-plus, FREE, unlimited)`);
    } catch {
      // Z.ai SDK not available (Vercel or no config) — use other providers
    }

    if (providers.length === 0 && !client.zai) {
      throw new Error(
        'No AI providers configured! Set at least one FREE API key:\n' +
        '  • GEMINI_API_KEY — FREE, 1500 req/day → https://aistudio.google.com/apikey\n' +
        '  • OPENROUTER_API_KEY — Free → https://openrouter.ai/keys\n' +
        '  • GROQ_API_KEY — FREE → https://console.groq.com/keys'
      );
    }

    // Set initial provider/model (skip Z.ai if SDK already init'd)
    if (!client.zai && providers.length > 0) {
      const first = providers[0];
      client.currentProvider = first.provider;
      client.currentModel = first.models[0] || 'unknown';
    }

    const providerList = [
      client.zai ? 'zai-sdk(GLM-4-plus)' : null,
      ...providers.filter(p => p.provider !== 'zai').map(p => p.provider),
    ].filter(Boolean).join(' → ');

    console.log(`[AI Provider] Fallback chain: ${providerList}`);
    return client;
  }

  get providerName(): string { return this.currentProvider; }
  get modelName(): string { return this.currentModel; }
  get isZai(): boolean { return this.currentProvider === 'zai' && !!this.zai; }

  /** Main chat with multi-provider fallback */
  async chat(options: ChatCompletionOptions): Promise<ReadableStream<Uint8Array> | ChatCompletionResponse> {
    // ── Try Z.ai SDK first (FREE, unlimited, best quality) ──
    if (this.zai) {
      try {
        const result = await this.zai.chat.completions.create({
          messages: options.messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
          temperature: options.temperature,
          max_tokens: options.max_tokens || 8192,
          stream: false, // Z.ai SDK doesn't stream well, use non-streaming
        } as Parameters<typeof this.zai.chat.completions.create>[0]);
        this.currentProvider = 'zai';
        this.currentModel = 'glm-4-plus';
        console.log('[AI Provider] ✓ Z.ai SDK (GLM-4-plus, FREE)');
        return result as ChatCompletionResponse;
      } catch (zaiErr) {
        const msg = zaiErr instanceof Error ? zaiErr.message : 'Unknown';
        console.warn(`[AI Provider] Z.ai SDK failed: ${msg.slice(0, 100)}`);
        // Fall through to other providers
      }
    }

    // ── Try other providers with model fallback within each ──
    if (process.env.OPENROUTER_MODEL) {
      const orProvider = this.providers.find(p => p.provider === 'openrouter');
      if (orProvider) {
        try {
          const result = await openAICompatChat(orProvider.apiKey, orProvider.baseUrl, process.env.OPENROUTER_MODEL, 'openrouter', options);
          this.currentProvider = 'openrouter';
          this.currentModel = process.env.OPENROUTER_MODEL;
          return result;
        } catch { /* fall through */ }
      }
    }

    const errors: string[] = [];

    for (const providerInfo of this.providers) {
      if (providerInfo.provider === 'zai') continue; // Already tried above

      for (let m = 0; m < providerInfo.models.length; m++) {
        const model = providerInfo.models[m];
        try {
          console.log(`[AI Provider] → ${providerInfo.provider}/${model}`);
          const result = await openAICompatChat(
            providerInfo.apiKey,
            providerInfo.baseUrl,
            model,
            providerInfo.provider,
            options,
          );
          this.currentProvider = providerInfo.provider;
          this.currentModel = model;
          console.log(`[AI Provider] ✓ ${providerInfo.provider}/${model}`);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown';
          const isRetriable = (err as Record<string, unknown>)?.retriable === true;
          errors.push(errMsg.slice(0, 100));

          // Auth errors = skip this entire provider
          if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Invalid API key') || errMsg.includes('Authentication')) {
            break;
          }

          if (isRetriable && m < providerInfo.models.length - 1) {
            await new Promise(r => setTimeout(r, Math.min(300 * (m + 1), 2000)));
            continue;
          }
        }
      }
    }

    throw new Error(
      `All providers exhausted. Errors:\n${errors.slice(0, 5).join('\n')}\n\n` +
      `To get FREE unlimited AI, add these keys on Vercel:\n` +
      `• GEMINI_API_KEY — FREE, 1500 req/day! → https://aistudio.google.com/apikey\n` +
      `• GROQ_API_KEY — FREE → https://console.groq.com/keys`
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
      try {
        return await this.zai.chat.completions.createVision({
          messages: options.messages as Parameters<typeof this.zai.chat.completions.createVision>[0]['messages'],
          thinking: { type: 'disabled' },
        });
      } catch { /* fall through */ }
    }

    const provider = this.providers.find(p => p.provider === 'openrouter') || this.providers[0];
    if (!provider) throw new Error('No providers available for vision');
    const visionModel = provider.provider === 'openrouter' ? 'nvidia/nemotron-nano-12b-v2-vl:free' : provider.models[0];
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
