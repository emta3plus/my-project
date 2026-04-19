import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

let zaiInstance: ZAI | null = null;

/**
 * Loads Z.ai config from environment variables or file system.
 *
 * On Vercel (read-only filesystem): uses ZAI_API_KEY env var directly,
 * constructs ZAI instance via constructor — NO file writes needed.
 *
 * On Z.ai platform sandbox: reads /etc/.z-ai-config (already exists).
 */
function loadConfigFromEnv(): Record<string, string> | null {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4';
  const config: Record<string, string> = { baseUrl, apiKey };
  if (process.env.ZAI_CHAT_ID) config.chatId = process.env.ZAI_CHAT_ID;
  if (process.env.ZAI_USER_ID) config.userId = process.env.ZAI_USER_ID;
  if (process.env.ZAI_TOKEN) config.token = process.env.ZAI_TOKEN;
  return config;
}

function loadConfigFromFile(): Record<string, string> | null {
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(require('os').homedir(), '.z-ai-config'),
    '/etc/.z-ai-config',
  ];

  for (const filePath of configPaths) {
    try {
      if (fs.existsSync(filePath)) {
        const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (config.baseUrl && config.apiKey) return config;
      }
    } catch {
      // continue to next path
    }
  }
  return null;
}

/**
 * Get a ZAI SDK instance. Works in both Vercel and local/sandbox environments.
 *
 * Priority:
 *  1. Environment variables (ZAI_API_KEY) — for Vercel deployment
 *  2. Config files (.z-ai-config) — for local/sandbox development
 */
export async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    // Try env vars first (works on Vercel — no filesystem writes)
    const envConfig = loadConfigFromEnv();
    if (envConfig) {
      console.log('[z-ai] Using config from environment variables');
      // Use constructor directly — bypasses loadConfig() file read
      zaiInstance = new ZAI(envConfig);
      return zaiInstance;
    }

    // Try config files (works in local/sandbox)
    const fileConfig = loadConfigFromFile();
    if (fileConfig) {
      console.log('[z-ai] Using config from file');
      zaiInstance = new ZAI(fileConfig);
      return zaiInstance;
    }

    // Neither worked — provide helpful error
    throw new Error(
      '[z-ai] No configuration found. Either:\n' +
      '  1. Set ZAI_API_KEY env var (get one at https://z.ai/manage-apikey/apikey-list)\n' +
      '  2. Create .z-ai-config file in project root'
    );
  }
  return zaiInstance;
}
