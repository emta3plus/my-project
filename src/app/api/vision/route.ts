import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageUrl, imageBase64 } = await req.json();
    if (!prompt || (!imageUrl && !imageBase64)) return NextResponse.json({ error: 'Prompt and image required' }, { status: 400 });
    const zai = await getZAI();
    const img = imageUrl || `data:image/png;base64,${imageBase64}`;
    const completion = await zai.chat.completions.createVision({
      model: 'glm-4v-plus',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: img } }] }],
    });
    
    // Guard against unexpected response formats
    const content = completion?.choices?.[0]?.message?.content;
    if (!content && (completion as Record<string, unknown>)?.error) {
      return NextResponse.json({ 
        error: `Vision API error: ${JSON.stringify((completion as Record<string, Record<string, unknown>>).error)}` 
      }, { status: 500 });
    }
    
    return NextResponse.json({ description: content || '' });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Vision failed' }, { status: 500 });
  }
}
