import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

export async function POST(req: NextRequest) {
  try {
    const { audioBase64 } = await req.json();
    if (!audioBase64) return NextResponse.json({ error: 'Audio required' }, { status: 400 });
    const zai = await getZAI();
    const result = await zai.audio.transcriptions.create({ file: `data:audio/wav;base64,${audioBase64}` });
    return NextResponse.json({ text: result.text });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ASR failed' }, { status: 500 });
  }
}
