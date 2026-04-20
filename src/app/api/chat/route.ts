import { NextRequest } from 'next/server';
import { AIClient } from '@/lib/ai-provider';
import { db } from '@/lib/db';
import { SKILLS } from '@/lib/skills';
import { AGENTS } from '@/lib/agents';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Check if a value is async iterable (stream)
function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown> {
  return obj != null && typeof (obj as Record<string, unknown>)[Symbol.asyncIterator] === 'function';
}

// ── Fast keyword-based skill/agent routing (NO LLM call — instant) ──
function fastRoute(content: string): { route: string; type: 'skill' | 'agent' | 'none'; name: string; modelHint: 'auto' | 'coder' } {
  const c = content.toLowerCase();

  // Simple greetings — skip routing
  if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|sup|yo|what'?s\s*up|hola)[\s!.?]*$/i.test(c)) {
    return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
  }
  if (content.length < 10 && /^(thanks|thank you|ok|okay|bye|goodbye|sure|yes|no|maybe)[\s!.?]*$/i.test(c)) {
    return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
  }

  // Image generation
  if (/\b(generate|create|draw|make)\b.*\b(image|picture|photo|illustration|artwork|logo|icon)\b/.test(c)) {
    return { route: 'image-generation', type: 'skill', name: 'Image Generation', modelHint: 'auto' };
  }

  // Web search
  if (/^\s*(search|find|look up|google)\b/i.test(c) || /\bweb\s*search\b/i.test(c)) {
    return { route: 'web-search', type: 'skill', name: 'Web Search', modelHint: 'auto' };
  }

  // ── Code-related routing ──
  const isCode = /\b(code|coding|program|function|script|debug|fix bug|refactor|typescript|javascript|python|java|rust|go\s*lang|react|next\.?js|node\.?js|api|html|css|sql|database|git|npm|yarn|pip|cargo|component|hook|render|async|await|class|interface|type|array|error|exception|compile|build|deploy|server|client|frontend|backend|fullstack|algorithm|leetcode|docker|kubernetes|prisma|drizzle|tailwind|express|fastapi|django|flask|spring|kotlin|swift|dart|flutter|cpp|c\+\+|perl|php|laravel|vue|svelte|angular)\b/i.test(c);

  if (isCode) {
    // Specific language/framework routing
    if (/\b(review|code\s*review)\b/i.test(c)) return { route: 'code-review', type: 'skill', name: 'Code Review', modelHint: 'coder' };
    if (/\b(security|vulnerability|exploit|hack)\b/i.test(c)) return { route: 'security', type: 'skill', name: 'Security', modelHint: 'coder' };
    if (/\b(test|testing|unit\s*test|tdd|pytest|jest)\b/i.test(c)) return { route: 'tdd', type: 'skill', name: 'TDD / Testing', modelHint: 'coder' };
    if (/\b(python|django|flask|pytest|pip|fastapi|pytorch)\b/i.test(c)) return { route: 'python-patterns', type: 'skill', name: 'Python Development', modelHint: 'coder' };
    if (/\b(rust|cargo|borrow|ownership|lifetime)\b/i.test(c)) return { route: 'rust-patterns', type: 'skill', name: 'Rust Development', modelHint: 'coder' };
    if (/\b(golang|go\s*lang|goroutine|channel|go\s*mod)\b/i.test(c)) return { route: 'golang-patterns', type: 'skill', name: 'Go Development', modelHint: 'coder' };
    if (/\b(java|spring|jpa|hibernate|maven|gradle)\b/i.test(c)) return { route: 'springboot-patterns', type: 'skill', name: 'Spring Boot', modelHint: 'coder' };
    if (/\b(kotlin|android|jetpack|compose)\b/i.test(c)) return { route: 'kotlin-patterns', type: 'skill', name: 'Kotlin Development', modelHint: 'coder' };
    if (/\b(c\+\+|cmake|clang)\b/i.test(c)) return { route: 'cpp-coding-standards', type: 'skill', name: 'C++ Coding', modelHint: 'coder' };
    if (/\b(swift|ios|swiftui|xcode)\b/i.test(c)) return { route: 'swiftui-patterns', type: 'skill', name: 'SwiftUI', modelHint: 'coder' };
    if (/\b(laravel|php|artisan|blade|eloquent)\b/i.test(c)) return { route: 'laravel-patterns', type: 'skill', name: 'Laravel', modelHint: 'coder' };
    if (/\b(flutter|dart|widget|pub)\b/i.test(c)) return { route: 'dart-flutter-patterns', type: 'skill', name: 'Flutter/Dart', modelHint: 'coder' };
    if (/\b(perl|cpan)\b/i.test(c)) return { route: 'perl-patterns', type: 'skill', name: 'Perl', modelHint: 'coder' };
    if (/\b(database|sql|postgres|mysql|prisma|drizzle|query|schema|migration)\b/i.test(c)) return { route: 'postgres-patterns', type: 'skill', name: 'Database', modelHint: 'coder' };
    if (/\b(docker|kubernetes|deploy|ci.?cd|github\s*actions|terraform)\b/i.test(c)) return { route: 'docker-patterns', type: 'skill', name: 'DevOps', modelHint: 'coder' };
    if (/\b(api|rest|graphql|endpoint|route)\b/i.test(c)) return { route: 'api-design', type: 'skill', name: 'API Design', modelHint: 'coder' };
    if (/\b(architect|design\s*system|system\s*design|scalability|microservice)\b/i.test(c)) return { route: 'architect', type: 'skill', name: 'Architect', modelHint: 'coder' };
    if (/\b(typescript|react|next\.?js|node\.?js|tsx|jsx|npm|yarn|vite|webpack|tailwind|vue|svelte|angular)\b/i.test(c)) return { route: 'fullstack-dev', type: 'skill', name: 'Fullstack Development', modelHint: 'coder' };

    // Generic code request
    return { route: 'fullstack-dev', type: 'skill', name: 'Fullstack Development', modelHint: 'coder' };
  }

  // ── Non-coding routing ──
  if (/\b(write|essay|article|blog|content|email|letter|copy|draft|compose)\b/i.test(c)) return { route: 'writer', type: 'skill', name: 'Writer', modelHint: 'auto' };
  if (/\b(analyz|research|investigate|study|compare|market|competitor)\b/i.test(c)) return { route: 'researcher', type: 'skill', name: 'Researcher', modelHint: 'auto' };
  if (/\b(plan|roadmap|milestone|phase|break\s*down|strategy)\b/i.test(c)) return { route: 'planner', type: 'skill', name: 'Planner', modelHint: 'auto' };
  if (/\b(design|ui|ux|figma|wireframe|prototype)\b/i.test(c)) return { route: 'design-system', type: 'skill', name: 'Design System', modelHint: 'auto' };
  if (/\b(finance|stock|investment|crypto|bitcoin|trading)\b/i.test(c)) return { route: 'finance', type: 'skill', name: 'Finance', modelHint: 'auto' };
  if (/\b(health|medical|clinical|patient|diagnosis)\b/i.test(c)) return { route: 'healthcare', type: 'skill', name: 'Healthcare', modelHint: 'auto' };
  if (/\b(seo|search\s*engine|ranking|keyword|optimization)\b/i.test(c)) return { route: 'seo', type: 'skill', name: 'SEO', modelHint: 'auto' };

  return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
}

