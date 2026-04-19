import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

/**
 * Ensures .z-ai-config exists by generating it from environment variables
 * if not already present on disk. Supports two deployment modes:
 *
 * 1. Internal/Z.ai Platform mode (default): uses the internal gateway
 *    with X-Token auth. Config is already at /etc/.z-ai-config.
 *
 * 2. Public/Vercel mode: uses the public Z.ai API at api.z.ai with
 *    a personal API key. Set ZAI_API_KEY env var on Vercel.
 */
function ensureConfig() {
  const configPath = path.join(process.cwd(), '.z-ai-config');

  // If config already exists and is valid, nothing to do
  if (fs.existsSync(configPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (existing.baseUrl && existing.apiKey) return;
    } catch {
      // Invalid config, will regenerate
    }
  }

  // ── Public mode: use Z.ai public API with personal API key ──
  // Set ZAI_API_KEY = your key from https://z.ai/manage-apikey/apikey-list
  const apiKey = process.env.ZAI_API_KEY;
  if (apiKey) {
    const baseUrl = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4';
    const chatId = process.env.ZAI_CHAT_ID;
    const userId = process.env.ZAI_USER_ID;
    const token = process.env.ZAI_TOKEN;

    const config: Record<string, string> = { baseUrl, apiKey };
    if (chatId) config.chatId = chatId;
    if (userId) config.userId = userId;
    if (token) config.token = token;

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('[z-ai] Config generated from ZAI_API_KEY env var (public mode)');
    } catch (err) {
      console.error('[z-ai] Failed to write config:', err);
    }
    return;
  }

  // ── Internal mode: check if /etc/.z-ai-config exists (Z.ai platform sandbox) ──
  const internalPath = '/etc/.z-ai-config';
  if (fs.existsSync(internalPath)) {
    try {
      const internalConfig = JSON.parse(fs.readFileSync(internalPath, 'utf-8'));
      if (internalConfig.baseUrl && internalConfig.apiKey) {
        fs.writeFileSync(configPath, JSON.stringify(internalConfig, null, 2), 'utf-8');
        console.log('[z-ai] Config copied from /etc/.z-ai-config (internal mode)');
        return;
      }
    } catch {
      // fallthrough
    }
  }

  console.warn('[z-ai] No .z-ai-config found and no ZAI_API_KEY env var set. AI features will not work.');
  console.warn('[z-ai] Get an API key at: https://z.ai/manage-apikey/apikey-list');
}

export async function getZAI() {
  if (!zaiInstance) {
    // Ensure config exists before initializing SDK
    ensureConfig();
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}
