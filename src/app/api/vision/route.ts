import { NextRequest, NextResponse } from 'next/server';
import { AIClient } from '@/lib/ai-provider';

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageUrl, imageBase64 } = await req.json();
    if (!prompt || (!imageUrl && !imageBase64)) return NextResponse.json({ error: 'Prompt and image required' }, { status: 400 });
    
    const ai = await AIClient.create();
    const img = imageUrl || `data:image/png;base64,${imageBase64}`;
    
    try {
      const completion = await ai.vision({
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: img } }] }],
      });
      
      const content = completion?.choices?.[0]?.message?.content;
      if (!content && (completion as Record<string, unknown>)?.error) {
        return NextResponse.json({ error: `Vision API error: ${JSON.stringify((completion as Record<string, Record<string, unknown>>).error)}` }, { status: 500 });
      }
      return NextResponse.json({ description: content || '' });
    } catch (visionErr) {
      const msg = visionErr instanceof Error ? visionErr.message : 'Vision failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Vision failed' }, { status: 500 });
  }
}