// ── Build system prompt ──
// COMPACT but EFFECTIVE — designed so the model ACTUALLY follows the skill instructions
function buildSystemPrompt(skill?: string, agent?: string): string {
  const skillCounts: Record<string, number> = {};
  for (const s of SKILLS) skillCounts[s.category] = (skillCounts[s.category] || 0) + 1;
  const totalSkills = SKILLS.length;
  const totalAgents = AGENTS.length;

  // Base identity — SHORT so there's room for skill instructions AND the response
  let prompt = `You are Z, a powerful personal AI assistant with ${totalSkills} skills and ${totalAgents} agents. You are NOT ChatGPT, NOT GPT, NOT OpenAI — you are Z. Always say "I am Z" if asked who you are.

CORE RULES (FOLLOW THESE EXACTLY):
1. Give COMPLETE answers. NEVER truncate or cut off mid-code.
2. For CODE: Write full working implementations with imports, types, error handling. Use multiple code blocks if needed. NEVER write partial code.
3. For WRITING: Rich paragraphs of 3-5+ sentences. No shallow content.
4. For ANALYSIS: Evidence-based with specific details, data, and examples.
5. When you activate a skill, FULLY apply its methodology — do not ignore it.`;

  // Add skill-specific instructions
  if (skill && skill !== 'general') {
    prompt += '\n\n' + getSkillInstructions(skill);
  }

  if (agent) {
    prompt += '\n\n' + getAgentInstructions(agent);
  }

  return prompt;
}

