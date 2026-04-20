'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import { SKILLS, SKILL_CATEGORIES } from '@/lib/skills';
import { AGENTS, AGENT_CATEGORIES } from '@/lib/agents';
import type { Skill, Agent } from '@/types';
import {
  MessageSquare, Code, TestTube, Building, Shield, ListChecks, PenTool,
  Search, Image, Eye, Volume2, Mic, Globe, Video, Brain, Zap, X,
  ChevronDown, ChevronRight, Server, Database, Palette, Heart,
  Megaphone, GraduationCap, TrendingUp, Link, Atom, Scroll, Sparkles,
  Play, Info, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Code, TestTube, Building, Shield, ListChecks, PenTool,
  Search, Image, Eye, Volume2, Mic, Globe, Video, Brain, Zap, Server,
  Database, Palette, Heart, Megaphone, GraduationCap, TrendingUp, Link,
  Atom, Scroll, Sparkles,
};

// What each skill DOES when activated — clear, actionable descriptions
const SKILL_USAGE: Record<string, { action: string; example: string }> = {
  'image-generation': { action: 'AI generates images from your description', example: 'A sunset over mountains with a lake' },
  'image-understand': { action: 'AI analyzes and describes attached images', example: 'Attach an image, then ask about it' },
  'image-edit': { action: 'AI edits images based on your instructions', example: 'Make the background blue' },
  'web-search': { action: 'AI searches the web and summarizes results', example: 'Latest news about AI regulation' },
  'asr': { action: 'Convert speech to text via microphone', example: 'Click the mic button and speak' },
  'tts': { action: 'Read AI responses aloud', example: 'Click the speaker icon on any message' },
  'vlm': { action: 'Vision + Language model for image chat', example: 'Upload an image and ask questions' },
  'llm': { action: 'General LLM chat completions', example: 'Any question or task' },
  'claude-api': { action: 'Anthropic Claude API patterns & guidance', example: 'How to use Claude streaming API' },
  'python-patterns': { action: 'AI writes idiomatic, best-practice Python', example: 'Write a FastAPI endpoint with validation' },
  'golang-patterns': { action: 'AI writes idiomatic Go code', example: 'Create a concurrent worker pool' },
  'rust-patterns': { action: 'AI writes safe, idiomatic Rust', example: 'Implement a trait with lifetimes' },
  'kotlin-patterns': { action: 'AI writes idiomatic Kotlin', example: 'Create a sealed class hierarchy' },
  'swiftui-patterns': { action: 'AI writes modern SwiftUI code', example: 'Build a list with pull-to-refresh' },
  'django-patterns': { action: 'AI writes production Django code', example: 'Set up DRF with pagination and auth' },
  'laravel-patterns': { action: 'AI writes production Laravel code', example: 'Create a queued job with error handling' },
  'nestjs-patterns': { action: 'AI writes modular NestJS code', example: 'Build a CRUD module with DTOs' },
  'backend-patterns': { action: 'AI designs scalable backend systems', example: 'Design a rate-limited API' },
  'frontend-patterns': { action: 'AI writes modern React/Next.js code', example: 'Implement optimistic updates' },
  'api-design': { action: 'AI designs RESTful APIs', example: 'Design a pagination API for users' },
  'security-review': { action: 'AI scans for security vulnerabilities', example: 'Review this code for OWASP issues' },
  'tdd-workflow': { action: 'AI writes tests first, then code', example: 'TDD a user registration system' },
  'e2e-testing': { action: 'AI writes Playwright E2E tests', example: 'Test the checkout flow end-to-end' },
  'docker-patterns': { action: 'AI writes Docker/Compose configs', example: 'Multi-stage build for a Node app' },
  'deployment-patterns': { action: 'AI designs CI/CD pipelines', example: 'Blue-green deployment for K8s' },
  'database-migrations': { action: 'AI writes safe DB migrations', example: 'Add a column without downtime' },
  'postgres-patterns': { action: 'AI optimizes PostgreSQL queries', example: 'Optimize a slow JOIN query' },
  'charts': { action: 'AI creates charts and visualizations', example: 'Bar chart of monthly revenue' },
  'finance': { action: 'AI fetches and analyzes financial data', example: 'AAPL stock price and analysis' },
  'design-system': { action: 'AI generates/audits design systems', example: 'Create a button component system' },
  'codebase-onboarding': { action: 'AI creates onboarding guides', example: 'Onboard me to this codebase' },
  'git-workflow': { action: 'AI sets up Git branching strategies', example: 'Set up trunk-based development' },
  'github-ops': { action: 'AI manages GitHub repos & CI', example: 'Set up branch protection rules' },
  'benchmark': { action: 'AI creates performance benchmarks', example: 'Benchmark this API endpoint' },
  'mcp-server-patterns': { action: 'AI builds MCP servers', example: 'Create an MCP tool server' },
  'fullstack-dev': { action: 'AI builds full Next.js apps', example: 'Build a dashboard with auth' },
  'article-writing': { action: 'AI writes articles & blog posts', example: 'Write a post about AI safety' },
  'market-research': { action: 'AI conducts market research', example: 'Analyze the SaaS market for CRM tools' },
  'lead-intelligence': { action: 'AI finds & scores leads', example: 'Find leads for B2B SaaS' },
  'content-engine': { action: 'AI creates multi-platform content', example: 'Create a LinkedIn + X campaign' },
  'email-ops': { action: 'AI manages email workflows', example: 'Draft a follow-up to the client' },
  'dream-interpreter': { action: 'AI interprets dreams from 3 perspectives', example: 'I dreamed about flying over a city' },
  'mindfulness-meditation': { action: 'AI guides meditation sessions', example: 'Guide a 10-minute breathing meditation' },
  'healthcare-cdss-patterns': { action: 'AI builds clinical decision support', example: 'Drug interaction checking system' },
  'podcast-generate': { action: 'AI generates podcast scripts & audio', example: 'Create a podcast about space exploration' },
  'manim-video': { action: 'AI creates animated math explainers', example: 'Animate the Fourier transform' },
  'fal-ai-media': { action: 'AI generates images/videos via fal.ai', example: 'Generate a cinematic video clip' },
  'remotion-video-creation': { action: 'AI creates React-based videos', example: 'Build an animated intro video' },
  'data-scraper-agent': { action: 'AI builds data scraping agents', example: 'Scrape job listings daily' },
  'clickhouse-io': { action: 'AI writes optimized ClickHouse queries', example: 'Time-series analytics query' },
  'google-workspace-ops': { action: 'AI operates Google Docs/Sheets/Slides', example: 'Create a project tracker in Sheets' },
  'xlsx': { action: 'AI creates & processes Excel files', example: 'Generate a financial report spreadsheet' },
  'pdf': { action: 'AI creates & processes PDF files', example: 'Generate a project proposal PDF' },
  'docx': { action: 'AI creates & processes Word documents', example: 'Draft a contract document' },
  'ppt': { action: 'AI creates PowerPoint presentations', example: 'Create a pitch deck' },
  'agent-browser': { action: 'AI automates browser interactions', example: 'Navigate and extract data from a site' },
  'canary-watch': { action: 'AI monitors deployed URLs for regressions', example: 'Watch my staging URL after deploy' },
  'browser-qa': { action: 'AI runs automated visual testing', example: 'Test the checkout form visually' },
  'repo-scan': { action: 'AI audits source code assets', example: 'Scan for third-party dependencies' },
  'architecture-decision-records': { action: 'AI captures architectural decisions', example: 'Document why we chose PostgreSQL' },
  'hexagonal-architecture': { action: 'AI designs ports & adapters systems', example: 'Design a payment processing hexagon' },
  'coding-standards': { action: 'AI enforces coding conventions', example: 'Review code against our standards' },
  'continuous-learning': { action: 'AI extracts reusable patterns', example: 'Learn from this session' },
  'automation-audit-ops': { action: 'AI audits running automations', example: 'What automations are live and healthy?' },
  'dmux-workflows': { action: 'AI orchestrates parallel agent sessions', example: 'Run 3 agents in parallel on features' },
  'benchmark': { action: 'AI measures performance baselines', example: 'Benchmark before and after this PR' },
  'council': { action: 'AI convenes 4 advisors for decisions', example: 'Should we use microservices?' },
  'santa-method': { action: 'AI runs adversarial verification', example: 'Verify this implementation is correct' },
  'deep-research': { action: 'AI does multi-source deep research', example: 'Research AI regulation in the EU' },
  'exa-search': { action: 'AI performs neural web search', example: 'Find papers on transformer architecture' },
};

