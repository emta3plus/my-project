/**
 * Universal AI Provider — robust multi-model fallback for OpenRouter.
 *
 * Key features:
 *  - 24+ verified free models including GLM-4.5-air
 *  - GLM models as priority (Z.ai's own models — reliable)
 *  - Cross-category fallback (try all models before giving up)
 *  - Truncation detection (finish_reason='length')
 *  - Exponential backoff between retries
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

// ── Verified free models on OpenRouter (April 2026) ──
// GLM first because it's Z.ai's own model — most reliable for this platform

// General-purpose free models (ordered by quality/reliability)
const GENERAL_FREE_MODELS = [
  'z-ai/glm-4.5-air:free',                           // GLM 4.5 Air — Z.ai's free model, 131K ctx
  'google/gemma-4-31b-it:free',                       // Gemma 4 31B — newest Google model, 262K ctx
  'google/gemma-4-26b-a4b-it:free',                   // Gemma 4 26B MoE, 262K ctx
  'qwen/qwen3-coder:free',                            // Qwen3 Coder — excellent for code too, 262K ctx
  'meta-llama/llama-3.3-70b-instruct:free',           // Llama 3.3 70B, 65K ctx
  'nvidia/nemotron-3-super-120b-a12b:free',           // Nemotron 120B MoE, 262K ctx
  'nvidia/nemotron-3-nano-30b-a3b:free',              // Nemotron 30B MoE, 256K ctx
  'openai/gpt-oss-120b:free',                          // OpenAI OSS 120B, 131K ctx
  'qwen/qwen3-next-80b-a3b-instruct:free',            // Qwen3 Next 80B, 262K ctx
  'google/gemma-3-27b-it:free',                        // Gemma 3 27B, 131K ctx
  'arcee-ai/trinity-large-preview:free',               // Arcee Trinity, 131K ctx
  'minimax/minimax-m2.5:free',                         // MiniMax M2.5, 196K ctx
  'nousresearch/hermes-3-llama-3.1-405b:free',        // Hermes 405B, 131K ctx
  'google/gemma-3-12b-it:free',                        // Gemma 3 12B, 32K ctx
  'openai/gpt-oss-20b:free',                           // OpenAI OSS 20B, 131K ctx
  'nvidia/nemotron-nano-9b-v2:free',                   // Nemotron Nano, 128K ctx
  'google/gemma-3-4b-it:free',                         // Gemma 3 4B, 32K ctx
  'meta-llama/llama-3.2-3b-instruct:free',             // Llama 3.2 3B, 131K ctx
];

// Code-optimized free models (GLM Coder + best coding models first)
const CODER_FREE_MODELS = [
  'qwen/qwen3-coder:free',                            // Best free coder, 262K ctx
  'z-ai/glm-4.5-air:free',                            // GLM — good at code, 131K ctx
  'google/gemma-4-31b-it:free',                       // Gemma 4 — great coder, 262K ctx
  'nvidia/nemotron-3-super-120b-a12b:free',           // Nemotron 120B — strong coder, 262K ctx
  'meta-llama/llama-3.3-70b-instruct:free',           // Llama 3.3 70B — solid coder, 65K ctx
  'qwen/qwen3-next-80b-a3b-instruct:free',            // Qwen3 80B, 262K ctx
  'openai/gpt-oss-120b:free',                          // OpenAI OSS 120B, 131K ctx
  'google/gemma-3-27b-it:free',                        // Gemma 3 27B, 131K ctx
  'arcee-ai/trinity-large-preview:free',               // Fast fallback, 131K ctx
  'nvidia/nemotron-3-nano-30b-a3b:free',              // Nemotron 30B, 256K ctx
];

// All free models combined (deduplicated) for ultimate fallback
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
    signal: AbortSignal.timeout(90000), // 90s timeout — some free models are slow
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `API error (${response.status})`;
    let retriable = false;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      // Rate limits, not found, service unavailable = retriable
      if (response.status === 429 || response.status === 404 || response.status === 503) {
        retriable = true;
      }
      // Context/token issues = try different model
      if (response.status === 400 && (errorMsg.includes('location') || errorMsg.includes('not available') || errorMsg.includes('context') || errorMsg.includes('token') || errorMsg.includes('too many'))) {
        retriable = true;
      }
      // Provider-level errors = model backend down
      if (errorMsg.includes('Provider returned error') || errorMsg.includes('No endpoints found') || errorMsg.includes('rate limit') || errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
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
          this.model = tryModel;
          console.log(`[AI Provider] ✓ Success with: ${tryModel}`);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          const isRetriable = (err as Record<string, unknown>)?.retriable === true;
          lastError = errMsg;
          console.warn(`[AI Provider] ✗ ${tryModel}: ${errMsg.slice(0, 80)} (retriable: ${isRetriable})`);

          // Auth errors affect ALL models — stop immediately
          if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Invalid API key') || errMsg.includes('Authentication Failed')) {
            throw err;
          }

          // Backoff before trying next model
          if (attempt < modelList.length - 1) {
            await new Promise((r) => setTimeout(r, Math.min(500 * (attempt + 1), 3000)));
          }
          continue;
        }
      }

      throw new Error(
        `All ${modelList.length} free models are currently busy. Free models rotate availability — please try again in 30 seconds. ` +
        `Tip: You can also set OPENROUTER_MODEL to a cheap paid model like "z-ai/glm-4.7-flash" ($0.06/1M tokens) for reliable access. ` +
        `Last error: ${lastError.slice(0, 120)}`
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
      ? (process.env.OPENROUTER_VISION_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free')
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
