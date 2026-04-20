import { NextRequest, NextResponse } from 'next/server';
import { AIClient } from '@/lib/ai-provider';

export async function POST(req: NextRequest) {
  try {
    const { query, num } = await req.json();
    if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });
    
    const ai = await AIClient.create();
    
    try {
      const result = await ai.webSearch({ query, num: num || 10 });
      return NextResponse.json({ results: result });
    } catch (searchErr) {
      const msg = searchErr instanceof Error ? searchErr.message : 'Search failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Search failed' }, { status: 500 });
  }
}
