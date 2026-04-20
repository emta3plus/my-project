import { NextRequest } from 'next/server';
import { AIClient } from '@/lib/ai-provider';
import { db } from '@/lib/db';
import { SKILLS } from '@/lib/skills';
import { AGENTS } from '@/lib/agents';
import { getSkillContent, getAgentContent } from '@/lib/skills-loader';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Check if a value is async iterable (stream)
function isAsyncIterable(obj: unknown): obj is AsyncIterable<unknown> {
  return obj != null && typeof (obj as Record<string, unknown>)[Symbol.asyncIterator] === 'function';
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE KEYWORD ROUTING — Covers ALL 227 skills + 47 agents
// Priority: most specific patterns first → general fallbacks last
// ═══════════════════════════════════════════════════════════════════════════

function fastRoute(content: string): { route: string; type: 'skill' | 'agent' | 'none'; name: string; modelHint: 'auto' | 'coder' } {
  const c = content.toLowerCase();

  // ── Simple greetings — skip routing ──
  if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|howdy|sup|yo|what'?s\s*up|hola)[\s!.?]*$/i.test(c)) {
    return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
  }
  if (content.length < 10 && /^(thanks|thank you|ok|okay|bye|goodbye|sure|yes|no|maybe)[\s!.?]*$/i.test(c)) {
    return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
  }

  // ═══════════════════════════════════════════════════════════════
  // AI CORE — ASR, LLM, TTS, VLM, image-generation
  // ═══════════════════════════════════════════════════════════════
  if (/\b(speech\s*to\s*text|transcribe|transcription|asr|voice\s*recognition|audio\s*to\s*text)\b/i.test(c)) {
    return { route: 'ASR', type: 'skill', name: 'ASR (Speech to Text)', modelHint: 'auto' };
  }
  if (/\b(text\s*to\s*speech|tts|voice\s*generation|read\s*aloud|speak|pronounce)\b/i.test(c)) {
    return { route: 'TTS', type: 'skill', name: 'TTS (Text to Speech)', modelHint: 'auto' };
  }
  if (/\b(image\s*analysis|vision\s*model|vlm|describe\s*image|analyze\s*image|what'?s\s*in\s*the\s*(image|picture|photo))\b/i.test(c)) {
    return { route: 'VLM', type: 'skill', name: 'VLM (Vision)', modelHint: 'auto' };
  }
  if (/\b(generate|create|draw|make)\b.*\b(image|picture|photo|illustration|artwork|logo|icon)\b/.test(c)) {
    return { route: 'image-generation', type: 'skill', name: 'Image Generation', modelHint: 'auto' };
  }
  if (/\b(image\s*edit|modify\s*image|edit\s*photo|image\s*manipulation)\b/i.test(c)) {
    return { route: 'image-edit', type: 'skill', name: 'Image Editing', modelHint: 'auto' };
  }
  if (/\b(image\s*understand|interpret\s*image|ocr|read\s*text\s*from\s*image)\b/i.test(c)) {
    return { route: 'image-understand', type: 'skill', name: 'Image Understanding', modelHint: 'auto' };
  }
  if (/\b(claude\s*api|anthropic\s*api|claude\s*sdk)\b/i.test(c)) {
    return { route: 'claude-api', type: 'skill', name: 'Claude API', modelHint: 'coder' };
  }
  if (/\b(cost\s*aware|llm\s*cost|token\s*cost|api\s*cost|budget\s*llm)\b/i.test(c)) {
    return { route: 'cost-aware-llm-pipeline', type: 'skill', name: 'Cost-Aware LLM Pipeline', modelHint: 'coder' };
  }
  if (/\b(prompt\s*optim|optimize\s*prompt|improve\s*prompt)\b/i.test(c)) {
    return { route: 'prompt-optimizer', type: 'skill', name: 'Prompt Optimizer', modelHint: 'auto' };
  }
  if (/\b(regex|regular\s*expression|parsing\s*text|llm\s*vs\s*regex|structured\s*text)\b/i.test(c)) {
    return { route: 'regex-vs-llm-structured-text', type: 'skill', name: 'Regex vs LLM', modelHint: 'auto' };
  }
  if (/\b(token\s*budget|context\s*window|token\s*limit)\b/i.test(c)) {
    return { route: 'token-budget-advisor', type: 'skill', name: 'Token Budget Advisor', modelHint: 'auto' };
  }
  if (/\b(on\s*device\s*(llm|model|ai)|foundation\s*model|apple\s*intelligence|ios\s*26.*llm)\b/i.test(c)) {
    return { route: 'foundation-models-on-device', type: 'skill', name: 'On-Device LLM', modelHint: 'coder' };
  }
  if (/\b(trading\s*agent|llm\s*trading|ai\s*trading\s*security|autonomous\s*trading)\b/i.test(c)) {
    return { route: 'llm-trading-agent-security', type: 'skill', name: 'LLM Trading Security', modelHint: 'coder' };
  }

  // ═══════════════════════════════════════════════════════════════
  // BLOCKCHAIN
  // ═══════════════════════════════════════════════════════════════
  if (/\b(keccak|keccak.?256|ethereum\s*hash|sha3.*ethereum)\b/i.test(c)) {
    return { route: 'nodejs-keccak256', type: 'skill', name: 'Keccak-256', modelHint: 'coder' };
  }
  if (/\b(defi|amm|liquidity\s*pool|swap\s*contract|solidity.*amm)\b/i.test(c)) {
    return { route: 'defi-amm-security', type: 'skill', name: 'DeFi AMM Security', modelHint: 'coder' };
  }
  if (/\b(evm\s*token|token\s*decimal|erc.?20\s*decimal|decimal\s*mismatch)\b/i.test(c)) {
    return { route: 'evm-token-decimals', type: 'skill', name: 'EVM Token Decimals', modelHint: 'coder' };
  }

  // ═══════════════════════════════════════════════════════════════
  // COMMUNICATION — Email, Messages, Notifications, Translation
  // ═══════════════════════════════════════════════════════════════
  if (/\b(email\s*(ops|triage|draft|send|manage)|mailbox|inbox\s*manage)\b/i.test(c)) {
    return { route: 'email-ops', type: 'skill', name: 'Email Ops', modelHint: 'auto' };
  }
  if (/\b(message\s*ops|dm|direct\s*message|imessage|text\s*message)\b/i.test(c)) {
    return { route: 'messages-ops', type: 'skill', name: 'Messages Ops', modelHint: 'auto' };
  }
  if (/\b(notification|notify|push\s*notification|alert\s*system)\b/i.test(c)) {
    return { route: 'unified-notifications-ops', type: 'skill', name: 'Notifications Ops', modelHint: 'auto' };
  }
  if (/\b(translat|visa\s*doc|document\s*translat)\b/i.test(c)) {
    return { route: 'visa-doc-translate', type: 'skill', name: 'Translation', modelHint: 'auto' };
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA — Charts, Analytics, Scraping, Databases, Spreadsheets
  // ═══════════════════════════════════════════════════════════════
  if (/\b(chart|graph|visuali|plot|bar\s*chart|line\s*chart|pie\s*chart|heatmap|scatter|data\s*visual|diagram|flowchart|mind\s*map)\b/i.test(c)) {
    return { route: 'charts', type: 'skill', name: 'Charts & Visualization', modelHint: 'auto' };
  }
  if (/\b(clickhouse|olap|column\s*store|analytical\s*database)\b/i.test(c)) {
    return { route: 'clickhouse-io', type: 'skill', name: 'ClickHouse', modelHint: 'coder' };
  }
  if (/\b(content\s*hash|file\s*cache|sha.?256\s*cache|cache\s*pattern)\b/i.test(c)) {
    return { route: 'content-hash-cache-pattern', type: 'skill', name: 'Content Hash Cache', modelHint: 'coder' };
  }
  if (/\b(dashboard|monitoring\s*panel|kpi|metric\s*board|grafana|signoz)\b/i.test(c)) {
    return { route: 'dashboard-builder', type: 'skill', name: 'Dashboard Builder', modelHint: 'coder' };
  }
  if (/\b(scrape|web\s*scrape|data\s*collect|data\s*extract|scraper)\b/i.test(c)) {
    return { route: 'data-scraper-agent', type: 'skill', name: 'Data Scraper', modelHint: 'auto' };
  }
  if (/\b(migration|schema\s*change|database\s*migration|migrate)\b/i.test(c)) {
    return { route: 'database-migrations', type: 'skill', name: 'Database Migrations', modelHint: 'coder' };
  }
  if (/\b(google\s*(workspace|docs|sheets|slides|drive)|spreadsheet.*google)\b/i.test(c)) {
    return { route: 'google-workspace-ops', type: 'skill', name: 'Google Workspace', modelHint: 'auto' };
  }
  if (/\b(excel|spreadsheet|xlsx|csv.*process|workbook)\b/i.test(c)) {
    return { route: 'xlsx', type: 'skill', name: 'Spreadsheets', modelHint: 'auto' };
  }
  if (/\b(database|sql|postgres|mysql|prisma|drizzle|query|schema)\b/i.test(c)) {
    return { route: 'postgres-patterns', type: 'skill', name: 'Database', modelHint: 'coder' };
  }

  // ═══════════════════════════════════════════════════════════════
  // DESIGN — Design Systems, UI/UX, Frontend Design, Presentations
  // ═══════════════════════════════════════════════════════════════
  if (/\b(design\s*system|visual\s*consistency|design\s*token|component\s*library)\b/i.test(c)) {
    return { route: 'design-system', type: 'skill', name: 'Design System', modelHint: 'auto' };
  }
  if (/\b(frontend\s*design|make\s*it\s*look|ui\s*design|visual\s*design)\b/i.test(c)) {
    return { route: 'frontend-design', type: 'skill', name: 'Frontend Design', modelHint: 'auto' };
  }
  if (/\b(presentation|slides|slide\s*deck|powerpoint|pptx)\b/i.test(c)) {
    return { route: 'frontend-slides', type: 'skill', name: 'Presentations', modelHint: 'auto' };
  }
  if (/\b(gan\s*harness|generator.*evaluator|harness\s*design)\b/i.test(c)) {
    return { route: 'gan-style-harness', type: 'skill', name: 'GAN-Style Harness', modelHint: 'coder' };
  }
  if (/\b(liquid\s*glass|ios\s*26.*glass|glass\s*material|blur\s*material)\b/i.test(c)) {
    return { route: 'liquid-glass-design', type: 'skill', name: 'Liquid Glass Design', modelHint: 'coder' };
  }
  if (/\b(ui\s*ux|ux\s*design|user\s*experience|usability|wireframe|prototype|figma)\b/i.test(c)) {
    return { route: 'ui-ux-pro-max', type: 'skill', name: 'UI/UX Pro', modelHint: 'auto' };
  }
  if (/\b(typography|color\s*theory|spacing|visual\s*foundation|iconography)\b/i.test(c)) {
    return { route: 'visual-design-foundations', type: 'skill', name: 'Visual Design Foundations', modelHint: 'auto' };
  }
  if (/\b(shader|webgl|canvas\s*effect|glsl|gpu\s*effect)\b/i.test(c)) {
    return { route: 'web-shader-extractor', type: 'skill', name: 'Web Shader Extractor', modelHint: 'coder' };
  }

  // ═══════════════════════════════════════════════════════════════
  // DEVELOPMENT — All languages, frameworks, patterns
  // ═══════════════════════════════════════════════════════════════
  const isCode = /\b(code|coding|program|function|script|debug|fix bug|refactor|typescript|javascript|python|java|rust|go\s*lang|react|next\.?js|node\.?js|api|html|css|sql|database|git|npm|yarn|pip|cargo|component|hook|render|async|await|class|interface|type|array|error|exception|compile|build|deploy|server|client|frontend|backend|fullstack|algorithm|leetcode|docker|kubernetes|prisma|drizzle|tailwind|express|fastapi|django|flask|spring|kotlin|swift|dart|flutter|cpp|c\+\+|perl|php|laravel|vue|svelte|angular|nestjs|nuxt|bun)\b/i.test(c);

  if (isCode) {
    // ── Code Review ──
    if (/\b(review|code\s*review)\b/i.test(c)) return { route: 'code-review', type: 'skill', name: 'Code Review', modelHint: 'coder' };

    // ── Security ──
    if (/\b(security|vulnerability|exploit|hack|pentest)\b/i.test(c)) return { route: 'security', type: 'skill', name: 'Security', modelHint: 'coder' };

    // ── Testing / TDD ──
    if (/\b(test|testing|unit\s*test|tdd|pytest|jest)\b/i.test(c)) {
      if (/\b(python|pytest)\b/i.test(c)) return { route: 'python-testing', type: 'skill', name: 'Python Testing', modelHint: 'coder' };
      if (/\b(golang|go\s*lang)\b/i.test(c)) return { route: 'golang-testing', type: 'skill', name: 'Go Testing', modelHint: 'coder' };
      if (/\b(rust|cargo)\b/i.test(c)) return { route: 'rust-testing', type: 'skill', name: 'Rust Testing', modelHint: 'coder' };
      if (/\b(kotlin)\b/i.test(c)) return { route: 'kotlin-testing', type: 'skill', name: 'Kotlin Testing', modelHint: 'coder' };
      if (/\b(perl)\b/i.test(c)) return { route: 'perl-testing', type: 'skill', name: 'Perl Testing', modelHint: 'coder' };
      if (/\b(c\+\+|cmake)\b/i.test(c)) return { route: 'cpp-testing', type: 'skill', name: 'C++ Testing', modelHint: 'coder' };
      if (/\b(c#|csharp|\.net)\b/i.test(c)) return { route: 'csharp-testing', type: 'skill', name: 'C# Testing', modelHint: 'coder' };
      if (/\b(e2e|end.?to.?end|playwright)\b/i.test(c)) return { route: 'e2e-testing', type: 'skill', name: 'E2E Testing', modelHint: 'coder' };
      if (/\b(spring|springboot)\b/i.test(c)) return { route: 'springboot-tdd', type: 'skill', name: 'Spring Boot TDD', modelHint: 'coder' };
      if (/\b(django)\b/i.test(c)) return { route: 'django-tdd', type: 'skill', name: 'Django TDD', modelHint: 'coder' };
      if (/\b(laravel)\b/i.test(c)) return { route: 'laravel-tdd', type: 'skill', name: 'Laravel TDD', modelHint: 'coder' };
      return { route: 'tdd', type: 'skill', name: 'TDD / Testing', modelHint: 'coder' };
    }

    // ── Python ecosystem ──
    if (/\b(python|django|flask|pytest|pip|fastapi|pytorch)\b/i.test(c)) {
      if (/\b(django)\b/i.test(c)) {
        if (/\b(security)\b/i.test(c)) return { route: 'django-security', type: 'skill', name: 'Django Security', modelHint: 'coder' };
        if (/\b(verif|deploy|production)\b/i.test(c)) return { route: 'django-verification', type: 'skill', name: 'Django Verification', modelHint: 'coder' };
        return { route: 'django-patterns', type: 'skill', name: 'Django', modelHint: 'coder' };
      }
      if (/\b(pytorch|neural\s*network|deep\s*learning|training\s*pipeline)\b/i.test(c)) return { route: 'pytorch-patterns', type: 'skill', name: 'PyTorch', modelHint: 'coder' };
      return { route: 'python-patterns', type: 'skill', name: 'Python Development', modelHint: 'coder' };
    }

    // ── Rust ──
    if (/\b(rust|cargo|borrow|ownership|lifetime)\b/i.test(c)) return { route: 'rust-patterns', type: 'skill', name: 'Rust Development', modelHint: 'coder' };

    // ── Go ──
    if (/\b(golang|go\s*lang|goroutine|channel|go\s*mod)\b/i.test(c)) return { route: 'golang-patterns', type: 'skill', name: 'Go Development', modelHint: 'coder' };

    // ── Java / Spring Boot ──
    if (/\b(java|spring|jpa|hibernate|maven|gradle)\b/i.test(c)) {
      if (/\b(jpa|hibernate|entity|repository)\b/i.test(c)) return { route: 'jpa-patterns', type: 'skill', name: 'JPA/Hibernate', modelHint: 'coder' };
      if (/\b(security|spring\s*security)\b/i.test(c)) return { route: 'springboot-security', type: 'skill', name: 'Spring Security', modelHint: 'coder' };
      if (/\b(verif|deploy|production)\b/i.test(c)) return { route: 'springboot-verification', type: 'skill', name: 'Spring Verification', modelHint: 'coder' };
      if (/\b(coding\s*standard|naming|convention)\b/i.test(c)) return { route: 'java-coding-standards', type: 'skill', name: 'Java Standards', modelHint: 'coder' };
      return { route: 'springboot-patterns', type: 'skill', name: 'Spring Boot', modelHint: 'coder' };
    }

    // ── Kotlin / Android ──
    if (/\b(kotlin|android|jetpack|compose)\b/i.test(c)) {
      if (/\b(coroutine|flow|channel|concurrency)\b/i.test(c)) return { route: 'kotlin-coroutines-flows', type: 'skill', name: 'Kotlin Coroutines', modelHint: 'coder' };
      if (/\b(exposed|database.*kotlin)\b/i.test(c)) return { route: 'kotlin-exposed-patterns', type: 'skill', name: 'Kotlin Exposed', modelHint: 'coder' };
      if (/\b(ktor|server.*kotlin)\b/i.test(c)) return { route: 'kotlin-ktor-patterns', type: 'skill', name: 'Ktor', modelHint: 'coder' };
      if (/\b(android.*clean|clean\s*architecture.*android)\b/i.test(c)) return { route: 'android-clean-architecture', type: 'skill', name: 'Android Clean Arch', modelHint: 'coder' };
      if (/\b(compose\s*multiplatform|kmp)\b/i.test(c)) return { route: 'compose-multiplatform-patterns', type: 'skill', name: 'Compose Multiplatform', modelHint: 'coder' };
      return { route: 'kotlin-patterns', type: 'skill', name: 'Kotlin Development', modelHint: 'coder' };
    }

    // ── C++ ──
    if (/\b(c\+\+|cmake|clang)\b/i.test(c)) return { route: 'cpp-coding-standards', type: 'skill', name: 'C++ Coding', modelHint: 'coder' };

    // ── Swift / iOS ──
    if (/\b(swift|ios|swiftui|xcode)\b/i.test(c)) {
      if (/\b(actor|persistence|thread\s*safe)\b/i.test(c)) return { route: 'swift-actor-persistence', type: 'skill', name: 'Swift Actors', modelHint: 'coder' };
      if (/\b(concurrency|approachable|swift\s*6)\b/i.test(c)) return { route: 'swift-concurrency-6-2', type: 'skill', name: 'Swift Concurrency', modelHint: 'coder' };
      if (/\b(protocol|di|testing|dependency\s*injection)\b/i.test(c)) return { route: 'swift-protocol-di-testing', type: 'skill', name: 'Swift DI Testing', modelHint: 'coder' };
      return { route: 'swiftui-patterns', type: 'skill', name: 'SwiftUI', modelHint: 'coder' };
    }

    // ── Laravel / PHP ──
    if (/\b(laravel|php|artisan|blade|eloquent)\b/i.test(c)) {
      if (/\b(security)\b/i.test(c)) return { route: 'laravel-security', type: 'skill', name: 'Laravel Security', modelHint: 'coder' };
      if (/\b(verif|deploy|production)\b/i.test(c)) return { route: 'laravel-verification', type: 'skill', name: 'Laravel Verification', modelHint: 'coder' };
      if (/\b(plugin|package|composer|laravel\s*package)\b/i.test(c)) return { route: 'laravel-plugin-discovery', type: 'skill', name: 'Laravel Plugins', modelHint: 'coder' };
      return { route: 'laravel-patterns', type: 'skill', name: 'Laravel', modelHint: 'coder' };
    }

    // ── Flutter / Dart ──
    if (/\b(flutter|dart|widget|pub)\b/i.test(c)) {
      if (/\b(review|code\s*review.*flutter)\b/i.test(c)) return { route: 'flutter-dart-code-review', type: 'skill', name: 'Flutter Review', modelHint: 'coder' };
      return { route: 'dart-flutter-patterns', type: 'skill', name: 'Flutter/Dart', modelHint: 'coder' };
    }

    // ── Perl ──
    if (/\b(perl|cpan)\b/i.test(c)) {
      if (/\b(security|taint)\b/i.test(c)) return { route: 'perl-security', type: 'skill', name: 'Perl Security', modelHint: 'coder' };
      return { route: 'perl-patterns', type: 'skill', name: 'Perl', modelHint: 'coder' };
    }

    // ── .NET / C# ──
    if (/\b(c#|csharp|\.net|dotnet|asp\.net)\b/i.test(c)) return { route: 'dotnet-patterns', type: 'skill', name: '.NET/C#', modelHint: 'coder' };

    // ── NestJS ──
    if (/\b(nestjs|nest\.js|nestjs\s*module)\b/i.test(c)) return { route: 'nestjs-patterns', type: 'skill', name: 'NestJS', modelHint: 'coder' };

    // ── Nuxt ──
    if (/\b(nuxt|nuxt\s*4|nuxtjs)\b/i.test(c)) return { route: 'nuxt4-patterns', type: 'skill', name: 'Nuxt 4', modelHint: 'coder' };

    // ── Bun ──
    if (/\b(bun\s*runtime|bun\s*install|bun\s*test)\b/i.test(c)) return { route: 'bun-runtime', type: 'skill', name: 'Bun Runtime', modelHint: 'coder' };

    // ── MCP Server ──
    if (/\b(mcp|model\s*context\s*protocol|mcp\s*server)\b/i.test(c)) return { route: 'mcp-server-patterns', type: 'skill', name: 'MCP Server', modelHint: 'coder' };

    // ── Hexagonal Architecture ──
    if (/\b(hexagonal|ports\s*and\s*adapters|clean\s*architect|hexagon)\b/i.test(c)) return { route: 'hexagonal-architecture', type: 'skill', name: 'Hexagonal Architecture', modelHint: 'coder' };

    // ── DevOps / Docker / Deploy ──
    if (/\b(docker|kubernetes|deploy|ci.?cd|github\s*actions|terraform)\b/i.test(c)) {
      if (/\b(deploy|release|rollback|canary|blue.?green)\b/i.test(c)) return { route: 'deployment-patterns', type: 'skill', name: 'Deployment', modelHint: 'coder' };
      return { route: 'docker-patterns', type: 'skill', name: 'DevOps', modelHint: 'coder' };
    }

    // ── API Design ──
    if (/\b(api|rest|graphql|endpoint|route)\b/i.test(c)) {
      if (/\b(connector|integration|provider)\b/i.test(c)) return { route: 'api-connector-builder', type: 'skill', name: 'API Connector', modelHint: 'coder' };
      return { route: 'api-design', type: 'skill', name: 'API Design', modelHint: 'coder' };
    }

    // ── Architecture ──
    if (/\b(architect|system\s*design|scalability|microservice|adr|architecture\s*decision)\b/i.test(c)) {
      if (/\b(adr|decision\s*record)\b/i.test(c)) return { route: 'architecture-decision-records', type: 'skill', name: 'ADRs', modelHint: 'coder' };
      return { route: 'architect', type: 'skill', name: 'Architect', modelHint: 'coder' };
    }

    // ── Frontend (TS/React/Next.js/etc.) ──
    if (/\b(typescript|react|next\.?js|node\.?js|tsx|jsx|npm|yarn|vite|webpack|tailwind|vue|svelte|angular)\b/i.test(c)) {
      if (/\b(turbopack|turbo|bundle.*speed)\b/i.test(c)) return { route: 'nextjs-turbopack', type: 'skill', name: 'Turbopack', modelHint: 'coder' };
      return { route: 'fullstack-dev', type: 'skill', name: 'Fullstack Development', modelHint: 'coder' };
    }

    // ── Frontend patterns (general) ──
    if (/\b(frontend|ui\s*component|react\s*pattern|state\s*management)\b/i.test(c)) return { route: 'frontend-patterns', type: 'skill', name: 'Frontend Patterns', modelHint: 'coder' };

    // ── Backend patterns (general) ──
    if (/\b(backend|server\s*side|rest\s*api|middleware)\b/i.test(c)) return { route: 'backend-patterns', type: 'skill', name: 'Backend Patterns', modelHint: 'coder' };

    // ── Coding standards (general) ──
    if (/\b(coding\s*standard|best\s*practice|convention|style\s*guide)\b/i.test(c)) return { route: 'coding-standards', type: 'skill', name: 'Coding Standards', modelHint: 'coder' };

    // ── Generic code fallback ──
    return { route: 'fullstack-dev', type: 'skill', name: 'Fullstack Development', modelHint: 'coder' };
  }

  // ═══════════════════════════════════════════════════════════════
  // DEVOPS / AUTOMATION / AGENTS
  // ═══════════════════════════════════════════════════════════════
  if (/\b(agent\s*harness|agent\s*action|agent\s*tool)\b/i.test(c)) return { route: 'agent-harness-construction', type: 'skill', name: 'Agent Harness', modelHint: 'coder' };
  if (/\b(agent\s*introspect|agent\s*debug|agent\s*fail|agent\s*stuck)\b/i.test(c)) return { route: 'agent-introspection-debugging', type: 'skill', name: 'Agent Debugging', modelHint: 'coder' };
  if (/\b(agent\s*payment|x402|pay\s*per\s*api|agent\s*wallet)\b/i.test(c)) return { route: 'agent-payment-x402', type: 'skill', name: 'Agent Payments', modelHint: 'coder' };
  if (/\b(agent\s*sort|ecc\s*install|project\s*specific\s*skill)\b/i.test(c)) return { route: 'agent-sort', type: 'skill', name: 'Agent Sort', modelHint: 'auto' };
  if (/\b(agentic\s*engineering|eval\s*first|cost\s*aware\s*routing)\b/i.test(c)) return { route: 'agentic-engineering', type: 'skill', name: 'Agentic Engineering', modelHint: 'auto' };
  if (/\b(ai\s*first\s*engineering|ai\s*assisted\s*team|ai\s*code\s*review)\b/i.test(c)) return { route: 'ai-first-engineering', type: 'skill', name: 'AI-First Engineering', modelHint: 'auto' };
  if (/\b(ai\s*regression|ai\s*test|llm\s*code\s*review)\b/i.test(c)) return { route: 'ai-regression-testing', type: 'skill', name: 'AI Regression Testing', modelHint: 'coder' };
  if (/\b(automation\s*audit|which\s*jobs|which\s*hooks|automation\s*inventory)\b/i.test(c)) return { route: 'automation-audit-ops', type: 'skill', name: 'Automation Audit', modelHint: 'auto' };
  if (/\b(autonomous\s*agent|persistent\s*agent|self\s*directing)\b/i.test(c)) return { route: 'autonomous-agent-harness', type: 'skill', name: 'Autonomous Agent', modelHint: 'auto' };
  if (/\b(autonomous\s*loop|continuous\s*agent|agent\s*loop)\b/i.test(c)) return { route: 'continuous-agent-loop', type: 'skill', name: 'Agent Loop', modelHint: 'auto' };
  if (/\b(benchmark|performance\s*baseline|regression\s*detect)\b/i.test(c)) return { route: 'benchmark', type: 'skill', name: 'Benchmark', modelHint: 'coder' };
  if (/\b(canary|post.?deploy|monitor.*deploy)\b/i.test(c)) return { route: 'canary-watch', type: 'skill', name: 'Canary Watch', modelHint: 'auto' };
  if (/\b(continuous\s*learning|learn\s*from\s*session|extract\s*pattern)\b/i.test(c)) return { route: 'continuous-learning', type: 'skill', name: 'Continuous Learning', modelHint: 'auto' };
  if (/\b(continuous\s*learning\s*v2|instinct|confidence\s*scoring)\b/i.test(c)) return { route: 'continuous-learning-v2', type: 'skill', name: 'Instinct Learning', modelHint: 'auto' };
  if (/\b(dmux|tmux\s*agent|parallel\s*agent)\b/i.test(c)) return { route: 'dmux-workflows', type: 'skill', name: 'dmux Workflows', modelHint: 'auto' };
  if (/\b(enterprise\s*agent|long.?lived\s*agent|agent\s*observability)\b/i.test(c)) return { route: 'enterprise-agent-ops', type: 'skill', name: 'Enterprise Agents', modelHint: 'auto' };
  if (/\b(git\s*workflow|branching|merge\s*vs\s*rebase|conflict)\b/i.test(c)) return { route: 'git-workflow', type: 'skill', name: 'Git Workflow', modelHint: 'coder' };
  if (/\b(github\s*ops|github\s*issue|github\s*pr|github\s*release)\b/i.test(c)) return { route: 'github-ops', type: 'skill', name: 'GitHub Ops', modelHint: 'auto' };
  if (/\b(open\s*source|open.?source\s*pipeline|make\s*public)\b/i.test(c)) return { route: 'opensource-pipeline', type: 'skill', name: 'Open-Source Pipeline', modelHint: 'auto' };
  if (/\b(project\s*flow|linear.*github|execution\s*flow)\b/i.test(c)) return { route: 'project-flow-ops', type: 'skill', name: 'Project Flow', modelHint: 'auto' };
  if (/\b(strategic\s*compact|compact\s*context|context\s*management)\b/i.test(c)) return { route: 'strategic-compact', type: 'skill', name: 'Strategic Compact', modelHint: 'auto' };
  if (/\b(terminal\s*ops|run\s*command|execute\s*command|bash\s*command)\b/i.test(c)) return { route: 'terminal-ops', type: 'skill', name: 'Terminal Ops', modelHint: 'coder' };
  if (/\b(verif|verification\s*loop|pre.?deploy\s*check)\b/i.test(c)) return { route: 'verification-loop', type: 'skill', name: 'Verification Loop', modelHint: 'coder' };

  // ═══════════════════════════════════════════════════════════════
  // EDUCATION
  // ═══════════════════════════════════════════════════════════════
  if (/\b(code\s*tour|walkthrough|onboarding\s*tour|code\s*walkthrough)\b/i.test(c)) return { route: 'code-tour', type: 'skill', name: 'Code Tour', modelHint: 'auto' };
  if (/\b(interview|hire|hiring|candidate|question.*interview)\b/i.test(c)) return { route: 'interview-designer', type: 'skill', name: 'Interview Designer', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // FINANCE
  // ═══════════════════════════════════════════════════════════════
  if (/\b(finance|stock|investment|crypto|bitcoin|trading|market\s*data)\b/i.test(c)) {
    if (/\b(billing|customer\s*bill|refund|subscription|stripe)\b/i.test(c)) return { route: 'customer-billing-ops', type: 'skill', name: 'Billing Ops', modelHint: 'auto' };
    if (/\b(investor\s*material|pitch\s*deck|fundraising|financial\s*model)\b/i.test(c)) return { route: 'investor-materials', type: 'skill', name: 'Investor Materials', modelHint: 'auto' };
    if (/\b(investor\s*outreach|fundraising\s*email|angel|venture)\b/i.test(c)) return { route: 'investor-outreach', type: 'skill', name: 'Investor Outreach', modelHint: 'auto' };
    if (/\b(stock\s*analysis|stock\s*price|quote|financial\s*data)\b/i.test(c)) return { route: 'stock-analysis-skill', type: 'skill', name: 'Stock Analysis', modelHint: 'auto' };
    if (/\b(billing\s*ops|pricing|revenue|saas\s*billing)\b/i.test(c)) return { route: 'finance-billing-ops', type: 'skill', name: 'Finance Billing', modelHint: 'auto' };
    if (/\b(energy\s*procurement|utility|power\s*purchase)\b/i.test(c)) return { route: 'energy-procurement', type: 'skill', name: 'Energy Procurement', modelHint: 'auto' };
    return { route: 'finance', type: 'skill', name: 'Finance', modelHint: 'auto' };
  }

  // ═══════════════════════════════════════════════════════════════
  // HEALTHCARE
  // ═══════════════════════════════════════════════════════════════
  if (/\b(health|medical|clinical|patient|diagnosis|emr|ehr)\b/i.test(c)) {
    if (/\b(cdss|clinical\s*decision|drug\s*interaction|dose)\b/i.test(c)) return { route: 'healthcare-cdss-patterns', type: 'skill', name: 'Clinical Decision Support', modelHint: 'coder' };
    if (/\b(emr|ehr|electronic\s*health|medical\s*record)\b/i.test(c)) return { route: 'healthcare-emr-patterns', type: 'skill', name: 'EMR Patterns', modelHint: 'coder' };
    if (/\b(phi|hipaa|protected\s*health|pii.*health)\b/i.test(c)) return { route: 'healthcare-phi-compliance', type: 'skill', name: 'PHI Compliance', modelHint: 'coder' };
    if (/\b(patient\s*safety|deploy.*health|eval.*health)\b/i.test(c)) return { route: 'healthcare-eval-harness', type: 'skill', name: 'Healthcare Eval', modelHint: 'coder' };
    if (/\b(hipaa|compliance.*health|privacy.*health)\b/i.test(c)) return { route: 'hipaa-compliance', type: 'skill', name: 'HIPAA Compliance', modelHint: 'coder' };
    if (/\b(meditat|mindful|breathing|stress\s*relief)\b/i.test(c)) return { route: 'mindfulness-meditation', type: 'skill', name: 'Meditation', modelHint: 'auto' };
    return { route: 'healthcare-cdss-patterns', type: 'skill', name: 'Healthcare', modelHint: 'auto' };
  }

  // ═══════════════════════════════════════════════════════════════
  // MARKETING / SOCIAL
  // ═══════════════════════════════════════════════════════════════
  if (/\b(lead\s*intelligence|lead\s*scoring|outreach\s*pipeline|contact\s*discovery)\b/i.test(c)) return { route: 'lead-intelligence', type: 'skill', name: 'Lead Intelligence', modelHint: 'auto' };
  if (/\b(marketing|brand\s*strategy|content\s*marketing|social\s*media\s*strategy|growth)\b/i.test(c)) return { route: 'marketing-mode', type: 'skill', name: 'Marketing Mode', modelHint: 'auto' };
  if (/\b(social\s*graph|network\s*rank|graph\s*ranking|warm\s*intro)\b/i.test(c)) return { route: 'social-graph-ranker', type: 'skill', name: 'Social Graph Ranker', modelHint: 'auto' };
  if (/\b(brand\s*voice|tone.*brand|voice\s*consistency|writing\s*style)\b/i.test(c)) return { route: 'brand-voice', type: 'skill', name: 'Brand Voice', modelHint: 'auto' };
  if (/\b(crosspost|multi\s*platform|linkedin.*post|twitter.*post|bluesky|threads)\b/i.test(c)) return { route: 'crosspost', type: 'skill', name: 'Crosspost', modelHint: 'auto' };
  if (/\b(content\s*engine|content\s*calendar|content\s*system|social\s*campaign)\b/i.test(c)) return { route: 'content-engine', type: 'skill', name: 'Content Engine', modelHint: 'auto' };
  if (/\b(connections?\s*optim|network\s*prun|network\s*clean|follow\s*recommend)\b/i.test(c)) return { route: 'connections-optimizer', type: 'skill', name: 'Connections Optimizer', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // MEDIA — Video, Audio, Image generation, Podcasts
  // ═══════════════════════════════════════════════════════════════
  if (/\b(fal\.ai|fal\s*media|ai\s*video|ai\s*audio|seedance|kling|veo)\b/i.test(c)) return { route: 'fal-ai-media', type: 'skill', name: 'fal.ai Media', modelHint: 'auto' };
  if (/\b(manim|math\s*animation|technical\s*explainer\s*video)\b/i.test(c)) return { route: 'manim-video', type: 'skill', name: 'Manim Video', modelHint: 'auto' };
  if (/\b(podcast|audio\s*show|podcast\s*script|podcast\s*audio)\b/i.test(c)) return { route: 'podcast-generate', type: 'skill', name: 'Podcast Generator', modelHint: 'auto' };
  if (/\b(remotion|react\s*video|video\s*creation)\b/i.test(c)) return { route: 'remotion-video-creation', type: 'skill', name: 'Remotion Video', modelHint: 'coder' };
  if (/\b(ui\s*demo|demo\s*video|record\s*ui|playwright\s*video)\b/i.test(c)) return { route: 'ui-demo', type: 'skill', name: 'UI Demo Video', modelHint: 'auto' };
  if (/\b(video\s*edit|video\s*process|video\s*production)\b/i.test(c)) return { route: 'video-editing', type: 'skill', name: 'Video Editing', modelHint: 'auto' };
  if (/\b(video\s*generat|create\s*video|make\s*video)\b/i.test(c)) return { route: 'video-generation', type: 'skill', name: 'Video Generation', modelHint: 'auto' };
  if (/\b(video\s*understand|video\s*analysis|analyze\s*video)\b/i.test(c)) return { route: 'video-understand', type: 'skill', name: 'Video Understanding', modelHint: 'auto' };
  if (/\b(videodb|video\s*database|video\s*search)\b/i.test(c)) return { route: 'videodb', type: 'skill', name: 'VideoDB', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // OPERATIONS — Logistics, Inventory, Production, Customs
  // ═══════════════════════════════════════════════════════════════
  if (/\b(carrier|shipping\s*carrier|freight|logistics\s*partner)\b/i.test(c)) return { route: 'carrier-relationship-management', type: 'skill', name: 'Carrier Management', modelHint: 'auto' };
  if (/\b(customs|trade\s*compliance|import\s*export|tariff|hs\s*code)\b/i.test(c)) return { route: 'customs-trade-compliance', type: 'skill', name: 'Customs Compliance', modelHint: 'auto' };
  if (/\b(inventory|demand\s*planning|forecast|supply\s*chain|stock\s*level)\b/i.test(c)) return { route: 'inventory-demand-planning', type: 'skill', name: 'Inventory Planning', modelHint: 'auto' };
  if (/\b(production\s*scheduling|manufacturing\s*schedul|shop\s*floor|capacity\s*plan)\b/i.test(c)) return { route: 'production-scheduling', type: 'skill', name: 'Production Scheduling', modelHint: 'auto' };
  if (/\b(quality\s*nonconform|nonconformance|quality\s*issue|defect|ncr)\b/i.test(c)) return { route: 'quality-nonconformance', type: 'skill', name: 'Quality NCR', modelHint: 'auto' };
  if (/\b(return|reverse\s*logistics|refund\s*process|product\s*return)\b/i.test(c)) return { route: 'returns-reverse-logistics', type: 'skill', name: 'Returns & Logistics', modelHint: 'auto' };
  if (/\b(logistics\s*exception|shipment\s*delay|delivery\s*exception|freight\s*issue)\b/i.test(c)) return { route: 'logistics-exception-management', type: 'skill', name: 'Logistics Exceptions', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // PRODUCTIVITY / WRITING
  // ═══════════════════════════════════════════════════════════════
  if (/\b(write|essay|article|blog|content|email|letter|copy|draft|compose)\b/i.test(c)) {
    if (/\b(article\s*writing|write\s*article|blog\s*post|write\s*blog)\b/i.test(c)) return { route: 'article-writing', type: 'skill', name: 'Article Writing', modelHint: 'auto' };
    if (/\b(blog\s*writer|write\s*blog|blog\s*content)\b/i.test(c)) return { route: 'blog-writer', type: 'skill', name: 'Blog Writer', modelHint: 'auto' };
    if (/\b(content\s*strategy|content\s*plan|editorial)\b/i.test(c)) return { route: 'content-strategy', type: 'skill', name: 'Content Strategy', modelHint: 'auto' };
    if (/\b(seo\s*content|seo\s*writer|keyword\s*content)\b/i.test(c)) return { route: 'seo-content-writer', type: 'skill', name: 'SEO Content Writer', modelHint: 'auto' };
    if (/\b(writing\s*plan|story\s*plan|writing\s*outline)\b/i.test(c)) return { route: 'writing-plans', type: 'skill', name: 'Writing Plans', modelHint: 'auto' };
    return { route: 'article-writing', type: 'skill', name: 'Writer', modelHint: 'auto' };
  }
  if (/\b(pdf|document|report|create\s*pdf|merge\s*pdf|extract\s*pdf)\b/i.test(c)) return { route: 'pdf', type: 'skill', name: 'PDF', modelHint: 'auto' };
  if (/\b(docx|word\s*document|create\s*doc|document\s*generation)\b/i.test(c)) return { route: 'docx', type: 'skill', name: 'DOCX', modelHint: 'auto' };
  if (/\b(ppt|powerpoint|presentation|slide\s*deck)\b/i.test(c)) return { route: 'ppt', type: 'skill', name: 'PPT', modelHint: 'auto' };
  if (/\b(storyboard|story\s*board|narrative\s*structure)\b/i.test(c)) return { route: 'storyboard-manager', type: 'skill', name: 'Storyboard', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // RESEARCH
  // ═══════════════════════════════════════════════════════════════
  if (/\b(analyz|research|investigate|study|compare|market|competitor)\b/i.test(c)) {
    if (/\b(deep\s*research|comprehensive\s*research|thorough\s*research)\b/i.test(c)) return { route: 'deep-research', type: 'skill', name: 'Deep Research', modelHint: 'auto' };
    if (/\b(market\s*research|market\s*analysis|competitive|industry\s*intelligence)\b/i.test(c)) return { route: 'market-research', type: 'skill', name: 'Market Research', modelHint: 'auto' };
    if (/\b(research\s*ops|evidence\s*first|current\s*state\s*research)\b/i.test(c)) return { route: 'research-ops', type: 'skill', name: 'Research Ops', modelHint: 'auto' };
    if (/\b(exa\s*search|neural\s*search|web\s*search.*code|code\s*search)\b/i.test(c)) return { route: 'exa-search', type: 'skill', name: 'Exa Search', modelHint: 'auto' };
    return { route: 'deep-research', type: 'skill', name: 'Researcher', modelHint: 'auto' };
  }
  if (/\b(search|find|look up|google|web\s*search)\b/i.test(c)) return { route: 'web-search', type: 'skill', name: 'Web Search', modelHint: 'auto' };
  if (/\b(documentation\s*lookup|docs\s*lookup|api\s*docs|library\s*docs|framework\s*docs)\b/i.test(c)) return { route: 'documentation-lookup', type: 'skill', name: 'Docs Lookup', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // SECURITY (non-code security queries)
  // ═══════════════════════════════════════════════════════════════
  if (/\b(security\s*review|security\s*checklist|auth|authentication|xss|csrf|sql\s*injection)\b/i.test(c)) return { route: 'security-review', type: 'skill', name: 'Security Review', modelHint: 'coder' };
  if (/\b(security\s*scan|vulnerability\s*scan|claude\s*code\s*security|config\s*security)\b/i.test(c)) return { route: 'security-scan', type: 'skill', name: 'Security Scan', modelHint: 'auto' };
  if (/\b(bounty|security\s*bounty|bug\s*bounty|responsible\s*disclosure)\b/i.test(c)) return { route: 'security-bounty-hunter', type: 'skill', name: 'Bug Bounty', modelHint: 'coder' };
  if (/\b(safety\s*guard|destructive\s*prevent|production\s*safety)\b/i.test(c)) return { route: 'safety-guard', type: 'skill', name: 'Safety Guard', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // SEO
  // ═══════════════════════════════════════════════════════════════
  if (/\b(seo|search\s*engine|ranking|keyword|optimization|core\s*web\s*vitals|sitemap|robots\.txt)\b/i.test(c)) return { route: 'seo', type: 'skill', name: 'SEO', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // PLANNING / PRODUCT / BLUEPRINT
  // ═══════════════════════════════════════════════════════════════
  if (/\b(plan|roadmap|milestone|phase|break\s*down|strategy|sprint)\b/i.test(c)) return { route: 'planner', type: 'skill', name: 'Planner', modelHint: 'auto' };
  if (/\b(blueprint|construction\s*plan|step\s*by\s*step\s*plan)\b/i.test(c)) return { route: 'blueprint', type: 'skill', name: 'Blueprint', modelHint: 'auto' };
  if (/\b(product\s*capability|prd\s*to\s*srs|feature\s*spec|capability\s*plan)\b/i.test(c)) return { route: 'product-capability', type: 'skill', name: 'Product Capability', modelHint: 'auto' };
  if (/\b(product\s*lens|validate.*why|product\s*diagnostic|product\s*direction)\b/i.test(c)) return { route: 'product-lens', type: 'skill', name: 'Product Lens', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // SKILL META — Skills about skills
  // ═══════════════════════════════════════════════════════════════
  if (/\b(skill\s*creat|create\s*skill|new\s*skill|edit\s*skill)\b/i.test(c)) return { route: 'skill-creator', type: 'skill', name: 'Skill Creator', modelHint: 'auto' };
  if (/\b(skill\s*vet|install\s*skill|skill\s*security|trust\s*skill)\b/i.test(c)) return { route: 'skill-vetter', type: 'skill', name: 'Skill Vetter', modelHint: 'auto' };
  if (/\b(skill\s*comply|compliance\s*measure|skill\s*follow)\b/i.test(c)) return { route: 'skill-comply', type: 'skill', name: 'Skill Compliance', modelHint: 'auto' };
  if (/\b(skill\s*stocktake|skill\s*audit|quality\s*check\s*skill)\b/i.test(c)) return { route: 'skill-stocktake', type: 'skill', name: 'Skill Stocktake', modelHint: 'auto' };
  if (/\b(rules?\s*distill|extract\s*principle|cross.?cutting)\b/i.test(c)) return { route: 'rules-distill', type: 'skill', name: 'Rules Distill', modelHint: 'auto' };
  if (/\b(hookify|hook\s*rule|hook\s*config)\b/i.test(c)) return { route: 'hookify-rules', type: 'skill', name: 'Hookify Rules', modelHint: 'auto' };
  if (/\b(codebase\s*onboarding|new\s*project|unfamiliar\s*code)\b/i.test(c)) return { route: 'codebase-onboarding', type: 'skill', name: 'Codebase Onboarding', modelHint: 'auto' };
  if (/\b(repo\s*scan|source\s*audit|file\s*classify|dependency\s*scan)\b/i.test(c)) return { route: 'repo-scan', type: 'skill', name: 'Repo Scan', modelHint: 'auto' };
  if (/\b(eval\s*harness|eval\s*driven|evaluation\s*framework)\b/i.test(c)) return { route: 'eval-harness', type: 'skill', name: 'Eval Harness', modelHint: 'auto' };
  if (/\b(santa\s*method|adversarial\s*verif|double\s*review)\b/i.test(c)) return { route: 'santa-method', type: 'skill', name: 'Santa Method', modelHint: 'auto' };
  if (/\b(council|four\s*voice|disagree|go\s*no\s*go)\b/i.test(c)) return { route: 'council', type: 'skill', name: 'Council', modelHint: 'auto' };
  if (/\b(search\s*first|research\s*before\s*code|existing\s*tool)\b/i.test(c)) return { route: 'search-first', type: 'skill', name: 'Search First', modelHint: 'auto' };

  // ═══════════════════════════════════════════════════════════════
  // OTHER SPECIALIZED SKILLS
  // ═══════════════════════════════════════════════════════════════
  if (/\b(context\s*budget|token\s*overhead|token\s*saving)\b/i.test(c)) return { route: 'context-budget', type: 'skill', name: 'Context Budget', modelHint: 'auto' };
  if (/\b(ecc\s*cost|ecc\s*tools\s*audit|github\s*app\s*cost)\b/i.test(c)) return { route: 'ecc-tools-cost-audit', type: 'skill', name: 'ECC Cost Audit', modelHint: 'auto' };
  if (/\b(dream\s*interpret|dream\s*meaning|dream\s*analysis)\b/i.test(c)) return { route: 'dream-interpreter', type: 'skill', name: 'Dream Interpreter', modelHint: 'auto' };
  if (/\b(fortune|fortune\s*telling|fortune\s*analysis)\b/i.test(c)) return { route: 'get-fortune-analysis', type: 'skill', name: 'Fortune Analysis', modelHint: 'auto' };
  if (/\b(gift\s*evaluat|gift\s*idea|gift\s*recommend)\b/i.test(c)) return { route: 'gift-evaluator', type: 'skill', name: 'Gift Evaluator', modelHint: 'auto' };
  if (/\b(jira|ticket|issue\s*track|jira\s*api)\b/i.test(c)) return { route: 'jira-integration', type: 'skill', name: 'Jira Integration', modelHint: 'auto' };
  if (/\b(knowledge\s*ops|knowledge\s*base|vector\s*store|memory)\b/i.test(c)) return { route: 'knowledge-ops', type: 'skill', name: 'Knowledge Ops', modelHint: 'auto' };
  if (/\b(nutrient|pdf\s*process|pdf\s*convert|ocr\s*pdf|redact)\b/i.test(c)) return { route: 'nutrient-document-processing', type: 'skill', name: 'Document Processing', modelHint: 'auto' };
  if (/\b(web\s*reader|read\s*webpage|extract\s*web|scrape\s*page)\b/i.test(c)) return { route: 'web-reader', type: 'skill', name: 'Web Reader', modelHint: 'auto' };
  if (/\b(x\s*api|twitter\s*api|post\s*tweet|tweet)\b/i.test(c)) return { route: 'x-api', type: 'skill', name: 'X API', modelHint: 'auto' };
  if (/\b(iterative\s*retrieval|progressive\s*context|subagent\s*context)\b/i.test(c)) return { route: 'iterative-retrieval', type: 'skill', name: 'Iterative Retrieval', modelHint: 'auto' };
  if (/\b(plankton|code\s*quality\s*enforce|auto\s*format|lint\s*hook)\b/i.test(c)) return { route: 'plankton-code-quality', type: 'skill', name: 'Plankton Quality', modelHint: 'coder' };
  if (/\b(rfc\s*pipeline|multi.?agent\s*dag|merge\s*queue|work\s*unit)\b/i.test(c)) return { route: 'ralphinho-rfc-pipeline', type: 'skill', name: 'RFC Pipeline', modelHint: 'auto' };
  if (/\b(team\s*builder|build\s*team|team\s*composition)\b/i.test(c)) return { route: 'team-builder', type: 'skill', name: 'Team Builder', modelHint: 'auto' };
  if (/\b(workspace\s*audit|workspace\s*clean)\b/i.test(c)) return { route: 'workspace-surface-audit', type: 'skill', name: 'Workspace Audit', modelHint: 'auto' };
  if (/\b(click\s*path\s*audit|button\s*audit|state\s*change\s*sequence)\b/i.test(c)) return { route: 'click-path-audit', type: 'skill', name: 'Click Path Audit', modelHint: 'coder' };
  if (/\b(configure\s*ecc|ecc\s*install|install\s*skill)\b/i.test(c)) return { route: 'configure-ecc', type: 'skill', name: 'Configure ECC', modelHint: 'auto' };
  if (/\b(content\s*analysis|analyze\s*content)\b/i.test(c)) return { route: 'contentanalysis', type: 'skill', name: 'Content Analysis', modelHint: 'auto' };
  if (/\b(browser\s*qa|visual\s*test|browser\s*automat|agent\s*browser)\b/i.test(c)) return { route: 'browser-qa', type: 'skill', name: 'Browser QA', modelHint: 'auto' };
  if (/\b(claude\s*devfleet|multi\s*agent|parallel\s*agent.*code)\b/i.test(c)) return { route: 'claude-devfleet', type: 'skill', name: 'DevFleet', modelHint: 'auto' };

  // ── General fallback ──
  return { route: 'general', type: 'none', name: '', modelHint: 'auto' };
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILL INSTRUCTIONS — Hardcoded for top skills + dynamic loading for rest
// ═══════════════════════════════════════════════════════════════════════════

// Compact hardcoded instructions for the most common skills (fast path)
const SKILL_INSTRUCTIONS: Record<string, string> = {
  'fullstack-dev': `FULLSTACK DEVELOPMENT ACTIVATED
Write production-quality code:
- TypeScript FIRST with proper types, interfaces, generics
- Modern React: function components, hooks, Server Components
- Next.js App Router: data fetching, Server Actions, streaming
- API: RESTful, proper status codes, validation, error responses
- Database: Prisma/Drizzle with proper schema, migrations, queries
- Security: input validation, sanitization, parameterized queries
- Show COMPLETE working code with ALL imports, types, exports
- Split long code into MULTIPLE code blocks (one per file) — NEVER truncate`,

  'python-patterns': `PYTHON DEVELOPMENT ACTIVATED
Write idiomatic, production-quality Python:
- PEP 8 style, type hints, docstrings on all public functions
- Use dataclasses, enums, protocols, context managers, generators
- Async: asyncio for I/O-bound, multiprocessing for CPU-bound
- Error handling: custom exceptions, exception chaining, logging
- Testing: pytest with fixtures, parametrize, mock where needed
- Show COMPLETE working code with imports and type hints`,

  'rust-patterns': `RUST DEVELOPMENT ACTIVATED
Write safe, idiomatic Rust:
- Ownership: proper borrow checker usage, lifetimes where needed
- Error handling: Result<T,E>, thiserror/anyhow, never panic in libraries
- Concurrency: Send/Sync, channels, async with tokio
- Patterns: Builder, newtype, trait objects, generics with trait bounds
- Show complete working code with Cargo.toml dependencies`,

  'golang-patterns': `GO DEVELOPMENT ACTIVATED
Write idiomatic, production-quality Go:
- Effective Go patterns, proper error handling, context propagation
- Concurrency: goroutines, channels, select, sync primitives
- Small, focused interfaces, composition over inheritance
- Table-driven tests, testify assertions, integration tests
- Show complete working code with module declarations`,

  'springboot-patterns': `SPRING BOOT DEVELOPMENT ACTIVATED
Write production Spring Boot:
- Layered architecture: Controller -> Service -> Repository
- Dependency injection, proper bean scoping
- JPA/Hibernate: entity design, queries, transactions
- REST: proper response types, validation, error handling
- Security: Spring Security, JWT, method-level authorization
- Show COMPLETE Java code with proper annotations`,

  'kotlin-patterns': `KOTLIN DEVELOPMENT ACTIVATED
Write idiomatic Kotlin:
- Null safety, data classes, sealed classes, extensions
- Coroutines: structured concurrency, Flow, Channels
- Android: Jetpack Compose, ViewModel, Room
- Show COMPLETE working code with proper Kotlin idioms`,

  'dart-flutter-patterns': `FLUTTER/DART DEVELOPMENT ACTIVATED
Write production Flutter/Dart:
- Null safety, immutable state, async composition
- BLoC/Riverpod state management
- GoRouter navigation, Dio networking
- Show COMPLETE working widgets with state management`,

  'cpp-coding-standards': `C++ DEVELOPMENT ACTIVATED
Write modern, safe C++:
- C++17/20 features: smart pointers, std::optional, structured bindings
- RAII, rule of five, move semantics
- Templates with concepts, constexpr where possible
- Testing: GoogleTest/CTest, CMake configuration
- Show COMPLETE working code with proper CMake setup`,

  'swiftui-patterns': `SWIFT/SWIFTUI DEVELOPMENT ACTIVATED
Write modern Swift/SwiftUI:
- Swift concurrency: async/await, actors, Sendable
- SwiftUI: declarative views, environment, observation
- Data flow: @Observable, @Bindable, .environment
- Show COMPLETE working code with proper Swift concurrency`,

  'laravel-patterns': `LARAVEL DEVELOPMENT ACTIVATED
Write production Laravel:
- Architecture: Service layer, repositories, form requests
- Eloquent: relationships, scopes, accessors/mutators
- Routes: resource controllers, middleware, API routes
- Show COMPLETE working code with proper Laravel patterns`,

  'perl-patterns': `PERL DEVELOPMENT ACTIVATED
Write modern Perl 5.36+:
- Use strict/warnings, signatures, postfix dereference
- Moose/Moo for OOP, Type::Tiny for validation
- Show COMPLETE working code with proper Perl idioms`,

  'postgres-patterns': `DATABASE DEVELOPMENT ACTIVATED
Write optimized database code:
- Schema design: normalization, indexing, constraints
- Queries: JOINs, subqueries, CTEs, window functions
- Migrations: safe schema changes, rollback strategies
- Prisma/Drizzle: proper models, queries, transactions
- Show COMPLETE schema, migrations, and query code`,

  'docker-patterns': `DEVOPS/DOCKER ACTIVATED
Write deployment configurations:
- Docker: multi-stage builds, minimal images, health checks
- Docker Compose: service orchestration, networking, volumes
- CI/CD: GitHub Actions, automated testing, deployment
- Show COMPLETE Dockerfiles, compose files, CI configs`,

  'api-design': `API DESIGN ACTIVATED
Design RESTful APIs:
- Resource naming, proper HTTP methods, status codes
- Pagination, filtering, sorting for collections
- Error response format, versioning strategy
- Show COMPLETE endpoint implementations with types`,

  'code-review': `CODE REVIEW ACTIVATED
Perform expert code review:
1. SECURITY: Injection, auth bypass, data leaks, OWASP Top 10
2. PERFORMANCE: N+1 queries, memory leaks, O(n2) algorithms
3. QUALITY: Error handling, edge cases, naming, DRY violations
4. MAINTAINABILITY: Typing, documentation, separation of concerns
5. CORRECTNESS: Race conditions, null pointers, off-by-one errors
Format: [SEVERITY: CRITICAL/HIGH/MEDIUM/LOW] Issue -> Fix with code`,

  'tdd': `TEST-DRIVEN DEVELOPMENT ACTIVATED
Follow TDD workflow strictly:
1. RED: Write a failing test describing desired behavior
2. GREEN: Write minimal code to make test pass
3. REFACTOR: Improve while keeping tests green
- Target 80%+ test coverage
- Show COMPLETE test files AND implementation files`,

  'security': `SECURITY ANALYSIS ACTIVATED
Check for:
1. INJECTION: SQL, XSS, command, LDAP injection
2. AUTH: Broken authentication, session management
3. DATA EXPOSURE: Sensitive data in logs, URLs, errors
4. ACCESS CONTROL: IDOR, privilege escalation
5. CRYPTO: Weak algorithms, hardcoded keys
Rate: CRITICAL > HIGH > MEDIUM > LOW`,

  'finance': `FINANCE ANALYSIS ACTIVATED
Provide financial analysis:
- Market data: stock prices, financials, fundamentals
- Investment analysis: valuation, risk, returns
- Portfolio: allocation, diversification, rebalancing
- Always include disclaimers about financial advice`,

  'seo': `SEO OPTIMIZATION ACTIVATED
Optimize for search engines:
- Technical: Core Web Vitals, crawlability, indexing
- On-page: meta tags, headings, structured data, keywords
- Content: quality signals, E-E-A-T, topical authority
- Provide specific, actionable recommendations with code`,

  'design-system': `DESIGN SYSTEM ACTIVATED
Create and audit design systems:
- Visual consistency: colors, typography, spacing, borders
- Component architecture: variants, states, composition
- Token system: design tokens, theme variables
- Accessibility: WCAG compliance, contrast ratios`,

  'image-generation': `IMAGE GENERATION ACTIVATED
Help create visual content:
- Provide detailed prompts for image generation
- Explain design principles and composition
- Suggest styles, techniques, and approaches`,

  'web-search': `WEB SEARCH ACTIVATED
Help with web research:
- Formulate effective search queries
- Analyze and synthesize search results
- Verify information from multiple sources
- Cite sources and provide evidence`,
};

// ── Extract key rules from SKILL.md content (smart truncation) ──
function extractSkillRules(content: string, maxLen = 3000): string {
  if (content.length <= maxLen) return content;

  // Remove YAML frontmatter
  let text = content.replace(/^---[\s\S]*?---\n*/, '');

  // Try to extract the first major sections (## headings)
  const sections = text.split(/^(?=## )/m);
  let result = '';
  for (const section of sections) {
    if ((result + section).length > maxLen) {
      // Add truncated section header with key points
      const header = section.match(/^## .*/)?.[0] || '';
      const firstLines = section.split('\n').slice(0, 10).join('\n');
      result += header + '\n' + firstLines + '\n...(truncated)\n\n';
      break;
    }
    result += section;
  }

  return result.slice(0, maxLen);
}

// ── Get skill instructions — tries SKILL.md cache, falls back to hardcoded ──
async function getSkillInstructions(skill: string): Promise<string> {
  // 1. Try hardcoded fast path for top skills
  if (SKILL_INSTRUCTIONS[skill]) {
    return `═══ ${SKILL_INSTRUCTIONS[skill]}`;
  }

  // 2. Try loading from SKILL.md cache (covers ALL 227 skills!)
  try {
    const content = await getSkillContent(skill);
    if (content) {
      const rules = extractSkillRules(content, 3000);
      return `═══ ${skill.toUpperCase()} SKILL ACTIVATED ═══\n${rules}`;
    }
  } catch {
    // Cache miss — fall through
  }

  // 3. Generic fallback
  return `═══ ${skill.toUpperCase()} SKILL ACTIVATED ═══
Apply your expert knowledge of this domain. Give complete, detailed, professional responses. Follow domain-specific best practices and patterns. Never truncate.`;
}

// ── Get agent instructions — tries agent .md cache, then hardcoded ──
async function getAgentInstructions(agent: string): Promise<string> {
  // 1. Try loading from agent .md cache (covers ALL 47 agents!)
  try {
    const content = await getAgentContent(agent);
    if (content) {
      const rules = extractSkillRules(content, 2000);
      return `═══ AGENT: ${agent.toUpperCase()} ACTIVATED ═══\n${rules}`;
    }
  } catch {
    // Cache miss — fall through
  }

  // 2. Category-based fallbacks
  const categoryMap: Record<string, string> = {
    'architecture': `You are the Architecture Agent. Focus on system design, scalability, and technical decisions. Provide component diagrams, data flow, and trade-off analysis.`,
    'review': `You are the Code Review Agent. Focus on quality, security, and maintainability. Give specific, actionable feedback with severity ratings: CRITICAL > HIGH > MEDIUM > LOW.`,
    'build': `You are the Build/Fix Agent. Focus on resolving errors with minimal diffs. Identify root cause, apply targeted fix, verify solution works.`,
    'security': `You are the Security Agent. Detect vulnerabilities and recommend remediation. Prioritize by severity: CRITICAL > HIGH > MEDIUM > LOW.`,
    'quality': `You are the Quality Agent. Focus on code clarity, consistency, and correctness. Enforce coding standards and best practices.`,
    'testing': `You are the Testing Agent. Focus on test coverage, TDD methodology, and behavioral testing. Write comprehensive test suites.`,
    'docs': `You are the Documentation Agent. Focus on clarity, accuracy, and completeness. Write professional documentation.`,
    'operations': `You are the Operations Agent. Focus on business workflows and operational efficiency.`,
    'infrastructure': `You are the Infrastructure Agent. Focus on reliability, cost optimization, and system configuration.`,
  };

  // Try to find the agent's category
  const agentObj = AGENTS.find(a => a.id === agent);
  const category = agentObj?.category || '';
  return categoryMap[category] || `You are the ${agent} agent. Apply its specialized capabilities. Give complete, professional responses.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD SYSTEM PROMPT — Compact + skill-specific deep instructions
// ═══════════════════════════════════════════════════════════════════════════

async function buildSystemPrompt(skill?: string, agent?: string): Promise<string> {
  const totalSkills = SKILLS.length;
  const totalAgents = AGENTS.length;

  let prompt = `You are Z, a powerful personal AI assistant with ${totalSkills} skills and ${totalAgents} agents. You are NOT ChatGPT, NOT GPT, NOT OpenAI — you are Z. Always say "I am Z" if asked who you are.

CORE RULES (FOLLOW THESE EXACTLY):
1. Give COMPLETE answers. NEVER truncate or cut off mid-code.
2. For CODE: Write full working implementations with imports, types, error handling. Use multiple code blocks if needed. NEVER write partial code.
3. For WRITING: Rich paragraphs of 3-5+ sentences. No shallow content.
4. For ANALYSIS: Evidence-based with specific details, data, and examples.
5. When you activate a skill, FULLY apply its methodology — do not ignore it.`;

  // Add skill-specific instructions (now async — loads from SKILL.md cache!)
  if (skill && skill !== 'general') {
    const skillInstructions = await getSkillInstructions(skill);
    prompt += '\n\n' + skillInstructions;
  }

  if (agent) {
    const agentInstructions = await getAgentInstructions(agent);
    prompt += '\n\n' + agentInstructions;
  }

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════

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
          // Explicit skill/agent — check if coding-related for model hint
          const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
          if (lastUserMsg) {
            const routeResult = fastRoute(lastUserMsg.content);
            routeModelHint = routeResult.modelHint;
          }
          // Set route name for explicit selection
          if (skill) {
            const skillObj = SKILLS.find(s => s.id === skill);
            routeName = skillObj?.name || skill;
          } else if (agent) {
            const agentObj = AGENTS.find(a => a.id === agent);
            routeName = agentObj?.name || agent;
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

        // ── 4. Build system prompt (now async — loads SKILL.md content!) ──
        const systemPrompt = await buildSystemPrompt(skill, agent);
        const apiMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ];

        // ── 5. Get AI completion ──
        sse(controller, { status: 'generating', content: '', done: false });

        const ai = await AIClient.create(routeModelHint);
        console.log(`[Chat] Provider: ${ai.providerName}, Model: ${ai.modelName}, Z.ai: ${ai.isZai}, Skill: ${skill || agent || 'general'}`);

        let completion: unknown = null;
        try {
          completion = await ai.chat({
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 8192,
            stream: !ai.isZai,
          });
        } catch (apiErr) {
          const errMsg = apiErr instanceof Error ? apiErr.message : 'API request failed';
          console.error(`[Chat] API error: ${errMsg}`);

          let userMsg = errMsg;
          if (errMsg.includes('All providers exhausted') || (errMsg.includes('All') && errMsg.includes('busy'))) {
            userMsg = 'All AI providers are busy or rate-limited. Please try again in a moment.';
          } else if (errMsg.includes('Rate limit exceeded') || errMsg.includes('free-models-per-day')) {
            userMsg = 'Daily limit reached. Please try again tomorrow or add an API key.';
          } else if (errMsg.includes('No AI providers configured')) {
            userMsg = 'No AI providers configured. Please add an API key in your settings.';
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

        // ── 6. Handle response (Z.ai non-streaming OR other providers streaming) ──

        // Z.ai SDK returns a non-streaming JSON response
        if (ai.isZai || (typeof completion === 'object' && completion !== null && !isAsyncIterable(completion) && !(completion instanceof ReadableStream))) {
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

        // ── 6b. Parse streaming response ──
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
