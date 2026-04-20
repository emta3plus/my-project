import { NextResponse } from 'next/server';
import { detectProvider } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { provider, hasKey } = detectProvider();
  
  const envStatus = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? `set (${process.env.OPENROUTER_API_KEY.slice(0, 10)}...)` : 'not set',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `set (${process.env.OPENAI_API_KEY.slice(0, 10)}...)` : 'not set',
    ZAI_API_KEY: process.env.ZAI_API_KEY ? `set (${process.env.ZAI_API_KEY.slice(0, 10)}...)` : 'not set',
    ZAI_BASE_URL: process.env.ZAI_BASE_URL || 'not set',
  };

  return NextResponse.json({
    provider,
    hasKey,
    envStatus,
    recommendation: !hasKey 
      ? 'No AI provider configured! Set OPENROUTER_API_KEY on Vercel for free models.' 
      : `Using ${provider} provider.`,
  });
}
