import { NextRequest, NextResponse } from 'next/server';
import { getSkillContent, getAgentContent } from '@/lib/skills-loader';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const skillId = searchParams.get('skillId');
    const agentId = searchParams.get('agentId');

    if (!skillId && !agentId) {
      return NextResponse.json({ error: 'skillId or agentId query parameter required' }, { status: 400 });
    }

    if (skillId) {
      const content = await getSkillContent(skillId);
      if (content) {
        return NextResponse.json({ type: 'skill', id: skillId, content, found: true });
      }
      return NextResponse.json({ type: 'skill', id: skillId, content: '', found: false, message: `No instruction file found for skill: ${skillId}` });
    }

    if (agentId) {
      const content = await getAgentContent(agentId);
      if (content) {
        return NextResponse.json({ type: 'agent', id: agentId, content, found: true });
      }
      return NextResponse.json({ type: 'agent', id: agentId, content: '', found: false, message: `No instruction file found for agent: ${agentId}` });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load instructions' },
      { status: 500 }
    );
  }
}
