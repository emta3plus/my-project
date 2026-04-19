import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });
    if (text.length > 1024) return NextResponse.json({ error: 'Text exceeds 1024 chars' }, { status: 400 });
    const zai = await getZAI();
    const response = await zai.audio.speech.create({ input: text });
    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() } });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'TTS failed' }, { status: 500 });
  }
}
