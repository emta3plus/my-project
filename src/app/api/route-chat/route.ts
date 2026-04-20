import { NextRequest } from 'next/server';
import { AIClient } from '@/lib/ai-provider';
import { SKILLS } from '@/lib/skills';
import { AGENTS } from '@/lib/agents';

export const maxDuration = 10;

// Build a compact skill/agent catalog for the classifier prompt
function buildCatalog(): string {
  const skillEntries = SKILLS.map((s) => `skill:${s.id}|${s.name}|${s.category}|${s.description.slice(0, 80)}`);
  const agentEntries = AGENTS.map((a) => `agent:${a.id}|${a.name}|${a.category}|${a.description.slice(0, 80)}`);
  return [...skillEntries, ...agentEntries].join('\n');
}

const CATALOG = buildCatalog();

const CLASSIFIER_SYSTEM = `You are a routing classifier for an AI assistant. Given a user message, select the SINGLE best skill or agent to handle it.

Available skills and agents:
${CATALOG}

Rules:
- Reply with ONLY the ID (e.g., "code-reviewer" or "architect") — no explanation, no quotes, no extra text
- If the user wants to generate an image, reply: image-generation
- If the user wants to understand/analyze an image, reply: vlm
- If the user wants to search the web, reply: web-search
- If the user wants to write code, use the language-specific skill if obvious, otherwise reply: fullstack-dev
- If the user wants code review, reply: code-reviewer or a language-specific reviewer
- If the user wants architecture/planning, reply: architect or planner
- If the user wants security analysis, reply: security-reviewer
- If the user wants testing, reply: tdd-guide
- If the user wants deployment/infra, reply: deployment-patterns
- For general conversation, casual chat, questions, or anything unclear, reply: general
- For writing/content, reply: article-writing
- For data/visualization, reply: charts
- For finance, reply: finance
- Default to "general" if uncertain`;

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages = body.messages as Array<{ role: string; content: string }> | undefined;
    if (!messages?.length) {
      return new Response(JSON.stringify({ route: 'general', type: 'none' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use the last user message as the classification target
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) {
      return new Response(JSON.stringify({ route: 'general', type: 'none' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Quick LLM classification call — fast and cheap
    const ai = await AIClient.create();
    const completion = await ai.chat({
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM },
        { role: 'user', content: lastUserMsg.content.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 30,
    });

    let rawRoute = (completion?.choices?.[0]?.message?.content || 'general').trim().toLowerCase();

    // Clean up the response — extract just the ID
    rawRoute = rawRoute.replace(/^["'`]+|["'`]+$/g, '').replace(/^(skill:|agent:)/, '');

    // Determine if it's a skill or agent
    const isSkill = SKILLS.some((s) => s.id === rawRoute);
    const isAgent = AGENTS.some((a) => a.id === rawRoute);

    let route = 'general';
    let type: 'skill' | 'agent' | 'none' = 'none';
    let name = '';

    if (isSkill) {
      route = rawRoute;
      type = 'skill';
      name = SKILLS.find((s) => s.id === rawRoute)?.name || rawRoute;
    } else if (isAgent) {
      route = rawRoute;
      type = 'agent';
      name = AGENTS.find((a) => a.id === rawRoute)?.name || rawRoute;
    }

    return new Response(JSON.stringify({ route, type, name }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Routing failed';
    console.error('[Route-Chat Error]', message);
    // Return general route on failure — don't block the user
    return new Response(JSON.stringify({ route: 'general', type: 'none', name: '' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
