import { NextRequest } from 'next/server';
import { getZAI } from '@/lib/zai';
import { db } from '@/lib/db';
import { getSkillContent, getAgentContent } from '@/lib/skills-loader';
import { SKILLS } from '@/lib/skills';
import { AGENTS } from '@/lib/agents';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  // Helper: send an SSE event on the controller
  const sse = (controller: ReadableStreamDefaultController, data: Record<string, unknown>) => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // controller may be closed
    }
  };

  // Create the ReadableStream immediately so we can start sending events
  // BEFORE doing the slow autoRoute LLM call. This prevents connection drops.
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = '';
      let usageData: Record<string, number> | undefined;

      try {
        // ── 1. Parse request body ──
        let body: Record<string, unknown>;
        try {
          body = await req.json();
        } catch {
          sse(controller, { error: 'Invalid JSON in request body', done: true });
          controller.close();
          return;
        }

        const messages = body.messages as Array<{ role: string; content: string }> | undefined;
        const conversationId = body.conversationId as string | undefined;
        const explicitSkill = body.skill as string | undefined;
        const explicitAgent = body.agent as string | undefined;

        if (!messages?.length) {
          sse(controller, { error: 'Messages required', done: true });
          controller.close();
          return;
        }

        // ── 2. Send a "thinking" event immediately so the client knows we're alive ──
        sse(controller, { status: 'thinking', content: '', done: false });

        // ── 3. Auto-route (may take 5-15 seconds, but we already sent a heartbeat) ──
        let skill = explicitSkill || undefined;
        let agent = explicitAgent || undefined;
        let autoRouted = false;
        let autoRouteName = '';

        if (!skill && !agent) {
          // Send a routing status so the client can show "Selecting skill..."
          sse(controller, { status: 'routing', content: '', done: false });

          const routeResult = await autoRoute(messages);
          if (routeResult.type === 'skill') {
            skill = routeResult.route;
            autoRouteName = routeResult.name;
            autoRouted = true;
          } else if (routeResult.type === 'agent') {
            agent = routeResult.route;
            autoRouteName = routeResult.name;
            autoRouted = true;
          }

          // Tell the client which skill/agent was auto-selected
          if (autoRouted && autoRouteName) {
            sse(controller, {
              route: autoRouteName,
              routeType: skill ? 'skill' : 'agent',
              routeId: skill || agent || '',
            });
          }
        }

        // ── 4. Build system prompt with skill/agent context ──
        const systemPrompt = await buildSystemPrompt(skill, agent);
        const apiMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ];

        // ── 5. Stream AI completion ──
        sse(controller, { status: 'generating', content: '', done: false });

        const zai = await getZAI();
        const completion = await zai.chat.completions.create({
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 8192,
          stream: true,
        });

        let sseBuffer = '';
        let lastKeepalive = Date.now();

        for await (const chunk of completion) {
          let text: string;
          if (typeof chunk === 'string') {
            text = chunk;
          } else if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
            text = Buffer.from(chunk).toString('utf-8');
          } else if (typeof chunk === 'object' && chunk !== null && chunk[0] !== undefined) {
            const bytes = new Uint8Array(Object.values(chunk) as number[]);
            text = Buffer.from(bytes).toString('utf-8');
          } else {
            continue;
          }

          sseBuffer += text;

          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
              // Save to DB in background
              if (conversationId && fullContent) {
                saveMessages(conversationId, messages, fullContent, skill || agent).catch(() => {});
              }
              sse(controller, { content: '', done: true, usage: usageData });
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              const finishReason = parsed.choices?.[0]?.finish_reason;
              const usage = parsed.usage;

              if (delta) {
                fullContent += delta;
                sse(controller, { content: delta, done: false });
                lastKeepalive = Date.now();
              }

              if (usage) {
                usageData = usage;
              }

              if (finishReason === 'stop') {
                if (conversationId && fullContent) {
                  saveMessages(conversationId, messages, fullContent, skill || agent).catch(() => {});
                }
                sse(controller, { content: '', done: true, usage: usageData || { total_tokens: 0 } });
                controller.close();
                return;
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }

          // Send keepalive comment every 10 seconds to prevent connection drop
          if (Date.now() - lastKeepalive > 10000) {
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n'));
              lastKeepalive = Date.now();
            } catch {
              // controller may be closed
            }
          }
        }

        // Stream ended normally (no explicit [DONE] or finish_reason)
        if (conversationId && fullContent) {
          saveMessages(conversationId, messages, fullContent, skill || agent).catch(() => {});
        }
        sse(controller, { content: '', done: true, usage: usageData || { total_tokens: 0 } });
        controller.close();
      } catch (streamErr) {
        const errMsg = streamErr instanceof Error ? streamErr.message : 'Stream error';
        console.error('[Chat Stream Error]', errMsg);
        try {
          sse(controller, { error: errMsg, done: true });
        } catch {
          // Controller may already be closed
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ── Auto-route: use the LLM to classify the best skill/agent for the user's message ──
async function autoRoute(messages: Array<{ role: string; content: string }>): Promise<{ route: string; type: 'skill' | 'agent' | 'none'; name: string }> {
  try {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return { route: 'general', type: 'none', name: '' };

    const content = lastUserMsg.content.toLowerCase();

    // ── Fast keyword-based shortcuts (no LLM call needed) ──
    if (/\b(generate|create|draw|make)\b.*\b(image|picture|photo|illustration|artwork)\b/.test(content)) {
      const s = SKILLS.find((s) => s.id === 'image-generation');
      return { route: 'image-generation', type: 'skill', name: s?.name || 'Image Generation' };
    }
    if (/^\s*(search|find|look up|google)\b/i.test(content) || /\bweb\s*search\b/i.test(content)) {
      const s = SKILLS.find((s) => s.id === 'web-search');
      return { route: 'web-search', type: 'skill', name: s?.name || 'Web Search' };
    }
    // Code-related shortcuts
    if (/\b(code|program|function|script|debug|fix bug|refactor)\b/i.test(content) && !/\breview\b/i.test(content)) {
      return { route: 'fullstack-dev', type: 'skill', name: 'Fullstack Development' };
    }
    if (/\b(review|code review)\b/i.test(content)) {
      return { route: 'code-review', type: 'skill', name: 'Code Review' };
    }
    if (/\b(security|vulnerability|exploit)\b/i.test(content)) {
      return { route: 'security', type: 'skill', name: 'Security' };
    }
    if (/\b(test|testing|unit test|tdd)\b/i.test(content)) {
      return { route: 'tdd', type: 'skill', name: 'TDD / Testing' };
    }
    if (/\b(deploy|ci\/cd|docker|kubernetes)\b/i.test(content)) {
      return { route: 'devops', type: 'skill', name: 'DevOps' };
    }
    if (/\b(write|essay|article|blog|content)\b/i.test(content)) {
      return { route: 'writer', type: 'skill', name: 'Writer' };
    }
    if (/\b(analyz|research|investigate)\b/i.test(content)) {
      return { route: 'researcher', type: 'skill', name: 'Researcher' };
    }
    if (/\b(architect|design system|system design)\b/i.test(content)) {
      return { route: 'architect', type: 'skill', name: 'Architect' };
    }

    // ── LLM-based routing for ambiguous cases ──
    // Only include top skills/agents to keep the classifier prompt small and fast
    const topSkills = SKILLS.filter((s) =>
      ['fullstack-dev', 'code-review', 'tdd', 'security', 'architect', 'writer', 'researcher', 'devops', 'planner', 'image-generation', 'web-search'].includes(s.id)
    );
    const topAgents = AGENTS.slice(0, 20);

    const catalogLines = [
      ...topSkills.map((s) => `S:${s.id}|${s.name}|${s.category}|${s.description.slice(0, 60)}`),
      ...topAgents.map((a) => `A:${a.id}|${a.name}|${a.category}|${a.description.slice(0, 60)}`),
    ].join('\n');

    const classifierPrompt = `You are a routing classifier. Given a user message, select the SINGLE best skill (S:) or agent (A:) to handle it.

Catalog:
${catalogLines}

Rules:
- Reply with ONLY the ID (e.g. "code-reviewer" or "architect"). No explanation, no quotes.
- For general conversation, casual chat, greetings, or unclear topics, reply: general
- Default to "general" if uncertain`;

    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: classifierPrompt },
        { role: 'user', content: lastUserMsg.content.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 30,
    });

    let rawRoute = (completion.choices[0]?.message?.content || 'general').trim().toLowerCase();
    rawRoute = rawRoute.replace(/^["'`]+|["'`]+$/g, '');

    const isSkill = SKILLS.some((s) => s.id === rawRoute);
    const isAgent = AGENTS.some((a) => a.id === rawRoute);

    if (isSkill) {
      const s = SKILLS.find((s) => s.id === rawRoute)!;
      return { route: rawRoute, type: 'skill', name: s.name };
    } else if (isAgent) {
      const a = AGENTS.find((a) => a.id === rawRoute)!;
      return { route: rawRoute, type: 'agent', name: a.name };
    }

    return { route: 'general', type: 'none', name: '' };
  } catch (e) {
    console.error('[AutoRoute Error]', e instanceof Error ? e.message : 'Unknown');
    return { route: 'general', type: 'none', name: '' };
  }
}

// ── Separate DB save function ──
async function saveMessages(
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
  assistantContent: string,
  skillName?: string | null,
) {
  try {
    const last = messages[messages.length - 1];
    await db.message.create({
      data: { conversationId, role: last.role, content: last.content, skill: skillName || null },
    });
    await db.message.create({
      data: { conversationId, role: 'assistant', content: assistantContent, model: 'glm', skill: skillName || null },
    });
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  } catch {
    // Database errors should not break the chat response
  }
}

async function buildSystemPrompt(skill?: string, agent?: string): Promise<string> {
  const base = `You are a powerful personal AI assistant with access to 227 skills and 47 specialized agents. Capabilities: natural conversation, code generation/review, research, creative writing, data analysis, and problem-solving. Be concise but thorough. Think step-by-step for complex problems. Validate edge cases.`;

  let extra = '';

  // Load skill instructions
  if (skill) {
    const skillMap: Record<string, string> = {
      'code-review': ' CODE REVIEW mode: Check security, performance, quality. Format: [SEVERITY] Issue.',
      'tdd': ' TDD mode: Write failing test first (RED), minimal code (GREEN), refactor (IMPROVE). 80%+ coverage.',
      'architect': ' ARCHITECT mode: System design, scalability, trade-offs, ADRs.',
      'security': ' SECURITY mode: Detect vulnerabilities aggressively. OWASP Top 10. Report by severity.',
      'planner': ' PLANNER mode: Break features into phases, steps, dependencies, risks.',
      'writer': ' WRITER mode: Engaging, well-structured content. Adapt tone.',
      'researcher': ' RESEARCHER mode: Research thoroughly. Cite sources. Present findings objectively.',
    };

    if (skillMap[skill]) {
      extra += skillMap[skill];
    } else {
      try {
        const skillContent = await getSkillContent(skill);
        if (skillContent) {
          extra += `\n\n[SKILL: ${skill}]\n${skillContent.slice(0, 6000)}`;
        }
      } catch {
        const skillInfo = SKILLS.find((s) => s.id === skill);
        const categoryHints: Record<string, string> = {
          'ai-core': ' AI CORE mode: Focus on AI/ML implementation, model integration, and LLM patterns.',
          'blockchain': ' BLOCKCHAIN mode: Focus on Web3, smart contracts, and cryptographic correctness.',
          'communication': ' COMMUNICATION mode: Focus on email, messaging, and notification workflows.',
          'data': ' DATA mode: Focus on databases, analytics, data pipelines, and visualization.',
          'design': ' DESIGN mode: Focus on UI/UX, visual systems, and frontend aesthetics.',
          'development': ' DEVELOPMENT mode: Focus on code quality, patterns, and best practices.',
          'devops': ' DEVOPS mode: Focus on CI/CD, deployment, monitoring, and automation.',
          'education': ' EDUCATION mode: Focus on learning, documentation, and knowledge sharing.',
          'finance': ' FINANCE mode: Focus on financial data, billing, markets, and compliance.',
          'health': ' HEALTH mode: Focus on healthcare, wellness, and clinical safety.',
          'marketing': ' MARKETING mode: Focus on growth, outreach, lead generation, and social strategy.',
          'media': ' MEDIA mode: Focus on image, video, and audio generation and processing.',
          'operations': ' OPERATIONS mode: Focus on business operations, logistics, and efficiency.',
          'productivity': ' PRODUCTIVITY mode: Focus on workflow optimization and automation.',
          'research': ' RESEARCH mode: Focus on deep investigation, evidence gathering, and analysis.',
          'security': ' SECURITY mode: Focus on vulnerability detection, compliance, and secure coding.',
          'writing': ' WRITING mode: Focus on content creation, editing, and communication.',
        };
        if (skillInfo) {
          extra += categoryHints[skillInfo.category] || ` You are operating with the "${skill}" skill activated. Apply its specialized knowledge and patterns.`;
        }
      }
    }
  }

  // Load agent instructions
  if (agent) {
    try {
      const agentContent = await getAgentContent(agent);
      if (agentContent) {
        extra += `\n\n[AGENT: ${agent}]\n${agentContent.slice(0, 6000)}`;
      }
    } catch {
      const agentInfo = AGENTS.find((a) => a.id === agent);
      const agentCategoryHints: Record<string, string> = {
        'architecture': ' You are acting as an architecture specialist agent. Focus on system design, scalability, and technical decisions.',
        'review': ' You are acting as a code review agent. Focus on quality, security, and maintainability.',
        'build': ' You are acting as a build/fix agent. Focus on resolving errors with minimal diffs.',
        'security': ' You are acting as a security agent. Detect vulnerabilities and recommend remediation.',
        'quality': ' You are acting as a quality agent. Focus on code clarity, consistency, and correctness.',
        'testing': ' You are acting as a testing agent. Focus on test coverage, TDD methodology, and behavioral testing.',
        'docs': ' You are acting as a documentation agent. Focus on clarity, accuracy, and completeness.',
        'operations': ' You are acting as an operations agent. Focus on business workflows and efficiency.',
        'infrastructure': ' You are acting as an infrastructure agent. Focus on reliability, cost optimization, and system configuration.',
      };
      if (agentInfo) {
        extra += agentCategoryHints[agentInfo.category] || ` You are operating as the "${agent}" agent. Apply its specialized capabilities.`;
      }
    }
  }

  return base + extra;
}