const AGENT_USAGE: Record<string, { action: string; example: string }> = {
  'code-reviewer': { action: 'Reviews code for quality, security & best practices', example: 'Review my authentication module' },
  'code-architect': { action: 'Designs system architecture & tech decisions', example: 'Design a microservices architecture' },
  'build-error-resolver': { action: 'Fixes build errors with minimal changes', example: 'Fix TypeScript compilation errors' },
  'doc-updater': { action: 'Updates documentation to match code', example: 'Update API docs for the new endpoints' },
  'database-reviewer': { action: 'Reviews DB schemas, queries & migrations', example: 'Review this migration for safety' },
  'security-scanner': { action: 'Scans for vulnerabilities & compliance issues', example: 'Scan for OWASP Top 10 issues' },
  'e2e-runner': { action: 'Runs & debugs E2E tests', example: 'Run the checkout flow tests' },
  'code-explorer': { action: 'Explores & explains codebases', example: 'How does the auth flow work?' },
  'code-simplifier': { action: 'Simplifies complex code without changing behavior', example: 'Simplify this 100-line function' },
  'chief-of-staff': { action: 'Manages priorities & coordinates tasks', example: 'What should I work on next?' },
  'gan-generator': { action: 'Generates code following best practices', example: 'Generate a REST API with validation' },
  'gan-evaluator': { action: 'Evaluates code quality against standards', example: 'Rate this module\'s quality' },
};