function getSkillInstructions(skill: string): string {
  const map: Record<string, string> = {
    'fullstack-dev': `═══ FULLSTACK DEVELOPMENT ACTIVATED ═══
You MUST write production-quality code following these rules:
- TypeScript FIRST with proper types, interfaces, generics
- Modern React: function components, hooks, Server Components
- Next.js App Router patterns: proper data fetching, Server Actions, streaming
- API: RESTful design, proper status codes, input validation, error responses
- Database: Prisma/Drizzle with proper schema, migrations, queries
- Error handling: try-catch, proper error types, user-friendly messages
- Security: input validation, sanitization, parameterized queries
- Performance: lazy loading, code splitting, caching, optimistic updates
- ALWAYS show COMPLETE working code with ALL imports, types, exports needed to run
- Explain your approach BEFORE showing code
- If the code is long, split into MULTIPLE code blocks (one per file) — NEVER truncate`,

    'python-patterns': `═══ PYTHON DEVELOPMENT ACTIVATED ═══
Write idiomatic, production-quality Python:
- PEP 8 style, type hints, docstrings on all public functions
- Use dataclasses, enums, protocols, context managers, generators where appropriate
- Async: asyncio for I/O-bound, multiprocessing for CPU-bound work
- Error handling: custom exceptions, proper exception chaining, logging
- Testing: pytest with fixtures, parametrize, mock where needed
- Packaging: pyproject.toml, proper dependency management
- Show COMPLETE working code with imports and type hints
- Never truncate — split into multiple code blocks if needed`,

    'rust-patterns': `═══ RUST DEVELOPMENT ACTIVATED ═══
Write safe, idiomatic Rust:
- Ownership: proper borrow checker usage, lifetimes where needed
- Error handling: Result<T,E>, thiserror/anyhow, never panic in libraries
- Concurrency: Send/Sync, channels, async with tokio
- Patterns: Builder, newtype, trait objects, generics with trait bounds
- Testing: #[test], #[tokio::test], property-based testing
- Show complete working code with Cargo.toml dependencies
- Never truncate — split into multiple code blocks if needed`,

    'golang-patterns': `═══ GO DEVELOPMENT ACTIVATED ═══
Write idiomatic, production-quality Go:
- Effective Go patterns, proper error handling, context propagation
- Concurrency: goroutines, channels, select, sync primitives
- Small, focused interfaces, composition over inheritance
- Table-driven tests, testify assertions, integration tests
- Proper package structure, go modules
- Show complete working code with module declarations
- Never truncate — split into multiple code blocks if needed`,

    'code-review': `═══ CODE REVIEW ACTIVATED ═══
Perform expert code review on every piece of code:
1. SECURITY: Injection, auth bypass, data leaks, OWASP Top 10
2. PERFORMANCE: N+1 queries, memory leaks, O(n²) algorithms
3. QUALITY: Error handling, edge cases, naming, DRY violations
4. MAINTAINABILITY: Typing, documentation, separation of concerns
5. CORRECTNESS: Race conditions, null pointers, off-by-one errors
Format: [SEVERITY: CRITICAL/HIGH/MEDIUM/LOW] Issue → Fix with code example`,

    'tdd': `═══ TEST-DRIVEN DEVELOPMENT ACTIVATED ═══
Follow TDD workflow strictly:
1. RED: Write a failing test describing desired behavior
2. GREEN: Write minimal code to make test pass
3. REFACTOR: Improve while keeping tests green
- Target 80%+ test coverage
- Use descriptive names: "should [expected] when [condition]"
- Test edge cases: null, undefined, empty, boundary, error states
- Show COMPLETE test files AND implementation files`,

    'security': `═══ SECURITY ANALYSIS ACTIVATED ═══
Check for:
1. INJECTION: SQL, XSS, command, LDAP injection
2. AUTH: Broken authentication, session management
3. DATA EXPOSURE: Sensitive data in logs, URLs, errors
4. ACCESS CONTROL: IDOR, privilege escalation
5. CRYPTO: Weak algorithms, hardcoded keys
6. DEPENDENCIES: Known CVEs, outdated packages
7. CONFIG: Default credentials, open ports, CORS
Rate: CRITICAL (breach risk) > HIGH (auth bypass) > MEDIUM (info leak) > LOW (best practice)`,

    'architect': `═══ ARCHITECT MODE ACTIVATED ═══
Design system architecture:
1. REQUIREMENTS: Functional and non-functional
2. HIGH-LEVEL: Component diagram, data flow, API boundaries
3. TECHNOLOGY: Justify choices with trade-offs
4. SCALABILITY: Horizontal/vertical, caching, load balancing
5. RELIABILITY: Error handling, retries, circuit breakers
6. SECURITY: Auth, encryption, audit logging
7. ADRs: Document key decisions with context and consequences`,

    'planner': `═══ PLANNER MODE ACTIVATED ═══
Create implementation plans:
1. OBJECTIVE: Clear, measurable goal
2. PHASES: 2-5 phases with dependencies
3. TASKS: Specific, actionable with acceptance criteria
4. RISKS: Identify and mitigate
5. ESTIMATES: Effort per phase
6. ORDER: Task ordering with blockers`,

    'writer': `═══ WRITER MODE ACTIVATED ═══
Create written content:
- STRUCTURE: Clear intro, organized body, meaningful conclusion
- DEPTH: Every paragraph 3-5+ sentences. No shallow content.
- ENGAGEMENT: Hook the reader, maintain interest
- TONE: Adapt to audience — professional, casual, technical, creative
- EXAMPLES: Specific data points, case studies, evidence
- CLARITY: Explain complex concepts simply`,

    'researcher': `═══ RESEARCHER MODE ACTIVATED ═══
Conduct thorough research:
1. QUESTION: Define what you're investigating
2. SOURCES: Cite specific evidence and data
3. ANALYSIS: Compare perspectives, identify patterns
4. SYNTHESIS: Evidence-supported conclusions
5. RECOMMENDATIONS: Actionable next steps
6. LIMITATIONS: Acknowledge unknowns`,

    'frontend-patterns': `═══ FRONTEND DEVELOPMENT ACTIVATED ═══
Write modern, performant UI code:
- React: Hooks, Server Components, state management, memoization
- Styling: Tailwind CSS, responsive, dark mode
- Performance: Code splitting, lazy loading, image optimization
- Accessibility: ARIA, keyboard nav, screen readers
- TypeScript: Strict mode, proper component types
- Show COMPLETE working components with types and styling`,

    'backend-patterns': `═══ BACKEND DEVELOPMENT ACTIVATED ═══
Write scalable server code:
- API: RESTful, versioned, proper HTTP methods/status codes
- Database: Connection pooling, query optimization, transactions
- Auth: JWT, OAuth2, session management, RBAC
- Middleware: Logging, rate limiting, CORS, validation
- Errors: Centralized handler, proper error responses
- Show COMPLETE working code with error handling and types`,

    'api-design': `═══ API DESIGN ACTIVATED ═══
Design RESTful APIs:
- Resource naming, proper HTTP methods, status codes
- Pagination, filtering, sorting for collections
- Error response format, versioning strategy
- Rate limiting, authentication requirements
- OpenAPI/Swagger documentation
- Show COMPLETE endpoint implementations with types`,

    'postgres-patterns': `═══ DATABASE DEVELOPMENT ACTIVATED ═══
Write optimized database code:
- Schema design: normalization, indexing, constraints
- Queries: JOINs, subqueries, CTEs, window functions
- Migrations: safe schema changes, rollback strategies
- Performance: EXPLAIN ANALYZE, index optimization
- Prisma/Drizzle: proper models, queries, transactions
- Show COMPLETE schema, migrations, and query code`,

    'docker-patterns': `═══ DEVOPS/DOCKER ACTIVATED ═══
Write deployment configurations:
- Docker: multi-stage builds, minimal images, health checks
- Docker Compose: service orchestration, networking, volumes
- CI/CD: GitHub Actions, automated testing, deployment
- Kubernetes: deployments, services, ingress, configmaps
- Security: image scanning, least privilege, secret management
- Show COMPLETE Dockerfiles, compose files, CI configs`,

    'springboot-patterns': `═══ SPRING BOOT DEVELOPMENT ACTIVATED ═══
Write production Spring Boot:
- Layered architecture: Controller → Service → Repository
- Dependency injection, proper bean scoping
- JPA/Hibernate: entity design, queries, transactions
- REST: proper response types, validation, error handling
- Security: Spring Security, JWT, method-level authorization
- Testing: @SpringBootTest, MockMvc, Testcontainers
- Show COMPLETE Java code with proper annotations`,

    'kotlin-patterns': `═══ KOTLIN DEVELOPMENT ACTIVATED ═══
Write idiomatic Kotlin:
- Null safety, data classes, sealed classes, extensions
- Coroutines: structured concurrency, Flow, Channels
- Android: Jetpack Compose, ViewModel, Room
- Testing: Kotest, MockK, coroutine testing
- Show COMPLETE working code with proper Kotlin idioms`,

    'dart-flutter-patterns': `═══ FLUTTER/DART DEVELOPMENT ACTIVATED ═══
Write production Flutter/Dart:
- Null safety, immutable state, async composition
- BLoC/Riverpod state management
- GoRouter navigation, Dio networking
- Widget architecture, responsive design
- Show COMPLETE working widgets with state management`,

    'cpp-coding-standards': `═══ C++ DEVELOPMENT ACTIVATED ═══
Write modern, safe C++:
- C++17/20 features: smart pointers, std::optional, structured bindings
- RAII, rule of five, move semantics
- Templates with concepts, constexpr where possible
- Error handling: exceptions, std::expected (C++23)
- Testing: GoogleTest/CTest, CMake configuration
- Show COMPLETE working code with proper CMake setup`,

    'swiftui-patterns': `═══ SWIFT/SWIFTUI DEVELOPMENT ACTIVATED ═══
Write modern Swift/SwiftUI:
- Swift concurrency: async/await, actors, Sendable
- SwiftUI: declarative views, environment, observation
- Data flow: @Observable, @Bindable, .environment
- Testing: Swift Testing framework, XCTest
- Show COMPLETE working code with proper Swift concurrency`,

    'laravel-patterns': `═══ LARAVEL DEVELOPMENT ACTIVATED ═══
Write production Laravel:
- Architecture: Service layer, repositories, form requests
- Eloquent: relationships, scopes, accessors/mutators
- Routes: resource controllers, middleware, API routes
- Testing: PHPUnit/Pest, factories, database assertions
- Show COMPLETE working code with proper Laravel patterns`,

    'perl-patterns': `═══ PERL DEVELOPMENT ACTIVATED ═══
Write modern Perl 5.36+:
- Use strict/warnings, signatures, postfix dereference
- Moose/Moo for OOP, Type::Tiny for validation
- Testing: Test2::V0, Test::More, prove
- Show COMPLETE working code with proper Perl idioms`,

    'design-system': `═══ DESIGN SYSTEM ACTIVATED ═══
Create and audit design systems:
- Visual consistency: colors, typography, spacing, borders
- Component architecture: variants, states, composition
- Token system: design tokens, theme variables
- Accessibility: WCAG compliance, contrast ratios
- Documentation: usage guidelines, do/don't examples`,

    'finance': `═══ FINANCE ANALYSIS ACTIVATED ═══
Provide financial analysis:
- Market data: stock prices, financials, fundamentals
- Investment analysis: valuation, risk, returns
- Portfolio: allocation, diversification, rebalancing
- Regulations: compliance, reporting requirements
- Always include disclaimers about financial advice`,

    'seo': `═══ SEO OPTIMIZATION ACTIVATED ═══
Optimize for search engines:
- Technical: Core Web Vitals, crawlability, indexing
- On-page: meta tags, headings, structured data, keywords
- Content: quality signals, E-E-A-T, topical authority
- Architecture: sitemaps, robots.txt, internal linking
- Provide specific, actionable recommendations with code examples`,

    'image-generation': `═══ IMAGE GENERATION ACTIVATED ═══
Help create visual content:
- Describe the image generation process
- Provide detailed prompts for image generation
- Explain design principles and composition
- Suggest styles, techniques, and approaches`,

    'web-search': `═══ WEB SEARCH ACTIVATED ═══
Help with web research:
- Formulate effective search queries
- Analyze and synthesize search results
- Verify information from multiple sources
- Cite sources and provide evidence`,
  };

  return map[skill] || `═══ ${skill.toUpperCase()} SKILL ACTIVATED ═══
Apply your expert knowledge of this domain. Give complete, detailed, professional responses. Never truncate.`;
}

