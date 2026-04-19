'use client';

import { useChatStore } from '@/store/chat-store';
import { ChatPanel } from '@/components/chat/chat-panel';
import { ChatInput } from '@/components/chat/chat-input';
import { SkillSidebar } from '@/components/skills/skill-sidebar';
import { PreviewPanel } from '@/components/preview/preview-panel';
import { AnimatedCard } from '@/components/ui/animated-card';
import { PanelLeftOpen, Plus, Trash2, Brain, Eye, EyeOff, Sun, Moon, MessageSquare, Code, Search, Image as ImageIcon, FileCode, Globe, PanelRightOpen, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';

// Deterministic pseudo-random based on index — avoids hydration mismatch
function seeded(n: number, offset: number): number {
  const x = Math.sin(n * 127.1 + offset * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  width: `${seeded(i, 0) * 4 + 2}px`,
  height: `${seeded(i, 1) * 4 + 2}px`,
  left: `${seeded(i, 2) * 100}%`,
  top: `${seeded(i, 3) * 100}%`,
  animationDelay: `${seeded(i, 4) * 6}s`,
  animationDuration: `${seeded(i, 5) * 4 + 4}s`,
}));

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((style, i) => (
        <div key={i} className="particle" style={style} />
      ))}
    </div>
  );
}

function HomePage({ onQuickAction }: { onQuickAction: (prompt: string) => void }) {
  const quickActions = [
    { icon: <MessageSquare className="w-5 h-5 text-white" />, title: 'Chat', description: 'Start a conversation with your AI assistant', gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600', prompt: '' },
    { icon: <Code className="w-5 h-5 text-white" />, title: 'Write Code', description: 'Generate, explain, or debug code in any language', gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600', prompt: 'Write code: ' },
    { icon: <Search className="w-5 h-5 text-white" />, title: 'Search Web', description: 'Search the web for real-time information', gradient: 'bg-gradient-to-br from-teal-500 to-emerald-600', prompt: 'Search: ' },
    { icon: <ImageIcon className="w-5 h-5 text-white" />, title: 'Generate Image', description: 'Create stunning images from text descriptions', gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', prompt: 'Generate image: ' },
    { icon: <FileCode className="w-5 h-5 text-white" />, title: 'Review Code', description: 'Get expert code review and suggestions', gradient: 'bg-gradient-to-br from-rose-500 to-pink-600', prompt: 'Review this code: ' },
    { icon: <Globe className="w-5 h-5 text-white" />, title: 'Analyze Website', description: 'Analyze any website or web application', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600', prompt: 'Analyze website: ' },
  ];

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center h-full overflow-y-auto">
      <div className="absolute inset-0 animate-gradient-bg opacity-[0.04] dark:opacity-[0.08]" />
      <FloatingParticles />
      <div className="relative z-10 flex flex-col items-center gap-8 px-4 max-w-2xl mx-auto py-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center animate-brain-pulse shadow-lg">
          <Brain className="w-10 h-10 text-white" />
        </div>
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground animate-typing-reveal">Your Personal AI</h1>
          <p className="text-base sm:text-lg text-muted-foreground animate-typing-reveal-delay-1">
            <span className="text-emerald-500 font-semibold">227</span> Skills &bull;{' '}
            <span className="text-teal-500 font-semibold">47</span> Agents &bull;{' '}
            <span className="text-cyan-500 font-semibold">Infinite</span> Possibilities
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mt-2 animate-typing-reveal-delay-2">
          {quickActions.map((action, i) => (
            <AnimatedCard key={action.title} icon={action.icon} title={action.title} description={action.description} gradient={action.gradient} onClick={() => onQuickAction(action.prompt)} delay={i * 80} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const {
    messages, sidebarOpen, setSidebarOpen, activeConversationId, setActiveConversation,
    conversations, setConversations, addConversation, removeConversation,
    setMessages, previewOpen, setPreviewOpen, previewContent
  } = useChatStore();
  const { theme, setTheme } = useTheme();
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    (async () => { try { const r = await fetch('/api/skills'); const d = await r.json(); if (r.ok && d.conversations) setConversations(d.conversations); } catch {} })();
  }, [setConversations]);

  const createNewChat = async () => {
    try { const r = await fetch('/api/skills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Chat' }) }); const d = await r.json(); if (r.ok) addConversation(d.conversation); }
    catch { addConversation({ id: crypto.randomUUID(), title: 'New Chat', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] }); }
  };

  const deleteConversation = async (id: string) => { try { await fetch('/api/skills', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch {} removeConversation(id); };

  const selectConversation = (id: string) => { setActiveConversation(id); const c = conversations.find((x) => x.id === id); setMessages(c?.messages ? (c.messages as never[]) : []); };

  const handleQuickAction = useCallback((prompt: string) => {
    const event = new CustomEvent('quick-action', { detail: prompt });
    window.dispatchEvent(event);
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background animate-page-fade">
      {/* Top bar — always visible */}
      <header className="h-12 border-b border-border flex items-center px-3 gap-2 shrink-0 bg-background/95 backdrop-blur-sm z-10">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <PanelLeftOpen className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold">Personal AI</span>
        </div>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setHistoryOpen(!historyOpen)}>History</Button>

        {/* Preview toggle — ALWAYS PROMINENT */}
        <Button
          variant={previewOpen ? 'default' : 'outline'}
          size="sm"
          className={`h-7 gap-1.5 text-xs transition-all font-semibold ${previewOpen ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950'}`}
          onClick={() => setPreviewOpen(!previewOpen)}
        >
          <Code2 className="w-3.5 h-3.5" />
          {previewOpen ? 'Preview ON' : 'Preview'}
        </Button>

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </header>

      {/* Main body: sidebar + content + preview */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <SkillSidebar />

        {/* History Panel */}
        <div className={`border-r border-border bg-sidebar transition-all duration-300 flex flex-col shrink-0 ${historyOpen ? 'w-56' : 'w-0 overflow-hidden'}`}>
          <div className="p-3 flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold">History</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={createNewChat}><Plus className="w-4 h-4" /></Button>
          </div>
          <Separator />
          <ScrollArea className="flex-1 p-2">
            {conversations.length === 0 ? <div className="text-center py-8 text-muted-foreground text-xs">No conversations yet</div> :
              <div className="space-y-0.5">{conversations.map((c) => (
                <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer group transition-all duration-200 hover:scale-[1.01] ${activeConversationId === c.id ? 'bg-accent' : 'hover:bg-accent/50'}`} onClick={() => selectConversation(c.id)}>
                  <span className="flex-1 truncate">{c.title}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}</div>}
          </ScrollArea>
        </div>

        {/* Chat Area — takes all remaining space, adds right padding when preview is open */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300 ${previewOpen ? 'pr-[420px]' : ''}`}>
          <div className="flex-1 min-h-0 overflow-hidden">
            {hasMessages ? <ChatPanel /> : <HomePage onQuickAction={handleQuickAction} />}
          </div>
          <ChatInput />
        </div>
      </div>

      {/* Preview Panel — FLOATING overlay, always on top, never pushed off-screen */}
      <PreviewPanel />
    </div>
  );
}
