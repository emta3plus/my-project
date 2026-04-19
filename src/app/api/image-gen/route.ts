import { NextRequest, NextResponse } from 'next/server';
import { getZAI } from '@/lib/zai';

export async function POST(req: NextRequest) {
  try {
    const { prompt, size } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    
    const zai = await getZAI();
    let response;
    try {
      response = await zai.images.generations.create({ prompt, size: size || '1024x1024' });
    } catch (sdkErr) {
      // SDK may crash with "Cannot read properties of undefined (reading 'map')" 
      // if the API returns an error format instead of {data: [...]}
      const msg = sdkErr instanceof Error ? sdkErr.message : 'Image generation API error';
      return NextResponse.json({ 
        error: msg.includes('map') 
          ? 'API authentication failed. Please check your ZAI_API_KEY at https://z.ai/manage-apikey/apikey-list' 
          : msg 
      }, { status: 500 });
    }
    
    // Guard against unexpected response formats (e.g. API auth errors return {error: ...} without data)
    const imageData = response?.data;
    if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
      const errMsg = (response as Record<string, unknown>)?.error 
        ? String((response as Record<string, Record<string, unknown>>).error) 
        : 'No image data returned from API. Check your ZAI_API_KEY.';
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }
    
    const imageBase64 = imageData[0]?.base64;
    if (!imageBase64) return NextResponse.json({ error: 'No base64 image in response' }, { status: 500 });
    return NextResponse.json({ image: imageBase64 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Image gen failed' }, { status: 500 });
  }
}
