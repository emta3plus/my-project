import { NextRequest } from 'next/server';
import { AIClient } from '@/lib/ai-provider';
import { db } from '@/lib/db';
import { getSkillContent, getAgentContent } from '@/lib/skills-loader';
import { SKILLS } from '@/lib/skills';
import { AGENTS } from '@/lib/agents';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Helper: check if a value is async iterable (stream)
function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown> {
  return obj != null && typeof (obj as Record<string, unknown>)[Symbol.asyncIterator] === 'function';
}

// Detect if a message is coding-related (for model selection)
function isCodingMessage(content: string): boolean {
  const c = content.toLowerCase();
  return /\b(code|coding|program|function|script|debug|fix bug|refactor|typescript|javascript|python|java|rust|go|react|next\.?js|node\.?js|api|html|css|sql|database|git|npm|yarn|pip|cargo|component|hook|render|async|await|class|interface|type|array|object|string|number|boolean|error|exception|compile|build|deploy|server|client|frontend|backend|fullstack|algorithm|data structure|leetcode|hackerrank)\b/i.test(c);
}

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
        let routeModelHint: 'auto' | 'coder' = 'auto';

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
          routeModelHint = routeResult.modelHint;

          // Tell the client which skill/agent was auto-selected
          if (autoRouted && autoRouteName) {
            sse(controller, {
              route: autoRouteName,
              routeType: skill ? 'skill' : 'agent',
              routeId: skill || agent || '',
            });
          }
        } else {
          // If skill/agent explicitly selected, detect if it's coding-related
          const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
          if (lastUserMsg && isCodingMessage(lastUserMsg.content)) {
            routeModelHint = 'coder';
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

        const ai = await AIClient.create(routeModelHint);
        console.log(`[Chat] Provider: ${ai.providerName}, Model: ${ai.modelName}, Hint: ${routeModelHint}`);
        let completion: unknown = null;
        try {
          completion = await ai.chat({
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 16384,
            stream: true,
          });
        } catch (apiErr) {
          // API init failed (e.g. auth error) — send error to client
          const errMsg = apiErr instanceof Error ? apiErr.message : 'API request failed';
          sse(controller, { error: `[${ai.providerName}/${ai.modelName}] ${errMsg}`, done: true });
          controller.close();
          return;
        }

        if (!completion) {
          sse(controller, { error: 'No response from API', done: true });
          controller.close();
          return;
        }

        // Handle non-streaming JSON response (Z.ai public API may return JSON instead of stream)
        if (typeof completion === 'object' && completion !== null && !isAsyncIterable(completion) && !(completion instanceof ReadableStream)) {
          const resp = completion as Record<string, unknown>;
          if (resp.error) {
            sse(controller, { error: `API error: ${JSON.stringify(resp.error)}`, done: true });
            controller.close();
            return;
          }
          const content = (resp.choices as Array<{message?: {content?: string}}>)?.[0]?.message?.content || '';
          fullContent = content;
          if (conversationId && fullContent) {
            saveMessages(conversationId, messages, fullContent, skill || agent).catch(() => {});
          }
          sse(controller, { content, done: true, usage: resp.usage as Record<string, number> | undefined });
          controller.close();
          return;
        }

        let sseBuffer = '';
        let lastKeepalive = Date.now();

        for await (const chunk of completion as AsyncIterable<unknown>) {
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
async function autoRoute(messages: Array<{ role: string; content: string }>): Promise<{ route: string; type: 'skill' | 'agent' | 'none'; name: string; modelHint: 'auto' | 'coder' }> {
  try {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return { route: 'general', type: 'none', name: '', modelHint: 'auto' };

    const content = lastUserMsg.content.toLowerCase();

    // ── Fast keyword-based shortcuts (no LLM call needed) ──
    // Simple greetings / casual chat — skip routing entirely
    if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|sup|yo|what'?s\s*up|hola)[\s!.?]*$/i.test(content) || content.length < 10 && /^(thanks|thank you|ok|okay|bye|goodbye|sure|yes|no|maybe)[\s!.?]*$/i.test(content)) {
      return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
    }
    if (/\b(generate|create|draw|make)\b.*\b(image|picture|photo|illustration|artwork)\b/.test(content)) {
      const s = SKILLS.find((s) => s.id === 'image-generation');
      return { route: 'image-generation', type: 'skill', name: s?.name || 'Image Generation', modelHint: 'auto' };
    }
    if (/^\s*(search|find|look up|google)\b/i.test(content) || /\bweb\s*search\b/i.test(content)) {
      const s = SKILLS.find((s) => s.id === 'web-search');
      return { route: 'web-search', type: 'skill', name: s?.name || 'Web Search', modelHint: 'auto' };
    }

    // ── Code-related shortcuts ── These use the coder model
    // Broad coding detection — any message about programming should use coder model
    if (isCodingMessage(content)) {
      // Specific coding sub-routes
      if (/\b(review|code\s*review)\b/i.test(content)) {
        return { route: 'code-review', type: 'skill', name: 'Code Review', modelHint: 'coder' };
      }
      if (/\b(security|vulnerability|exploit)\b/i.test(content)) {
        return { route: 'security', type: 'skill', name: 'Security', modelHint: 'coder' };
      }
      if (/\b(test|testing|unit\s*test|tdd)\b/i.test(content)) {
        return { route: 'tdd', type: 'skill', name: 'TDD / Testing', modelHint: 'coder' };
      }

      // Language-specific routing
      if (/\b(python|django|flask|pytest|pip)\b/i.test(content)) {
        return { route: 'python-patterns', type: 'skill', name: 'Python Development', modelHint: 'coder' };
      }
      if (/\b(rust|cargo|borrow|ownership|lifetime)\b/i.test(content)) {
        return { route: 'rust-patterns', type: 'skill', name: 'Rust Development', modelHint: 'coder' };
      }
      if (/\b(golang|go\s*lang|goroutine|channel|go\s*mod)\b/i.test(content)) {
        return { route: 'golang-patterns', type: 'skill', name: 'Go Development', modelHint: 'coder' };
      }
      if (/\b(typescript|react|next\.?js|node\.?js|tsx|jsx|npm|yarn|vite|webpack)\b/i.test(content)) {
        return { route: 'fullstack-dev', type: 'skill', name: 'Fullstack Development', modelHint: 'coder' };
      }
      if (/\b(java|spring|jpa|hibernate|maven|gradle)\b/i.test(content)) {
        return { route: 'springboot-patterns', type: 'skill', name: 'Spring Boot', modelHint: 'coder' };
      }
      if (/\b(kotlin|android|jetpack|compose)\b/i.test(content)) {
        return { route: 'kotlin-patterns', type: 'skill', name: 'Kotlin Development', modelHint: 'coder' };
      }
      if (/\b(c\+\+|cmake|g\+\+|clang)\b/i.test(content)) {
        return { route: 'cpp-coding-standards', type: 'skill', name: 'C++ Coding', modelHint: 'coder' };
      }
      if (/\b(swift|ios|swiftui|xcode)\b/i.test(content)) {
        return { route: 'swiftui-patterns', type: 'skill', name: 'SwiftUI', modelHint: 'coder' };
      }
      if (/\b(laravel|php|artisan|blade|eloquent)\b/i.test(content)) {
        return { route: 'laravel-patterns', type: 'skill', name: 'Laravel', modelHint: 'coder' };
      }
      if (/\b(flutter|dart|widget|pub)\b/i.test(content)) {
        return { route: 'dart-flutter-patterns', type: 'skill', name: 'Flutter/Dart', modelHint: 'coder' };
      }
      if (/\b(perl|cpan)\b/i.test(content)) {
        return { route: 'perl-patterns', type: 'skill', name: 'Perl', modelHint: 'coder' };
      }
      if (/\b(database|sql|postgres|mysql|prisma|drizzle|query|schema)\b/i.test(content)) {
        return { route: 'postgres-patterns', type: 'skill', name: 'Database', modelHint: 'coder' };
      }
      if (/\b(docker|kubernetes|deploy|ci.?cd|github\s*actions)\b/i.test(content)) {
        return { route: 'devops', type: 'skill', name: 'DevOps', modelHint: 'coder' };
      }

      // General code request — fullstack-dev as default
      if (/\b(code|program|function|script|debug|fix\s*bug|refactor|build|implement|create\s*app|develop)\b/i.test(content)) {
        return { route: 'fullstack-dev', type: 'skill', name: 'Fullstack Development', modelHint: 'coder' };
      }

      // Any other coding message
      return { route: 'fullstack-dev', type: 'skill', name: 'Fullstack Development', modelHint: 'coder' };
    }

    // ── Non-coding shortcuts ──
    if (/\b(write|essay|article|blog|content|email|letter)\b/i.test(content)) {
      return { route: 'writer', type: 'skill', name: 'Writer', modelHint: 'auto' };
    }
    if (/\b(analyz|research|investigate|study|compare)\b/i.test(content)) {
      return { route: 'researcher', type: 'skill', name: 'Researcher', modelHint: 'auto' };
    }
    if (/\b(architect|design\s*system|system\s*design|scalability)\b/i.test(content)) {
      return { route: 'architect', type: 'skill', name: 'Architect', modelHint: 'coder' };
    }
    if (/\b(plan|roadmap|milestone|phase|break\s*down)\b/i.test(content)) {
      return { route: 'planner', type: 'skill', name: 'Planner', modelHint: 'auto' };
    }

    // ── LLM-based routing for ambiguous cases ──
    // Only include top skills/agents to keep the classifier prompt small and fast
    const topSkills = SKILLS.filter((s) =>
      ['fullstack-dev', 'code-review', 'tdd', 'security', 'architect', 'writer', 'researcher', 'devops', 'planner', 'image-generation', 'web-search', 'python-patterns', 'rust-patterns', 'golang-patterns', 'frontend-patterns', 'backend-patterns', 'api-design'].includes(s.id)
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

    const ai = await AIClient.create('auto');
    const completion = await ai.chat({
      messages: [
        { role: 'system', content: classifierPrompt },
        { role: 'user', content: lastUserMsg.content.slice(0, 500) },
      ],
      temperature: 0,
      max_tokens: 30,
    });

    let rawRoute = (completion?.choices?.[0]?.message?.content || 'general').trim().toLowerCase();
    rawRoute = rawRoute.replace(/^["'`]+|["'`]+$/g, '');

    const isSkill = SKILLS.some((s) => s.id === rawRoute);
    const isAgent = AGENTS.some((a) => a.id === rawRoute);

    if (isSkill) {
      const s = SKILLS.find((s) => s.id === rawRoute)!;
      const modelHint: 'auto' | 'coder' = ['fullstack-dev', 'code-review', 'tdd', 'security', 'architect', 'python-patterns', 'rust-patterns', 'golang-patterns', 'frontend-patterns', 'backend-patterns', 'api-design'].includes(rawRoute) ? 'coder' : 'auto';
      return { route: rawRoute, type: 'skill', name: s.name, modelHint };
    } else if (isAgent) {
      const a = AGENTS.find((a) => a.id === rawRoute)!;
      const modelHint: 'auto' | 'coder' = ['architecture', 'review', 'build', 'security', 'quality', 'testing'].includes(a.category) ? 'coder' : 'auto';
      return { route: rawRoute, type: 'agent', name: a.name, modelHint };
    }

    return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
  } catch (e) {
    console.error('[AutoRoute Error]', e instanceof Error ? e.message : 'Unknown');
    return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
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
    if (!db) return; // No database available (e.g. Vercel without DB)
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
  // ── Build a COMPACT skills/agents summary (NOT full listing — saves tokens for response) ──
  // Count skills per category for a brief overview
  const skillCounts: Record<string, number> = {};
  for (const s of SKILLS) {
    skillCounts[s.category] = (skillCounts[s.category] || 0) + 1;
  }
  const agentCounts: Record<string, number> = {};
  for (const a of AGENTS) {
    agentCounts[a.category] = (agentCounts[a.category] || 0) + 1;
  }

  // One-line category summary instead of listing every skill
  const skillSummary = Object.entries(skillCounts)
    .map(([cat, count]) => `${cat}(${count})`)
    .join(', ');

  const agentSummary = Object.entries(agentCounts)
    .map(([cat, count]) => `${cat}(${count})`)
    .join(', ');

  // Top skills the AI should know about by name (most commonly requested)
  const topSkillNames = 'fullstack-dev, python-patterns, rust-patterns, golang-patterns, frontend-patterns, backend-patterns, code-review, tdd, security, architect, writer, researcher, planner, devops, api-design, database-migrations, docker-patterns, e2e-testing, image-generation, web-search';

  const base = `You are Z, a powerful personal AI assistant. You are NOT ChatGPT, NOT OpenAI, NOT GPT — you are Z.

Identity: Z | Expert AI Assistant | 227 skills | 47 agents
Skills by category: ${skillSummary}
Agents by category: ${agentSummary}
Key skills: ${topSkillNames}

Rules:
- Say "I am Z" if asked who you are. NEVER claim to be ChatGPT/GPT/OpenAI.
- CODING: Write complete, working code with imports, types, error handling. Show FULL code blocks, not snippets. Never cut off mid-code.
- WRITING: Rich, detailed content. 3-5+ sentences per paragraph.
- RESEARCH: Evidence-based analysis with specific details.
- ALWAYS give COMPLETE answers. If writing code, include the FULL implementation.
- When code is long, use multiple code blocks instead of truncating.`;

  let extra = '';

  // Load skill instructions
  if (skill) {
    // Extended skill map with much richer instructions
    const skillMap: Record<string, string> = {
      'code-review': `

═══ CODE REVIEW MODE ═══
You are performing expert code review. For every piece of code:
1. SECURITY: Check for injection, auth bypass, data leaks, OWASP Top 10
2. PERFORMANCE: Check for N+1 queries, memory leaks, unnecessary re-renders, O(n^2) algorithms
3. QUALITY: Check for error handling, edge cases, naming, DRY violations
4. MAINTAINABILITY: Check for proper typing, documentation, separation of concerns
5. CORRECTNESS: Check for race conditions, null pointer errors, off-by-one errors

Format findings as:
[SEVERITY: CRITICAL/HIGH/MEDIUM/LOW] Issue description
→ Suggested fix with code example`,

      'tdd': `

═══ TDD MODE ═══
You are using Test-Driven Development. Follow this workflow:
1. RED: Write a failing test that describes the desired behavior
2. GREEN: Write the minimal code to make the test pass
3. REFACTOR: Improve the code while keeping tests green
4. Target 80%+ test coverage
5. Use descriptive test names: "should [expected behavior] when [condition]"
6. Test edge cases: null, undefined, empty, boundary values, error states`,

      'architect': `

═══ ARCHITECT MODE ═══
You are designing system architecture. Address:
1. REQUIREMENTS: Functional and non-functional requirements
2. HIGH-LEVEL DESIGN: Component diagram, data flow, API boundaries
3. TECHNOLOGY SELECTION: Justify choices with trade-offs
4. SCALABILITY: Horizontal/vertical scaling, caching, load balancing
5. RELIABILITY: Error handling, retry logic, circuit breakers, graceful degradation
6. SECURITY: Authentication, authorization, data encryption, audit logging
7. PERFORMANCE: Latency targets, throughput, resource utilization
8. ARCHITECTURE DECISION RECORDS (ADR): Document key decisions with context, decision, and consequences`,

      'security': `

═══ SECURITY MODE ═══
You are performing security analysis. Check for:
1. INJECTION: SQL injection, XSS, command injection, LDAP injection
2. AUTH: Broken authentication, session management, credential stuffing
3. DATA EXPOSURE: Sensitive data in logs, URLs, error messages, client-side storage
4. ACCESS CONTROL: IDOR, privilege escalation, missing authorization checks
5. CRYPTO: Weak algorithms, hardcoded keys, improper IV usage, timing attacks
6. DEPENDENCIES: Known CVEs, outdated packages, supply chain risks
7. CONFIGURATION: Default credentials, open ports, debug endpoints, CORS misconfiguration
8. Rate severity: CRITICAL (data breach risk) > HIGH (auth bypass) > MEDIUM (info leak) > LOW (best practice)`,

      'planner': `

═══ PLANNER MODE ═══
You are creating an implementation plan. Structure:
1. OBJECTIVE: Clear, measurable goal
2. PHASES: Break into 2-5 phases with dependencies
3. TASKS: Each phase has specific, actionable tasks with acceptance criteria
4. RISKS: Identify risks and mitigation strategies
5. ESTIMATES: Rough effort estimates for each phase
6. ORDER: Explicit task ordering with what blocks what`,

      'writer': `

═══ WRITER MODE ═══
You are creating written content. Guidelines:
1. STRUCTURE: Clear intro, well-organized body, meaningful conclusion
2. DEPTH: Every paragraph must be 3-5+ sentences. No shallow content.
3. ENGAGEMENT: Hook the reader, maintain interest, deliver value
4. TONE: Adapt to the audience — professional, casual, technical, or creative
5. EXAMPLES: Include specific examples, data points, or case studies
6. CLARITY: Explain complex concepts simply without dumbing down`,

      'researcher': `

═══ RESEARCHER MODE ═══
You are conducting research. Approach:
1. QUESTION: Clearly define what you're investigating
2. SOURCES: Cite specific evidence and data points
3. ANALYSIS: Compare perspectives, identify patterns, highlight contradictions
4. SYNTHESIS: Draw conclusions supported by evidence
5. RECOMMENDATIONS: Provide actionable next steps
6. LIMITATIONS: Acknowledge what you don't know or can't verify`,

      'fullstack-dev': `

═══ FULLSTACK DEVELOPMENT MODE ═══
You are a fullstack expert. Write production-quality code following these rules:
1. TYPESCRIPT FIRST: Always use TypeScript with proper types, interfaces, and generics
2. MODERN REACT: Use function components, hooks, Server Components where appropriate
3. NEXT.JS PATTERNS: App Router, Server Actions, streaming, proper data fetching
4. API DESIGN: RESTful, proper status codes, error responses, input validation
5. DATABASE: Use Prisma/Drizzle with proper schema, migrations, and queries
6. ERROR HANDLING: Try-catch, proper error types, user-friendly messages
7. SECURITY: Input validation, sanitization, parameterized queries, CORS
8. PERFORMANCE: Lazy loading, code splitting, caching, optimistic updates
9. Include COMPLETE working code — imports, types, exports, everything needed to run
10. Always explain the approach before showing code`,

      'python-patterns': `

═══ PYTHON DEVELOPMENT MODE ═══
You are a Python expert. Write idiomatic, production-quality Python:
1. PEP 8: Follow style guide, use type hints, docstrings
2. PATTERNS: Use dataclasses, enums, protocols, context managers, generators
3. ASYNC: Use asyncio for I/O-bound, multiprocessing for CPU-bound
4. ERROR HANDLING: Custom exceptions, proper exception chaining, logging
5. TESTING: pytest with fixtures, parametrize, mock where needed
6. PACKAGING: pyproject.toml, proper dependency management, virtual environments
7. Include complete working code with imports and type hints`,

      'rust-patterns': `

═══ RUST DEVELOPMENT MODE ═══
You are a Rust expert. Write safe, idiomatic Rust:
1. OWNERSHIP: Proper borrow checker usage, lifetimes where needed
2. ERROR HANDLING: Result<T,E>, thiserror/anyhow, never panic in libraries
3. CONCURRENCY: Send/Sync traits, channels, async with tokio
4. PATTERNS: Builder pattern, newtype, trait objects, generics with trait bounds
5. TESTING: #[test], #[tokio::test], property-based testing with proptest
6. Include complete working code with proper Cargo.toml dependencies`,

      'golang-patterns': `

═══ GO DEVELOPMENT MODE ═══
You are a Go expert. Write idiomatic, production-quality Go:
1. IDIOMS: Effective Go patterns, proper error handling, context propagation
2. CONCURRENCY: Goroutines, channels, select, sync primitives
3. INTERFACES: Small, focused interfaces, composition over inheritance
4. TESTING: Table-driven tests, testify assertions, integration tests
5. PROJECT: Proper package structure, go modules, dependency injection
6. Include complete working code with proper module declarations`,

      'frontend-patterns': `

═══ FRONTEND DEVELOPMENT MODE ═══
You are a frontend expert. Write modern, performant UI code:
1. REACT: Hooks, Server Components, proper state management, memoization
2. STYLING: Tailwind CSS, responsive design, dark mode support
3. PERFORMANCE: Code splitting, lazy loading, image optimization, Lighthouse scores
4. ACCESSIBILITY: ARIA attributes, keyboard navigation, screen reader support
5. TYPESCRIPT: Strict mode, proper component types, generic components
6. Include complete working components with types and styling`,

      'backend-patterns': `

═══ BACKEND DEVELOPMENT MODE ═══
You are a backend expert. Write scalable, reliable server code:
1. API DESIGN: RESTful, versioned, proper HTTP methods and status codes
2. DATABASE: Connection pooling, query optimization, transactions, migrations
3. AUTH: JWT, OAuth2, session management, RBAC
4. MIDDLEWARE: Logging, rate limiting, CORS, request validation
5. ERROR HANDLING: Centralized error handler, proper error responses
6. Include complete working code with proper error handling and types`,
    };

    if (skillMap[skill]) {
      extra += skillMap[skill];
    } else {
      try {
        const skillContent = await getSkillContent(skill);
        if (skillContent) {
          extra += `\n\n[ACTIVE SKILL: ${skill}]\n${skillContent.slice(0, 4000)}`;
        }
      } catch {
        const skillInfo = SKILLS.find((s) => s.id === skill);
        const categoryHints: Record<string, string> = {
          'ai-core': '\n\nAI CORE mode: Focus on AI/ML implementation, model integration, and LLM patterns.',
          'blockchain': '\n\nBLOCKCHAIN mode: Focus on Web3, smart contracts, and cryptographic correctness.',
          'communication': '\n\nCOMMUNICATION mode: Focus on email, messaging, and notification workflows.',
          'data': '\n\nDATA mode: Focus on databases, analytics, data pipelines, and visualization.',
          'design': '\n\nDESIGN mode: Focus on UI/UX, visual systems, and frontend aesthetics.',
          'development': '\n\nDEVELOPMENT mode: Focus on code quality, patterns, and best practices. Write production-quality code with proper error handling and types.',
          'devops': '\n\nDEVOPS mode: Focus on CI/CD, deployment, monitoring, and automation.',
          'education': '\n\nEDUCATION mode: Focus on learning, documentation, and knowledge sharing.',
          'finance': '\n\nFINANCE mode: Focus on financial data, billing, markets, and compliance.',
          'health': '\n\nHEALTH mode: Focus on healthcare, wellness, and clinical safety.',
          'marketing': '\n\nMARKETING mode: Focus on growth, outreach, lead generation, and social strategy.',
          'media': '\n\nMEDIA mode: Focus on image, video, and audio generation and processing.',
          'operations': '\n\nOPERATIONS mode: Focus on business operations, logistics, and efficiency.',
          'productivity': '\n\nPRODUCTIVITY mode: Focus on workflow optimization and automation.',
          'research': '\n\nRESEARCH mode: Focus on deep investigation, evidence gathering, and analysis.',
          'security': '\n\nSECURITY mode: Focus on vulnerability detection, compliance, and secure coding.',
          'writing': '\n\nWRITING mode: Focus on content creation, editing, and communication. Write rich, detailed, engaging content.',
        };
        if (skillInfo) {
          extra += categoryHints[skillInfo.category] || `\n\nYou are operating with the "${skill}" skill activated. Apply its specialized knowledge and patterns.`;
        }
      }
    }
  }

  // Load agent instructions
  if (agent) {
    try {
      const agentContent = await getAgentContent(agent);
      if (agentContent) {
        extra += `\n\n[ACTIVE AGENT: ${agent}]\n${agentContent.slice(0, 4000)}`;
      }
    } catch {
      const agentInfo = AGENTS.find((a) => a.id === agent);
      const agentCategoryHints: Record<string, string> = {
        'architecture': '\n\nYou are acting as an architecture specialist agent. Focus on system design, scalability, and technical decisions.',
        'review': '\n\nYou are acting as a code review agent. Focus on quality, security, and maintainability. Provide specific, actionable feedback.',
        'build': '\n\nYou are acting as a build/fix agent. Focus on resolving errors with minimal diffs. Identify root cause, apply targeted fix, verify.',
        'security': '\n\nYou are acting as a security agent. Detect vulnerabilities and recommend remediation. Prioritize by severity.',
        'quality': '\n\nYou are acting as a quality agent. Focus on code clarity, consistency, and correctness.',
        'testing': '\n\nYou are acting as a testing agent. Focus on test coverage, TDD methodology, and behavioral testing.',
        'docs': '\n\nYou are acting as a documentation agent. Focus on clarity, accuracy, and completeness.',
        'operations': '\n\nYou are acting as an operations agent. Focus on business workflows and efficiency.',
        'infrastructure': '\n\nYou are acting as an infrastructure agent. Focus on reliability, cost optimization, and system configuration.',
      };
      if (agentInfo) {
        extra += agentCategoryHints[agentInfo.category] || `\n\nYou are operating as the "${agent}" agent. Apply its specialized capabilities.`;
      }
    }
  }

  return base + extra;
}
