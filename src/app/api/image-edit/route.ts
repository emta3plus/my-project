import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64, size } = await req.json();
    if (!prompt || !imageBase64) return NextResponse.json({ error: 'Prompt and image required' }, { status: 400 });
    const zai = await getZAI();
    const response = await zai.images.edits.create({ prompt, image: `data:image/png;base64,${imageBase64}`, size: size || '1024x1024' });
    const result = response.data[0]?.base64;
    if (!result) return NextResponse.json({ error: 'No image data' }, { status: 500 });
    return NextResponse.json({ image: result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image edit failed' }, { status: 500 });
  }
}