function getAgentInstructions(agent: string): string {
  const map: Record<string, string> = {
    'architecture': `You are the Architecture Agent. Focus on system design, scalability, and technical decisions. Provide component diagrams, data flow, and trade-off analysis.`,
    'review': `You are the Code Review Agent. Focus on quality, security, and maintainability. Give specific, actionable feedback with severity ratings.`,
    'build': `You are the Build/Fix Agent. Focus on resolving errors with minimal diffs. Identify root cause → apply targeted fix → verify solution works.`,
    'security': `You are the Security Agent. Detect vulnerabilities and recommend remediation. Prioritize by severity: CRITICAL > HIGH > MEDIUM > LOW.`,
    'quality': `You are the Quality Agent. Focus on code clarity, consistency, and correctness. Enforce coding standards and best practices.`,
    'testing': `You are the Testing Agent. Focus on test coverage, TDD methodology, and behavioral testing. Write comprehensive test suites.`,
    'docs': `You are the Documentation Agent. Focus on clarity, accuracy, and completeness. Write professional documentation.`,
    'operations': `You are the Operations Agent. Focus on business workflows and operational efficiency.`,
    'infrastructure': `You are the Infrastructure Agent. Focus on reliability, cost optimization, and system configuration.`,
  };

  return map[agent] || `You are the ${agent} agent. Apply its specialized capabilities. Give complete, professional responses.`;
}

