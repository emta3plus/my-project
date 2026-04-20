/**
 * Z.ai-Only AI Provider — FREE, unlimited, GLM models
 *
 * Uses the z-ai-web-dev-sdk for all AI operations.
 * No external API keys needed — Z.ai handles everything.
 *
 * Config sources (auto-detected):
 *  1. /etc/.z-ai-config (sandbox/development)
 *  2. .z-ai-config in project root
 *  3. Environment variables: ZAI_API_KEY + ZAI_BASE_URL (Vercel deployment)
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

// ── Unified AI Client (Z.ai only) ──
export class AIClient {
  private zai: InstanceType<typeof import('z-ai-web-dev-sdk').default> | null = null;
  private currentModel = 'glm-4-plus';

  private constructor() {}

  static async create(): Promise<AIClient> {
    const client = new AIClient();

    // Init Z.ai SDK
    try {
      const { getZAI } = await import('@/lib/zai');
      client.zai = await getZAI();
      console.log(`[AI Provider] Z.ai SDK initialized (GLM-4-plus, FREE, unlimited)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      console.error(`[AI Provider] Z.ai SDK failed: ${msg.slice(0, 200)}`);
      throw new Error(
        'Z.ai is not configured! Set ZAI_API_KEY env var on Vercel.\n' +
        'Get your free API key at: https://z.ai/manage-apikey/apikey-list\n' +
        `Details: ${msg.slice(0, 100)}`
      );
    }

    return client;
  }

  get providerName(): string { return 'zai'; }
  get modelName(): string { return this.currentModel; }
  get isZai(): boolean { return !!this.zai; }

  /** Main chat completion */
  async chat(options: ChatCompletionOptions): Promise<ReadableStream<Uint8Array> | ChatCompletionResponse> {
    if (!this.zai) {
      throw new Error('Z.ai SDK not initialized. Set ZAI_API_KEY env var.');
    }

    const result = await this.zai.chat.completions.create({
      messages: options.messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      temperature: options.temperature,
      max_tokens: options.max_tokens || 8192,
      stream: false,
    } as Parameters<typeof this.zai.chat.completions.create>[0]);

    this.currentModel = 'glm-4-plus';
    console.log('[AI Provider] ✓ Z.ai SDK (GLM-4-plus, FREE)');
    return result as ChatCompletionResponse;
  }

  /** Vision chat completion */
  async vision(options: {
    messages: Array<{
      role: string;
      content: Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }>;
  }): Promise<ChatCompletionResponse> {
    if (!this.zai) throw new Error('Z.ai SDK not initialized.');
    return this.zai.chat.completions.createVision({
      messages: options.messages as Parameters<typeof this.zai.chat.completions.createVision>[0]['messages'],
      thinking: { type: 'disabled' },
    });
  }

  /** Image generation */
  async imageGeneration(options: { prompt: string; size?: string }): Promise<{ data: Array<{ base64?: string; url?: string }> }> {
    if (!this.zai) throw new Error('Z.ai SDK not initialized.');
    return this.zai.images.generations.create({ prompt: options.prompt, size: options.size || '1024x1024' });
  }

  /** TTS */
  async tts(options: { text: string }): Promise<Response> {
    if (!this.zai) throw new Error('Z.ai SDK not initialized.');
    return this.zai.audio.tts.create({ input: options.text });
  }

  /** Web search */
  async webSearch(options: { query: string; num?: number }): Promise<unknown> {
    if (!this.zai) throw new Error('Z.ai SDK not initialized.');
    return this.zai.functions.invoke('web_search', { query: options.query, num: options.num || 10 });
  }
}

// Legacy compat — not used but keeps imports happy
export type AIProvider = 'zai';
export type ModelHint = 'auto' | 'coder';
export function detectProvider(): { provider: AIProvider; hasKey: boolean } {
  return { provider: 'zai', hasKey: true };
}
export function detectAllProviders(): Array<{ provider: AIProvider; hasKey: boolean; apiKey: string; baseUrl: string; models: string[] }> {
  return [{ provider: 'zai', hasKey: true, apiKey: '', baseUrl: '', models: ['glm-4-plus'] }];
}
