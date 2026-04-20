import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

let zaiInstance: ZAI | null = null;

/**
 * Z.ai SDK Configuration — works in BOTH environments:
 *
 * 1. Z.ai Platform Sandbox: reads /etc/.z-ai-config (auto-detected)
 * 2. Vercel / External: uses ZAI_API_KEY env var with public Z.ai API
 *
 * Public API: https://api.z.ai/api/paas/v4
 * Auth: Bearer <your-api-key>
 * Get key: https://z.ai/manage-apikey/apikey-list
 */

// Public Z.ai API base URL (works from anywhere on the internet)
const ZAI_PUBLIC_BASE_URL = 'https://api.z.ai/api/paas/v4';

function loadConfigFromEnv(): Record<string, string> | null {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) return null;

  // Use public API base URL (works from Vercel or any external host)
  const baseUrl = process.env.ZAI_BASE_URL || ZAI_PUBLIC_BASE_URL;
  const config: Record<string, string> = { baseUrl, apiKey };

  // Optional: extra config for advanced usage
  if (process.env.ZAI_CHAT_ID) config.chatId = process.env.ZAI_CHAT_ID;
  if (process.env.ZAI_USER_ID) config.userId = process.env.ZAI_USER_ID;
  if (process.env.ZAI_TOKEN) config.token = process.env.ZAI_TOKEN;

  console.log(`[z-ai] Using PUBLIC API: ${baseUrl}`);
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
        if (config.baseUrl && config.apiKey) {
          console.log(`[z-ai] Using config from file: ${filePath}`);
          return config;
        }
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
 *
 * For Vercel deployment, set:
 *  ZAI_API_KEY = <your key from https://z.ai/manage-apikey/apikey-list>
 *  (ZAI_BASE_URL is optional, defaults to https://api.z.ai/api/paas/v4)
 */
export async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    // Try env vars first (works on Vercel — uses public API)
    const envConfig = loadConfigFromEnv();
    if (envConfig) {
      zaiInstance = new ZAI(envConfig);
      return zaiInstance;
    }

    // Try config files (works in local/sandbox — may use internal IP)
    const fileConfig = loadConfigFromFile();
    if (fileConfig) {
      zaiInstance = new ZAI(fileConfig);
      return zaiInstance;
    }

    // Neither worked — provide helpful error
    throw new Error(
      '[z-ai] No configuration found. Either:\n' +
      '  1. Set ZAI_API_KEY env var (get one at https://z.ai/manage-apikey/apikey-list)\n' +
      '  2. Create .z-ai-config file in project root\n\n' +
      'For Vercel: Add ZAI_API_KEY in Settings → Environment Variables'
    );
  }
  return zaiInstance;
}