// ── Main POST handler ──
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const sse = (controller: ReadableStreamDefaultController, data: Record<string, unknown>) => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch { /* controller may be closed */ }
  };

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = '';
      let usageData: Record<string, number> | undefined;

      try {
        // ── 1. Parse request ──
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

        // ── 2. Send thinking status ──
        sse(controller, { status: 'thinking', content: '', done: false });

        // ── 3. Fast route (keyword-based, instant, no LLM call) ──
        let skill = explicitSkill || undefined;
        let agent = explicitAgent || undefined;
        let routeName = '';
        let routeModelHint: 'auto' | 'coder' = 'auto';

        if (!skill && !agent) {
          const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
          if (lastUserMsg) {
            const routeResult = fastRoute(lastUserMsg.content);
            if (routeResult.type === 'skill') {
              skill = routeResult.route;
              routeName = routeResult.name;
            } else if (routeResult.type === 'agent') {
              agent = routeResult.route;
              routeName = routeResult.name;
            }
            routeModelHint = routeResult.modelHint;
          }
        } else {
          // Explicit skill/agent — check if coding-related
          const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
          if (lastUserMsg) {
            const routeResult = fastRoute(lastUserMsg.content);
            routeModelHint = routeResult.modelHint;
          }
        }

        // Tell client which skill/agent was selected
        if (routeName) {
          sse(controller, {
            route: routeName,
            routeType: skill ? 'skill' : 'agent',
            routeId: skill || agent || '',
          });
        }

        // ── 4. Build system prompt ──
        const systemPrompt = buildSystemPrompt(skill, agent);
        const apiMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ];

        // ── 5. Stream AI completion ──
        sse(controller, { status: 'generating', content: '', done: false });

        const ai = await AIClient.create(routeModelHint);
        console.log(`[Chat] Provider: ${ai.providerName}, Model: ${ai.modelName}, Hint: ${routeModelHint}, Skill: ${skill || agent || 'general'}`);

        let completion: unknown = null;
        try {
          completion = await ai.chat({
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 8192,
            stream: true,
          });
        } catch (apiErr) {
          const errMsg = apiErr instanceof Error ? apiErr.message : 'API request failed';
          console.error(`[Chat] API error: ${errMsg}`);

          // Provide user-friendly error messages
          let userMsg = errMsg;
          if (errMsg.includes('All providers exhausted') || errMsg.includes('All') && errMsg.includes('free models are currently busy')) {
            userMsg = '🔄 All AI providers are currently busy or rate-limited.\n\nTo get UNLIMITED free access, add these FREE API keys on Vercel:\n\n1. GEMINI_API_KEY — FREE, 1500 requests/day!\n   Get it at: https://aistudio.google.com/apikey\n   (Just sign in with Google, click "Create API Key")\n\n2. GROQ_API_KEY — FREE, ultra-fast!\n   Get it at: https://console.groq.com/keys\n\nWith Gemini + Groq added, you will never run out of free requests!';
          } else if (errMsg.includes('Rate limit exceeded') || errMsg.includes('free-models-per-day')) {
            userMsg = '⏰ OpenRouter daily free limit reached (50 req/day).\n\nFix: Add GEMINI_API_KEY on Vercel for FREE unlimited access!\nGet it at: https://aistudio.google.com/apikey\n\nOr add $5 credits at https://openrouter.ai/settings/credits for 1000 free req/day.';
          } else if (errMsg.includes('Insufficient credits') || errMsg.includes('402')) {
            userMsg = '💳 Credits required for paid models. Add GEMINI_API_KEY on Vercel for FREE access (1500 req/day)!\nGet it at: https://aistudio.google.com/apikey';
          } else if (errMsg.includes('No AI providers configured')) {
            userMsg = '⚠️ No AI providers configured. Add at least one FREE API key on Vercel:\n\n• GEMINI_API_KEY — FREE, 1500 req/day → https://aistudio.google.com/apikey\n• OPENROUTER_API_KEY — Free → https://openrouter.ai/keys\n• GROQ_API_KEY — FREE, fast → https://console.groq.com/keys';
          }

          sse(controller, { error: userMsg, done: true });
          controller.close();
          return;
        }

        if (!completion) {
          sse(controller, { error: 'No response from API', done: true });
          controller.close();
          return;
        }

        // Handle non-streaming JSON response
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

        // ── 6. Parse streaming response ──
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

              if (usage) usageData = usage;

              if (finishReason === 'stop' || finishReason === 'length') {
                if (conversationId && fullContent) {
                  saveMessages(conversationId, messages, fullContent, skill || agent).catch(() => {});
                }
                // If finish_reason is 'length', the response was truncated
                // Add a note so the user knows
                const truncationNote = finishReason === 'length' ? '\n\n⚠️ Response was cut off due to length limit. Ask me to continue and I will complete the rest.' : '';
                sse(controller, { content: truncationNote, done: true, usage: usageData || { total_tokens: 0 }, finishReason });
                controller.close();
                return;
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }

          // Keepalive every 10 seconds
          if (Date.now() - lastKeepalive > 10000) {
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n'));
              lastKeepalive = Date.now();
            } catch { /* controller may be closed */ }
          }
        }

        // Stream ended normally
        if (conversationId && fullContent) {
          saveMessages(conversationId, messages, fullContent, skill || agent).catch(() => {});
        }
        sse(controller, { content: '', done: true, usage: usageData || { total_tokens: 0 } });
        controller.close();
      } catch (streamErr) {
        const errMsg = streamErr instanceof Error ? streamErr.message : 'Stream error';
        console.error('[Chat Stream Error]', errMsg);
        try { sse(controller, { error: errMsg, done: true }); } catch { /* */ }
        try { controller.close(); } catch { /* */ }
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

// ── Save messages to DB ──
async function saveMessages(
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
  assistantContent: string,
  skillName?: string | null,
) {
  try {
    if (!db) return;
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
