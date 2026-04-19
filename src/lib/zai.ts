import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

/**
 * Ensures .z-ai-config exists by generating it from environment variables
 * if not already present. This allows Vercel deployment without committing secrets.
 */
function ensureConfig() {
  const configPath = path.join(process.cwd(), '.z-ai-config');

  // If config already exists, nothing to do
  if (fs.existsSync(configPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (existing.baseUrl && existing.apiKey) return;
    } catch {
      // Invalid config, will regenerate
    }
  }

  // Generate config from environment variables
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;
  const token = process.env.ZAI_TOKEN;
  const chatId = process.env.ZAI_CHAT_ID;
  const userId = process.env.ZAI_USER_ID;

  if (!baseUrl || !apiKey) {
    console.warn('[z-ai] Missing ZAI_BASE_URL or ZAI_API_KEY env vars. AI features will not work.');
    return;
  }

  const config: Record<string, string> = { baseUrl, apiKey };
  if (chatId) config.chatId = chatId;
  if (userId) config.userId = userId;
  if (token) config.token = token;

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[z-ai] Config generated from environment variables');
  } catch (err) {
    console.error('[z-ai] Failed to write config:', err);
  }
}

export async function getZAI() {
  if (!zaiInstance) {
    // Ensure config exists before initializing SDK
    ensureConfig();
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}
