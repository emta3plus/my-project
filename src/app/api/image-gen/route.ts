import { NextRequest, NextResponse } from 'next/server';
import { AIClient } from '@/lib/ai-provider';

export async function POST(req: NextRequest) {
  try {
    const { prompt, size } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    
    const ai = await AIClient.create();
    
    try {
      const response = await ai.imageGeneration({ prompt, size: size || '1024x1024' });
      
      const imageData = response?.data;
      if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
        return NextResponse.json({ error: 'No image data returned from API' }, { status: 500 });
      }
      
      const imageBase64 = imageData[0]?.base64;
      if (!imageBase64) return NextResponse.json({ error: 'No base64 image in response' }, { status: 500 });
      return NextResponse.json({ image: imageBase64 });
    } catch (imgErr) {
      // Image gen might not be available with all providers
      const msg = imgErr instanceof Error ? imgErr.message : 'Image generation failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image gen failed' }, { status: 500 });
  }
}
