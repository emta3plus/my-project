import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

export async function POST(req: NextRequest) {
  try {
    const { query, num } = await req.json();
    if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });
    const zai = await getZAI();
    const result = await zai.functions.invoke('web_search', { query, num: num || 10 });
    return NextResponse.json({ results: result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Search failed' }, { status: 500 });
  }
}
