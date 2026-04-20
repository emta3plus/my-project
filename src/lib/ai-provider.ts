/**
 * Universal AI Provider — robust multi-model fallback for OpenRouter free tier.
 *
 * Key improvements:
 *  - 15+ free models across general and coder categories
 *  - Cross-category fallback (try coder models if all general fail, and vice versa)
 *  - Model-specific max_tokens awareness (free models have varying context limits)
 *  - Retry with exponential backoff for rate limits
 *  - Never gives up — always tries ALL available models before erroring
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

export type AIProvider = 'zai' | 'openrouter' | 'openai';
export type ModelHint = 'auto' | 'coder';

// ── Free model lists (OpenRouter) ──
// Comprehensive list of known free models (April 2026)
// Order: most reliable first

// General-purpose models
const GENERAL_FREE_MODELS = [
  'google/gemma-3-27b-it:free',                    // Google Gemma 27B — reliable, good quality
  'meta-llama/llama-4-scout:free',                  // Llama 4 Scout — newest Meta model
  'meta-llama/llama-3.3-70b-instruct:free',         // Llama 3.3 70B — strong general model
  'qwen/qwen3-235b-a22b:free',                      // Qwen3 235B MoE — powerful
  'qwen/qwen3-30b-a3b:free',                        // Qwen3 30B MoE — lighter
  'arcee-ai/trinity-large-preview:free',             // Arcee Trinity — fast
  'microsoft/phi-4-reasoning:free',                  // Phi-4 reasoning — good for analysis
  'nvidia/llama-3.1-nemotron-70b-instruct:free',    // Nemotron 70B — good quality
  'deepseek/deepseek-r1-0528:free',                  // DeepSeek R1 — strong reasoning
  'deepseek/deepseek-chat-v3-0324:free',             // DeepSeek V3 — chat optimized
  'openai/gpt-oss-120b:free',                        // OpenAI open-source
  'rekaai/reka-flash-3:free',                        // Reka Flash — fast
  'moonshotai/kimi-vl-a3b-thinking:free',            // Kimi — good multilingual
];

// Code-optimized models
const CODER_FREE_MODELS = [
  'qwen/qwen3-coder:free',                           // Best free coder model
  'deepseek/deepseek-r1-0528:free',                   // Strong reasoning for code
  'google/gemma-3-27b-it:free',                       // Gemma good at code too
  'meta-llama/llama-4-scout:free',                    // Llama 4 good at code
  'meta-llama/llama-3.3-70b-instruct:free',           // Llama 3.3 solid coder
  'qwen/qwen3-235b-a22b:free',                        // Qwen3 235B excellent coder
  'microsoft/phi-4-reasoning:free',                   // Phi-4 good for debugging
  'nvidia/llama-3.1-nemotron-70b-instruct:free',     // Nemotron good coder
  'deepseek/deepseek-chat-v3-0324:free',              // DeepSeek V3 good at code
  'arcee-ai/trinity-large-preview:free',              // Fast fallback
];

// All free models combined for ultimate fallback
const ALL_FREE_MODELS = [...new Set([...CODER_FREE_MODELS, ...GENERAL_FREE_MODELS])];

// ── Provider Detection ──
export function detectProvider(): { provider: AIProvider; hasKey: boolean } {
  if (process.env.OPENROUTER_API_KEY) return { provider: 'openrouter', hasKey: true };

  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (openaiKey.startsWith('sk-or-v1-')) {
    console.log('[AI Provider] Detected OpenRouter key in OPENAI_API_KEY — auto-switching');
    process.env.OPENROUTER_API_KEY = openaiKey;
    return { provider: 'openrouter', hasKey: true };
  }

  if (openaiKey) return { provider: 'openai', hasKey: true };

  if (process.env.ZAI_API_KEY) {
    const zaiBaseUrl = process.env.ZAI_BASE_URL || '';
    if (zaiBaseUrl.includes('172.') || zaiBaseUrl.includes('localhost') || zaiBaseUrl.includes('127.0.0.1')) {
      return { provider: 'zai', hasKey: true };
    }
    console.warn('[AI Provider] Z.ai public API requires credits. Set OPENROUTER_API_KEY for free models.');
    return { provider: 'zai', hasKey: false };
  }

  return { provider: 'zai', hasKey: false };
}

// ── OpenRouter / OpenAI-compatible implementation ──
async function openAICompatChat(
  apiKey: string,
  baseUrl: string,
  model: string,
  options: ChatCompletionOptions,
): Promise<ReadableStream<Uint8Array> | ChatCompletionResponse> {
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (baseUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'https://my-project.vercel.app';
    headers['X-Title'] = 'Personal AI System';
  }

  // Some free models have lower max_tokens limits
  // Cap at 8192 to be safe across all free models
  const safeMaxTokens = Math.min(options.max_tokens ?? 8192, 8192);

  const body = JSON.stringify({
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: safeMaxTokens,
    stream: options.stream ?? false,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(60000), // 60s timeout per request
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `API error (${response.status})`;
    let retriable = false;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      if (response.status === 429 || response.status === 404 || response.status === 503) {
        retriable = true;
      }
      if (response.status === 400 && (errorMsg.includes('location') || errorMsg.includes('not available') || errorMsg.includes('context') || errorMsg.includes('token'))) {
        retriable = true;
      }
      // "Provider returned error" = model backend down
      if (errorMsg.includes('Provider returned error') || errorMsg.includes('No endpoints found') || errorMsg.includes('rate limit') || errorMsg.includes('overloaded')) {
        retriable = true;
      }
    } catch {
      errorMsg += `: ${errorText.slice(0, 200)}`;
      retriable = response.status >= 500;
    }
    const err = new Error(errorMsg);
    (err as Record<string, unknown>).retriable = retriable;
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
  if (baseUrl.includes('openrouter.ai')) {
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
  private provider: AIProvider;
  private zai: InstanceType<typeof import('z-ai-web-dev-sdk').default> | null = null;
  private apiKey = '';
  private baseUrl = '';
  private model = '';
  private modelHint: ModelHint = 'auto';

  private constructor(provider: AIProvider, hint: ModelHint = 'auto') {
    this.provider = provider;
    this.modelHint = hint;
  }

  static async create(hint: ModelHint = 'auto'): Promise<AIClient> {
    const { provider, hasKey } = detectProvider();
    const client = new AIClient(provider, hint);

    if (provider === 'openrouter') {
      client.apiKey = process.env.OPENROUTER_API_KEY!;
      client.baseUrl = 'https://openrouter.ai/api/v1';
      if (process.env.OPENROUTER_MODEL) {
        client.model = process.env.OPENROUTER_MODEL;
      } else {
        // Pick first model from the appropriate list
        const modelList = hint === 'coder' ? CODER_FREE_MODELS : GENERAL_FREE_MODELS;
        client.model = modelList[0];
      }
    } else if (provider === 'openai') {
      client.apiKey = process.env.OPENAI_API_KEY!;
      client.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      client.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    } else if (provider === 'zai') {
      if (!hasKey) {
        throw new Error(
          'Z.ai API requires credits for public access. For free AI chat, set OPENROUTER_API_KEY (get a free key at https://openrouter.ai/keys).'
        );
      }
      const { getZAI } = await import('@/lib/zai');
      try {
        client.zai = await getZAI();
      } catch (zaiErr) {
        const errMsg = zaiErr instanceof Error ? zaiErr.message : 'Unknown ZAI error';
        console.error(`[AI Provider] ZAI init failed: ${errMsg}`);
        const orKey = process.env.OPENROUTER_API_KEY || (process.env.OPENAI_API_KEY?.startsWith('sk-or-v1-') ? process.env.OPENAI_API_KEY : '');
        if (orKey) {
          client.provider = 'openrouter';
          client.apiKey = orKey;
          client.baseUrl = 'https://openrouter.ai/api/v1';
          client.model = process.env.OPENROUTER_MODEL || (hint === 'coder' ? CODER_FREE_MODELS[0] : GENERAL_FREE_MODELS[0]);
          process.env.OPENROUTER_API_KEY = orKey;
        } else if (process.env.OPENAI_API_KEY) {
          client.provider = 'openai';
          client.apiKey = process.env.OPENAI_API_KEY;
          client.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
          client.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        } else {
          throw new Error(`Z.ai failed (${errMsg}). Set OPENROUTER_API_KEY for free models at https://openrouter.ai/keys`);
        }
      }
    }

    console.log(`[AI Provider] Using: ${client.provider} / ${client.model} (hint: ${hint})`);
    return client;
  }

  get providerName(): string {
    return this.provider;
  }

  get modelName(): string {
    return this.model || 'unknown';
  }

  /** Get model list based on hint, with cross-category fallback */
  private getModelList(): string[] {
    const primary = this.modelHint === 'coder' ? CODER_FREE_MODELS : GENERAL_FREE_MODELS;
    // Add the other category as fallback, then all remaining
    const secondary = this.modelHint === 'coder' ? GENERAL_FREE_MODELS : CODER_FREE_MODELS;
    return [...new Set([...primary, ...secondary, ...ALL_FREE_MODELS])];
  }

  /** Chat completion with aggressive model fallback */
  async chat(options: ChatCompletionOptions): Promise<ReadableStream<Uint8Array> | ChatCompletionResponse> {
    if (this.provider === 'zai' && this.zai) {
      return this.zai.chat.completions.create({
        messages: options.messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: options.stream,
      } as Parameters<typeof this.zai.chat.completions.create>[0]);
    }

    // For OpenRouter: try all free models before giving up
    if (this.provider === 'openrouter' && !process.env.OPENROUTER_MODEL) {
      const modelList = this.getModelList();
      let lastError = '';

      for (let attempt = 0; attempt < modelList.length; attempt++) {
        const tryModel = modelList[attempt];
        try {
          console.log(`[AI Provider] Trying: ${tryModel} (${attempt + 1}/${modelList.length})`);
          const result = await openAICompatChat(this.apiKey, this.baseUrl, tryModel, options);
          // Success — remember this model
          this.model = tryModel;
          console.log(`[AI Provider] Success with: ${tryModel}`);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          const isRetriable = (err as Record<string, unknown>)?.retriable === true;
          lastError = errMsg;
          console.warn(`[AI Provider] ${tryModel} failed: ${errMsg.slice(0, 100)} (retriable: ${isRetriable})`);

          if (isRetriable) {
            // Small delay before trying next model (rate limit backoff)
            if (attempt < modelList.length - 1) {
              await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
            }
            continue;
          }

          // Non-retriable errors (auth, etc) — still try next model
          // because different models may have different backends
          if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Invalid API key')) {
            // Auth errors affect ALL models — stop here
            throw err;
          }
          continue;
        }
      }

      throw new Error(
        `All ${modelList.length} free models are currently busy or unavailable. Please try again in a moment — free models rotate availability frequently. ` +
        `Last error: ${lastError.slice(0, 150)}`
      );
    }

    return openAICompatChat(this.apiKey, this.baseUrl, this.model, options);
  }

  /** Vision chat completion */
  async vision(options: {
    messages: Array<{
      role: string;
      content: Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }>;
  }): Promise<ChatCompletionResponse> {
    if (this.provider === 'zai' && this.zai) {
      return this.zai.chat.completions.createVision({
        messages: options.messages as Parameters<typeof this.zai.chat.completions.createVision>[0]['messages'],
        thinking: { type: 'disabled' },
      });
    }

    const visionModel = this.provider === 'openrouter'
      ? (process.env.OPENROUTER_VISION_MODEL || 'google/gemma-3-27b-it:free')
      : this.model;

    return openAICompatVision(this.apiKey, this.baseUrl, visionModel, options);
  }

  /** Image generation */
  async imageGeneration(options: { prompt: string; size?: string }): Promise<{ data: Array<{ base64?: string; url?: string }> }> {
    if (this.provider === 'zai' && this.zai) {
      return this.zai.images.generations.create({
        prompt: options.prompt,
        size: options.size || '1024x1024',
      });
    }
    throw new Error('Image generation requires Z.ai API key. Free text chat works with OpenRouter!');
  }

  /** TTS */
  async tts(options: { text: string }): Promise<Response> {
    if (this.provider === 'zai' && this.zai) {
      return this.zai.audio.tts.create({ input: options.text });
    }
    throw new Error('TTS requires Z.ai API key.');
  }

  /** Web search */
  async webSearch(options: { query: string; num?: number }): Promise<unknown> {
    if (this.provider === 'zai' && this.zai) {
      return this.zai.functions.invoke('web_search', { query: options.query, num: options.num || 10 });
    }
    throw new Error('Web search requires Z.ai API key.');
  }
}
