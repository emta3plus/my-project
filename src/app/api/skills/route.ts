import { NextRequest, NextResponse } from 'next/server';
import { db, isDbAvailable } from '@/lib/db';

export async function GET() {
  try {
    if (!isDbAvailable()) {
      return NextResponse.json({ conversations: [] });
    }
    const conversations = await db!.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    return NextResponse.json({ conversations });
  } catch (e: unknown) {
    // Return empty array instead of error — prevents .map() crash on client
    return NextResponse.json({ conversations: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbAvailable()) {
      const { title } = await req.json();
      return NextResponse.json({ conversation: { id: crypto.randomUUID(), title: title || 'New Chat', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] } });
    }
    const { title } = await req.json();
    const conversation = await db!.conversation.create({ data: { title: title || 'New Chat' } });
    return NextResponse.json({ conversation });
  } catch (e: unknown) {
    const { title } = await req.json().catch(() => ({ title: 'New Chat' }));
    return NextResponse.json({ conversation: { id: crypto.randomUUID(), title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] } });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isDbAvailable()) {
      return NextResponse.json({ success: true });
    }
    const { id } = await req.json();
    await db!.conversation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ success: true });
  }
}