type SidebarTab = 'skills' | 'agents';

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SkillSidebar() {
  const { activeSkill, setActiveSkill, activeAgent, setActiveAgent, sidebarOpen, setSidebarOpen } = useChatStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>('skills');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<{ type: 'skill' | 'agent'; id: string } | null>(null);

  const toggleCategory = useCallback((id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Debounced search state
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Skills grouped by category with search
  const filteredSkills = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return SKILLS;
    return SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [debouncedQuery]);

  const groupedSkills = useMemo(() => {
    return SKILL_CATEGORIES.map((c) => ({
      ...c,
      skills: filteredSkills.filter((s) => s.category === c.id),
    })).filter((c) => c.skills.length > 0);
  }, [filteredSkills]);

  // Agents grouped by category with search
  const filteredAgents = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return AGENTS;
    return AGENTS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [debouncedQuery]);

  const groupedAgents = useMemo(() => {
    return AGENT_CATEGORIES.map((c) => ({
      ...c,
      agents: filteredAgents.filter((a) => a.category === c.id),
    })).filter((c) => c.agents.length > 0);
  }, [filteredAgents]);

  const totalSkills = SKILLS.length;
  const totalAgents = AGENTS.length;

  // Get usage info for a skill or agent
  const getUsageInfo = (id: string, type: 'skill' | 'agent') => {
    const usageMap = type === 'skill' ? SKILL_USAGE : AGENT_USAGE;
    return usageMap[id] || { action: `AI specializes in ${id.replace(/-/g, ' ')} patterns`, example: `Ask about ${id.replace(/-/g, ' ')}` };
  };

  // Get the selected item's details
  const selectedSkill = selectedItem?.type === 'skill' ? SKILLS.find(s => s.id === selectedItem.id) : null;
  const selectedAgent = selectedItem?.type === 'agent' ? AGENTS.find(a => a.id === selectedItem.id) : null;
  const selectedUsage = selectedItem ? getUsageInfo(selectedItem.id, selectedItem.type) : null;

  if (!sidebarOpen) {
    return (
      <div className="w-0 overflow-hidden transition-all duration-300" />
    );
  }

  return (
    <div className="h-full border-r border-border bg-sidebar transition-all duration-300 flex flex-col w-80">
      {/* Header */}
      <div className="p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center animate-brain-pulse">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Registry</h2>
            <p className="text-[10px] text-muted-foreground">
              {totalSkills} Skills &bull; {totalAgents} Agents
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 transition-all duration-200 hover:scale-110 hover:shadow-md" onClick={() => setSidebarOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Separator />

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search skills & agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Auto-routing notice */}
      <div className="mx-3 pt-1 pb-1 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-snug">
            Auto-routing active — just type and I'll pick the best skill or agent
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-1 pb-1">
        <div className="flex rounded-lg bg-muted p-0.5">
          <button
            onClick={() => setActiveTab('skills')}
            className={cn(
              'flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-200',
              activeTab === 'skills'
                ? 'bg-background shadow-sm text-foreground scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Skills ({searchQuery ? filteredSkills.length : totalSkills})
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={cn(
              'flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-200',
              activeTab === 'agents'
                ? 'bg-background shadow-sm text-foreground scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Agents ({searchQuery ? filteredAgents.length : totalAgents})
          </button>
        </div>
      </div>

      {/* Detail Panel (shows when item is selected — with ACTIVATE button) */}
      {selectedItem && selectedUsage && (
        <div className="mx-3 mb-1 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 animate-message-in">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {selectedSkill?.name || selectedAgent?.name || selectedItem.id}
            </h4>
            <button onClick={() => setSelectedItem(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-1.5">
              <Zap className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-foreground leading-relaxed">{selectedUsage.action}</p>
            </div>
            <div className="flex items-start gap-1.5">
              <ArrowRight className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed italic">&quot;{selectedUsage.example}&quot;</p>
            </div>
            {/* ACTIVATE button — sets skill/agent for next message */}
            <Button
              size="sm"
              className="w-full mt-2 h-7 text-[11px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              onClick={() => {
                if (selectedItem.type === 'skill' && selectedSkill) {
                  setActiveSkill(activeSkill?.id === selectedSkill.id ? null : selectedSkill);
                } else if (selectedItem.type === 'agent' && selectedAgent) {
                  setActiveAgent(activeAgent?.id === selectedAgent.id ? null : selectedAgent);
                }
              }}
            >
              <Zap className="w-3 h-3 mr-1" />
              {((selectedItem.type === 'skill' && activeSkill?.id === selectedItem.id) ||
                (selectedItem.type === 'agent' && activeAgent?.id === selectedItem.id))
                ? 'Deactivate'
                : `Activate this ${selectedItem.type === 'skill' ? 'Skill' : 'Agent'}`
              }
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1 px-1">
              {((selectedItem.type === 'skill' && activeSkill?.id === selectedItem.id) ||
                (selectedItem.type === 'agent' && activeAgent?.id === selectedItem.id))
                ? `This ${selectedItem.type} is active! Type your message to use it.`
                : `Or just type your request — I'll auto-detect the best ${selectedItem.type}.`
              }
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1 px-3 py-2">
        {activeTab === 'skills' ? (
          <div className="space-y-1">
            {groupedSkills.map((cat) => {
              const CatIcon = ICONS[cat.icon] || Brain;
              const isExpanded = expandedCategories[cat.id] !== false;
              return (
                <div key={cat.id} className="mb-2">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-all duration-200 rounded-md hover:bg-accent/50"
                  >
                    <span className="transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    </span>
                    <CatIcon className="w-3 h-3 shrink-0" />
                    <span className="flex-1 text-left">{cat.label}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                      {cat.skills.length}
                    </Badge>
                  </button>
                  <div className={cn('category-content', isExpanded ? 'expanded' : 'collapsed')}>
                    <div className="space-y-0.5 ml-1">
                      {cat.skills.map((skill: Skill, idx: number) => {
                        const Icon = ICONS[skill.icon] || MessageSquare;
                        const isSelected = selectedItem?.id === skill.id;
                        const isActive = activeSkill?.id === skill.id;
                        return (
                          <div key={skill.id} className="group relative">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedItem(selectedItem?.id === skill.id ? null : { type: 'skill', id: skill.id });
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedItem(selectedItem?.id === skill.id ? null : { type: 'skill', id: skill.id }); } }}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer',
                                isActive
                                  ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 shadow-sm ring-1 ring-violet-500/30 scale-[1.02]'
                                  : isSelected
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm scale-[1.02]'
                                  : 'hover:bg-accent hover:scale-[1.01] hover:shadow-sm',
                                isExpanded && 'sidebar-item-stagger'
                              )}
                              style={isExpanded ? { animationDelay: `${idx * 30}ms` } : undefined}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                              <div className="flex-1 text-left min-w-0">
                                <div className="font-medium truncate">
                                  {debouncedQuery ? highlightText(skill.name, debouncedQuery) : skill.name}
                                </div>
                                {!isSelected && skill.description && (
                                  <div className="text-[9px] leading-tight text-muted-foreground truncate">
                                    {debouncedQuery ? highlightText(skill.description.slice(0, 60), debouncedQuery) : skill.description.slice(0, 60)}
                                    {skill.description.length > 60 ? '...' : ''}
                                  </div>
                                )}
                              </div>
                              {/* Info button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem(selectedItem?.id === skill.id ? null : { type: 'skill', id: skill.id });
                                }}
                                className={cn(
                                  'h-5 w-5 rounded flex items-center justify-center shrink-0 transition-all duration-200',
                                  selectedItem?.id === skill.id
                                    ? 'bg-emerald-500/20 text-emerald-500'
                                    : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent'
                                )}
                                title="How to use this skill"
                              >
                                <Info className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {groupedAgents.map((cat) => {
              const CatIcon = ICONS[cat.icon] || Brain;
              const isExpanded = expandedCategories[`agent-${cat.id}`] !== false;
              return (
                <div key={cat.id} className="mb-2">
                  <button
                    onClick={() => toggleCategory(`agent-${cat.id}`)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-all duration-200 rounded-md hover:bg-accent/50"
                  >
                    <span className="transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    </span>
                    <CatIcon className="w-3 h-3 shrink-0" />
                    <span className="flex-1 text-left">{cat.label}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                      {cat.agents.length}
                    </Badge>
                  </button>
                  <div className={cn('category-content', isExpanded ? 'expanded' : 'collapsed')}>
                    <div className="space-y-0.5 ml-1">
                      {cat.agents.map((agent: Agent, idx: number) => {
                        const isSelected = selectedItem?.id === agent.id;
                        const isActive = activeAgent?.id === agent.id;
                        const modelColor = agent.model === 'opus' ? 'text-purple-500' : agent.model === 'haiku' ? 'text-blue-500' : 'text-emerald-500';
                        return (
                          <div key={agent.id} className="group relative">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedItem(isSelected ? null : { type: 'agent', id: agent.id });
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedItem(isSelected ? null : { type: 'agent', id: agent.id }); } }}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer',
                                isActive
                                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30 scale-[1.02]'
                                  : isSelected
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm scale-[1.02]'
                                  : 'hover:bg-accent hover:scale-[1.01] hover:shadow-sm',
                                isExpanded && 'sidebar-item-stagger'
                              )}
                              style={isExpanded ? { animationDelay: `${idx * 30}ms` } : undefined}
                            >
                              <Sparkles className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                              <div className="flex-1 text-left min-w-0">
                                <div className="font-medium truncate">
                                  {debouncedQuery ? highlightText(agent.name, debouncedQuery) : agent.name}
                                </div>
                                {!isSelected && agent.description && (
                                  <div className="text-[9px] leading-tight text-muted-foreground truncate">
                                    {debouncedQuery ? highlightText(agent.description.slice(0, 60), debouncedQuery) : agent.description.slice(0, 60)}
                                    {agent.description.length > 60 ? '...' : ''}
                                  </div>
                                )}
                              </div>
                              <span className={cn('text-[9px] font-mono font-bold shrink-0', modelColor)}>
                                {agent.model}
                              </span>
                              {/* Info button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedItem(selectedItem?.id === agent.id ? null : { type: 'agent', id: agent.id });
                                }}
                                className={cn(
                                  'h-5 w-5 rounded flex items-center justify-center shrink-0 transition-all duration-200',
                                  selectedItem?.id === agent.id
                                    ? 'bg-emerald-500/20 text-emerald-500'
                                    : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent'
                                )}
                                title="How to use this agent"
                              >
                                <Info className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Footer */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Zap className="w-3 h-3" />
            {totalSkills} Skills
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Sparkles className="w-3 h-3" />
            {totalAgents} Agents
          </Badge>
        </div>
      </div>
    </div>
  );
}
