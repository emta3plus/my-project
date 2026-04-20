import { NextRequest, NextResponse } from 'next/server';
import { AIClient } from '@/lib/ai-provider';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });
    if (text.length > 1024) return NextResponse.json({ error: 'Text exceeds 1024 chars' }, { status: 400 });
    
    const ai = await AIClient.create();
    
    try {
      const response = await ai.tts({ text });
      const buffer = Buffer.from(await response.arrayBuffer());
      return new NextResponse(buffer, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() } });
    } catch (ttsErr) {
      const msg = ttsErr instanceof Error ? ttsErr.message : 'TTS failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'TTS failed' }, { status: 500 });
  }
}
