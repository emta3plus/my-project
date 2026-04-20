import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const zaiKey = process.env.ZAI_API_KEY;
  const zaiBaseUrl = process.env.ZAI_BASE_URL;

  // Try to init Z.ai to check if it works
  let zaiStatus = 'not tested';
  try {
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();
    zaiStatus = zai ? 'connected' : 'failed';
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    zaiStatus = `error: ${msg.slice(0, 100)}`;
  }

  const envStatus = {
    ZAI_API_KEY: zaiKey ? `set (${zaiKey.slice(0, 10)}...)` : 'not set (using config file)',
    ZAI_BASE_URL: zaiBaseUrl || 'not set (using default)',
  };

  return NextResponse.json({
    provider: 'zai',
    model: 'glm-4-plus',
    zaiStatus,
    envStatus,
    recommendation: zaiStatus === 'connected'
      ? 'Z.ai is connected and ready!'
      : 'Z.ai not connected. Set ZAI_API_KEY env var. Get key at: https://z.ai/manage-apikey/apikey-list',
  });
}
