/**
 * Universal AI Provider — supports multiple AI APIs with a single interface.
 *
 * Priority order (OPENROUTER first since Z.ai public API requires credits):
 *  1. OPENROUTER_API_KEY env var → OpenRouter (free models available!)
 *  2. OPENAI_API_KEY env var → OpenAI or any OpenAI-compatible API
 *  3. ZAI_API_KEY env var → Z.ai SDK (only works in sandbox or with credits)
 *  4. Config file (.z-ai-config) → Z.ai SDK fallback
 *
 * OpenRouter has free models: https://openrouter.ai/models?q=free
 * Get a free key at: https://openrouter.ai/keys
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

// ── Free model fallback list (OpenRouter) ──
// Tested and verified to work (April 2026)
// "openrouter/free" auto-routes to available models — most reliable
const OPENROUTER_FREE_MODELS = [
  'openrouter/free',                                 // Auto-route to best available free model
  'arcee-ai/trinity-large-preview:free',             // Fast, reliable
  'openai/gpt-oss-120b:free',                        // OpenAI open-source model
  'meta-llama/llama-3.3-70b-instruct:free',          // May be rate-limited at times
  'qwen/qwen3-coder:free',                           // Good for code
];

// ── Provider Detection ──
// Priority: OpenRouter (free) > OpenAI > Z.ai (needs credits)
// Auto-detect OpenRouter keys even if put in OPENAI_API_KEY field
export function detectProvider(): { provider: AIProvider; hasKey: boolean } {
  if (process.env.OPENROUTER_API_KEY) return { provider: 'openrouter', hasKey: true };
  
  // Auto-detect: if OPENAI_API_KEY starts with "sk-or-v1-" it's actually an OpenRouter key
  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (openaiKey.startsWith('sk-or-v1-')) {
    console.log('[AI Provider] Detected OpenRouter key in OPENAI_API_KEY — auto-switching to OpenRouter');
    // Move it to the right env var for this process
    process.env.OPENROUTER_API_KEY = openaiKey;
    return { provider: 'openrouter', hasKey: true };
  }
  
  if (openaiKey) return { provider: 'openai', hasKey: true };
  if (process.env.ZAI_API_KEY) return { provider: 'zai', hasKey: true };
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

  // OpenRouter recommends these headers for identification
  if (baseUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'https://my-project.vercel.app';
    headers['X-Title'] = 'Personal AI System';
  }

  const body = JSON.stringify({
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 4096,
    stream: options.stream ?? false,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `API error (${response.status})`;
    let retriable = false;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      // 429 (rate limit) and 404 (model not found) are retriable with a different model
      // "Provider returned error" with 429 = rate limited, try next model
      if (response.status === 429 || response.status === 404) {
        retriable = true;
      }
      // Also treat 400 with "location not supported" as retriable
      if (response.status === 400 && errorMsg.includes('location')) {
        retriable = true;
      }
    } catch {
      errorMsg += `: ${errorText.slice(0, 200)}`;
      retriable = response.status >= 500; // Server errors might be temporary
    }
    const err = new Error(errorMsg);
    (err as Record<string, unknown>).retriable = retriable;
    throw err;
  }

  // Streaming: return the raw body for the caller to parse
  if (options.stream && response.body) {
    return response.body;
  }

  // Non-streaming: parse and return JSON
  return await response.json() as ChatCompletionResponse;
}

// ── Vision (OpenRouter/OpenAI compatible) ──
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
  private modelIndex = 0; // For free model fallback

  private constructor(provider: AIProvider) {
    this.provider = provider;
  }

  static async create(): Promise<AIClient> {
    const { provider } = detectProvider();
    const client = new AIClient(provider);

    if (provider === 'openrouter') {
      client.apiKey = process.env.OPENROUTER_API_KEY!;
      client.baseUrl = 'https://openrouter.ai/api/v1';
      // User can override with OPENROUTER_MODEL, otherwise use first free model
      client.model = process.env.OPENROUTER_MODEL || OPENROUTER_FREE_MODELS[0];
    } else if (provider === 'openai') {
      client.apiKey = process.env.OPENAI_API_KEY!;
      client.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      client.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    } else if (provider === 'zai') {
      const { getZAI } = await import('@/lib/zai');
      try {
        client.zai = await getZAI();
      } catch {
        // Z.ai SDK failed — try OpenRouter fallback
        if (process.env.OPENROUTER_API_KEY) {
          client.provider = 'openrouter';
          client.apiKey = process.env.OPENROUTER_API_KEY;
          client.baseUrl = 'https://openrouter.ai/api/v1';
          client.model = process.env.OPENROUTER_MODEL || OPENROUTER_FREE_MODELS[0];
        } else if (process.env.OPENAI_API_KEY) {
          client.provider = 'openai';
          client.apiKey = process.env.OPENAI_API_KEY;
          client.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
          client.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        } else {
          throw new Error(
            'No AI provider configured. Set one of:\n' +
            '  - OPENROUTER_API_KEY (free models! Get one at https://openrouter.ai/keys)\n' +
            '  - OPENAI_API_KEY (OpenAI or compatible API)\n' +
            '  - ZAI_API_KEY (Z.ai platform)'
          );
        }
      }
    }

    console.log(`[AI Provider] Using: ${client.provider} / ${client.model || 'glm'}`);
    return client;
  }

  get providerName(): string {
    return this.provider;
  }

  get modelName(): string {
    return this.model || 'glm';
  }

  /** Chat completion — streaming or non-streaming, with automatic model fallback for free tier */
  async chat(options: ChatCompletionOptions): Promise<ReadableStream<Uint8Array> | ChatCompletionResponse> {
    if (this.provider === 'zai' && this.zai) {
      return this.zai.chat.completions.create({
        messages: options.messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: options.stream,
      } as Parameters<typeof this.zai.chat.completions.create>[0]);
    }

    // For OpenRouter free models: try fallback models if primary fails
    if (this.provider === 'openrouter' && !process.env.OPENROUTER_MODEL) {
      const startIndex = this.modelIndex;
      for (let attempt = 0; attempt < OPENROUTER_FREE_MODELS.length; attempt++) {
        const idx = (startIndex + attempt) % OPENROUTER_FREE_MODELS.length;
        const tryModel = OPENROUTER_FREE_MODELS[idx];
        try {
          console.log(`[AI Provider] Trying model: ${tryModel} (attempt ${attempt + 1})`);
          const result = await openAICompatChat(this.apiKey, this.baseUrl, tryModel, options);
          // Success — remember this model for next time
          this.model = tryModel;
          this.modelIndex = idx;
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          const isRetriable = (err as Record<string, unknown>)?.retriable === true;
          console.warn(`[AI Provider] Model ${tryModel} failed: ${errMsg} (retriable: ${isRetriable})`);
          // If the error is retriable (rate limit, model not found, etc.), try next model
          if (isRetriable || errMsg.includes('Provider returned error') || errMsg.includes('rate limit') || errMsg.includes('No endpoints found')) {
            continue;
          }
          // For auth errors (401/403) or other non-retriable issues, don't retry
          throw err;
        }
      }
      throw new Error('All free models are currently unavailable. Please try again later or set OPENROUTER_MODEL to a specific paid model.');
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
