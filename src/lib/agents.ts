import type { Agent, AgentCategory } from '@/types';

export const AGENTS: Agent[] = [
  // Architecture
  { id: 'architect', name: 'Architect', description: 'Software architecture specialist for system design, scalability, and technical decisions', model: 'opus', tools: ['Read', 'Grep', 'Glob'], category: 'architecture' },
  { id: 'planner', name: 'Planner', description: 'Expert planning specialist for complex features and refactoring with step breakdown', model: 'opus', tools: ['Read', 'Grep', 'Glob'], category: 'architecture' },
  { id: 'code-architect', name: 'Code Architect', description: 'Designs feature architectures by analyzing existing codebase patterns and conventions', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'architecture' },
  { id: 'code-explorer', name: 'Code Explorer', description: 'Deeply analyzes existing codebase features by tracing execution paths and mapping architecture', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'architecture' },

  // Review
  { id: 'code-reviewer', name: 'Code Reviewer', description: 'Expert code review specialist for quality, security, maintainability', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'typescript-reviewer', name: 'TypeScript Reviewer', description: 'Expert TypeScript/JavaScript reviewer for type safety, async correctness, security', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'python-reviewer', name: 'Python Reviewer', description: 'Expert Python reviewer for PEP 8, Pythonic idioms, type hints, security', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'go-reviewer', name: 'Go Reviewer', description: 'Expert Go reviewer for idiomatic Go, concurrency, error handling', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'rust-reviewer', name: 'Rust Reviewer', description: 'Expert Rust reviewer for ownership, lifetimes, error handling, unsafe usage', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'java-reviewer', name: 'Java Reviewer', description: 'Expert Java/Spring Boot reviewer for layered architecture, JPA patterns, security', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'kotlin-reviewer', name: 'Kotlin Reviewer', description: 'Kotlin/Android/KMP reviewer for idiomatic patterns, coroutine safety, Compose', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'cpp-reviewer', name: 'C++ Reviewer', description: 'Expert C++ reviewer for memory safety, modern C++ idioms, concurrency', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'csharp-reviewer', name: 'C# Reviewer', description: 'Expert C# reviewer for .NET conventions, async patterns, nullable types', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'flutter-reviewer', name: 'Flutter Reviewer', description: 'Flutter/Dart reviewer for widget best practices, state management, Dart idioms', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'review' },
  { id: 'database-reviewer', name: 'Database Reviewer', description: 'PostgreSQL specialist for query optimization, schema design, security, RLS', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'review' },
  { id: 'healthcare-reviewer', name: 'Healthcare Reviewer', description: 'Reviews healthcare code for clinical safety, PHI compliance, medical data integrity', model: 'opus', tools: ['Read', 'Grep', 'Glob'], category: 'review' },

  // Build
  { id: 'build-error-resolver', name: 'Build Error Resolver', description: 'Build/TypeScript error resolution specialist with minimal diffs', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'build' },
  { id: 'go-build-resolver', name: 'Go Build Resolver', description: 'Go build, vet, and compilation error resolver', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'build' },
  { id: 'rust-build-resolver', name: 'Rust Build Resolver', description: 'Rust build and borrow checker resolver', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'build' },
  { id: 'kotlin-build-resolver', name: 'Kotlin Build Resolver', description: 'Kotlin/Gradle build resolver for compiler errors, detekt, ktlint', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'build' },
  { id: 'java-build-resolver', name: 'Java Build Resolver', description: 'Java/Maven/Gradle build resolver for compilation and config errors', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'build' },
  { id: 'cpp-build-resolver', name: 'C++ Build Resolver', description: 'C++ build/CMake resolver for compilation, linker, template errors', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'build' },
  { id: 'dart-build-resolver', name: 'Dart Build Resolver', description: 'Dart/Flutter build resolver for compilation and dependency issues', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'build' },
  { id: 'pytorch-build-resolver', name: 'PyTorch Build Resolver', description: 'PyTorch runtime/CUDA/training error resolver', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'build' },

  // Security
  { id: 'security-reviewer', name: 'Security Reviewer', description: 'Security vulnerability detection and remediation - OWASP Top 10, secrets detection', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'security' },

  // Quality
  { id: 'silent-failure-hunter', name: 'Silent Failure Hunter', description: 'Reviews code for silent failures, swallowed errors, bad fallbacks', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'quality' },
  { id: 'comment-analyzer', name: 'Comment Analyzer', description: 'Analyzes code comments for accuracy, completeness, and comment rot risk', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'quality' },
  { id: 'type-design-analyzer', name: 'Type Design Analyzer', description: 'Analyzes type design for encapsulation, invariant expression, and enforcement', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'quality' },
  { id: 'conversation-analyzer', name: 'Conversation Analyzer', description: 'Analyzes conversation transcripts to find behaviors worth preventing with hooks', model: 'sonnet', tools: ['Read', 'Grep'], category: 'quality' },
  { id: 'refactor-cleaner', name: 'Refactor Cleaner', description: 'Dead code cleanup and consolidation specialist', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'quality' },
  { id: 'code-simplifier', name: 'Code Simplifier', description: 'Simplifies code for clarity, consistency, maintainability while preserving behavior', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'quality' },
  { id: 'performance-optimizer', name: 'Performance Optimizer', description: 'Performance analysis and optimization specialist for profiling and bundle optimization', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'quality' },

  // Testing
  { id: 'tdd-guide', name: 'TDD Guide', description: 'TDD specialist enforcing write-tests-first methodology with Red-Green-Refactor', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep'], category: 'testing' },
  { id: 'e2e-runner', name: 'E2E Runner', description: 'E2E testing specialist using Agent Browser with Playwright fallback', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'testing' },
  { id: 'pr-test-analyzer', name: 'PR Test Analyzer', description: 'Reviews PR test coverage quality and completeness, behavioral coverage', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'testing' },

  // Docs
  { id: 'doc-updater', name: 'Doc Updater', description: 'Documentation and codemap specialist using AST analysis and dependency mapping', model: 'haiku', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'docs' },
  { id: 'docs-lookup', name: 'Docs Lookup', description: 'Documentation lookup via Context7 MCP for current library/API docs', model: 'sonnet', tools: ['Read', 'Grep'], category: 'docs' },

  // Operations
  { id: 'chief-of-staff', name: 'Chief of Staff', description: 'Personal communication chief of staff for email triage, drafting, follow-through', model: 'opus', tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'], category: 'operations' },
  { id: 'seo-specialist', name: 'SEO Specialist', description: 'SEO specialist for technical audits, on-page optimization, structured data', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'operations' },

  // Infrastructure
  { id: 'gan-planner', name: 'GAN Planner', description: 'GAN Harness Planner that expands prompts into full product specs with features and sprints', model: 'opus', tools: ['Read', 'Write', 'Grep', 'Glob'], category: 'infrastructure' },
  { id: 'gan-generator', name: 'GAN Generator', description: 'GAN Harness Generator that implements features per spec and iterates based on evaluator feedback', model: 'opus', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'infrastructure' },
  { id: 'gan-evaluator', name: 'GAN Evaluator', description: 'GAN Harness Evaluator that tests live apps and scores against rubric', model: 'opus', tools: ['Read', 'Write', 'Bash', 'Grep', 'Glob'], category: 'infrastructure' },
  { id: 'opensource-forker', name: 'OpenSource Forker', description: 'Forks project and strips secrets, replaces internal references, cleans git history', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'infrastructure' },
  { id: 'opensource-sanitizer', name: 'OpenSource Sanitizer', description: 'Verifies fork is sanitized by scanning for leaked secrets, PII, internal references', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash'], category: 'infrastructure' },
  { id: 'opensource-packager', name: 'OpenSource Packager', description: 'Generates complete open-source packaging: CLAUDE.md, README, LICENSE, CONTRIBUTING', model: 'sonnet', tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], category: 'infrastructure' },
  { id: 'loop-operator', name: 'Loop Operator', description: 'Operates autonomous agent loops, monitors progress, intervenes when stalls occur', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit'], category: 'infrastructure' },
  { id: 'harness-optimizer', name: 'Harness Optimizer', description: 'Analyzes and improves agent harness configuration for reliability, cost, throughput', model: 'sonnet', tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit'], category: 'infrastructure' },
];

export interface AgentCategoryInfo {
  id: AgentCategory;
  label: string;
  icon: string;
}

export const AGENT_CATEGORIES: AgentCategoryInfo[] = [
  { id: 'architecture', label: 'Architecture', icon: 'Building' },
  { id: 'review', label: 'Code Review', icon: 'Search' },
  { id: 'build', label: 'Build & Fix', icon: 'Code' },
  { id: 'security', label: 'Security', icon: 'Shield' },
  { id: 'quality', label: 'Quality', icon: 'ListChecks' },
  { id: 'testing', label: 'Testing', icon: 'TestTube' },
  { id: 'docs', label: 'Documentation', icon: 'PenTool' },
  { id: 'operations', label: 'Operations', icon: 'Factory' },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'Server' },
];

export const AGENT_COUNT = AGENTS.length;

export function getAgentsByCategory(category: AgentCategory): Agent[] {
  return AGENTS.filter((a) => a.category === category);
}

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function searchAgents(query: string): Agent[] {
  const q = query.toLowerCase();
  return AGENTS.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
  );
}
