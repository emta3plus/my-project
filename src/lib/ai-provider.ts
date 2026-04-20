/**
 * Universal AI Provider — supports multiple AI APIs with a single interface.
 *
 * Priority order:
 *  1. ZAI_API_KEY env var → Z.ai SDK (internal sandbox or public API)
 *  2. OPENROUTER_API_KEY env var → OpenRouter (free models available!)
 *  3. OPENAI_API_KEY env var → OpenAI or any OpenAI-compatible API
 *  4. Config file (.z-ai-config) → Z.ai SDK fallback
 *
 * OpenRouter has 28+ free models: https://openrouter.ai/models?q=free
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

// ── Provider Detection ──
export function detectProvider(): { provider: AIProvider; hasKey: boolean } {
  if (process.env.ZAI_API_KEY) return { provider: 'zai', hasKey: true };
  if (process.env.OPENROUTER_API_KEY) return { provider: 'openrouter', hasKey: true };
  if (process.env.OPENAI_API_KEY) return { provider: 'openai', hasKey: true };
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
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
    } catch {
      errorMsg += `: ${errorText.slice(0, 200)}`;
    }
    throw new Error(errorMsg);
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

  private constructor(provider: AIProvider) {
    this.provider = provider;
  }

  static async create(): Promise<AIClient> {
    const { provider } = detectProvider();
    const client = new AIClient(provider);

    if (provider === 'zai') {
      const { getZAI } = await import('@/lib/zai');
      try {
        client.zai = await getZAI();
      } catch {
        // Z.ai SDK failed — try OpenRouter fallback
        if (process.env.OPENROUTER_API_KEY) {
          client.provider = 'openrouter';
          client.apiKey = process.env.OPENROUTER_API_KEY;
          client.baseUrl = 'https://openrouter.ai/api/v1';
          client.model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
        } else if (process.env.OPENAI_API_KEY) {
          client.provider = 'openai';
          client.apiKey = process.env.OPENAI_API_KEY;
          client.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
          client.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        } else {
          throw new Error(
            'No AI provider configured. Set one of:\n' +
            '  - ZAI_API_KEY (Z.ai platform)\n' +
            '  - OPENROUTER_API_KEY (free models! Get one at https://openrouter.ai/keys)\n' +
            '  - OPENAI_API_KEY (OpenAI or compatible API)'
          );
        }
      }
    } else if (provider === 'openrouter') {
      client.apiKey = process.env.OPENROUTER_API_KEY!;
      client.baseUrl = 'https://openrouter.ai/api/v1';
      client.model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
    } else if (provider === 'openai') {
      client.apiKey = process.env.OPENAI_API_KEY!;
      client.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      client.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }

    return client;
  }

  get providerName(): string {
    return this.provider;
  }

  get modelName(): string {
    return this.model || 'glm';
  }

  /** Chat completion — streaming or non-streaming */
  async chat(options: ChatCompletionOptions): Promise<ReadableStream<Uint8Array> | ChatCompletionResponse> {
    if (this.provider === 'zai' && this.zai) {
      return this.zai.chat.completions.create({
        messages: options.messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        stream: options.stream,
      } as Parameters<typeof this.zai.chat.completions.create>[0]);
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

    // OpenRouter/OpenAI don't have a good free image gen API
    // Use a placeholder response
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
