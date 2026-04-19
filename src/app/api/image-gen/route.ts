import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

export async function POST(req: NextRequest) {
  try {
    const { prompt, size } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    const zai = await getZAI();
    const response = await zai.images.generations.create({ prompt, size: size || '1024x1024' });
    const imageBase64 = response.data[0]?.base64;
    if (!imageBase64) return NextResponse.json({ error: 'No image data' }, { status: 500 });
    return NextResponse.json({ image: imageBase64 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image gen failed' }, { status: 500 });
  }
}
