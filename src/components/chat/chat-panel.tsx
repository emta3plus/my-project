'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import { SKILLS } from '@/lib/skills';
import { AGENTS } from '@/lib/agents';
import { MessageRenderer } from '@/components/chat/message-renderer';
import { Volume2, Bot, User, Copy, Check, Eye, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      <div className="typing-dot w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <div className="typing-dot w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <div className="typing-dot w-1.5 h-1.5 rounded-full bg-emerald-500" />
    </div>
  );
}

function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Extract the first code block from message content
function extractFirstCodeBlock(content: string): { code: string; language: string } | null {
  const match = content.match(/```(\w*)\n([\s\S]*?)```/);
  if (match) {
    return { code: match[2], language: match[1] || 'plaintext' };
  }
  // Check for streaming code block (unclosed)
  const streamingMatch = content.match(/```(\w*)\n([\s\S]*?)$/);
  if (streamingMatch) {
    return { code: streamingMatch[2], language: streamingMatch[1] || 'plaintext' };
  }
  // Check for HTML-like content
  if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html') || content.trim().startsWith('<div')) {
    return { code: content, language: 'html' };
  }
  return null;
}

export function ChatPanel() {
  const { messages, activeSkill, activeAgent, setPreviewContent, setPreviewOpen, previewOpen } = useChatStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAutoPreviewId = useRef<string | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-open preview when a new code block appears in the last assistant message
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (lastMsg.id === lastAutoPreviewId.current) return;

    const codeBlock = extractFirstCodeBlock(lastMsg.content);
    if (codeBlock) {
      const isHtmlLike = ['html', 'xml', 'svg', 'jsx', 'tsx'].includes(codeBlock.language?.toLowerCase()) ||
        codeBlock.code.trim().startsWith('<') ||
        codeBlock.code.includes('<!DOCTYPE');

      setPreviewContent({
        type: isHtmlLike ? 'html' : 'code',
        content: codeBlock.code,
        language: codeBlock.language,
      });

      if (!previewOpen) {
        setPreviewOpen(true);
      }

      lastAutoPreviewId.current = lastMsg.id;
    }
  }, [messages, previewOpen, setPreviewContent, setPreviewOpen]);

  // Update preview content as streaming progresses
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isStreaming) return;

    const codeBlock = extractFirstCodeBlock(lastMsg.content);
    if (codeBlock) {
      const isHtmlLike = ['html', 'xml', 'svg', 'jsx', 'tsx'].includes(codeBlock.language?.toLowerCase()) ||
        codeBlock.code.trim().startsWith('<') ||
        codeBlock.code.includes('<!DOCTYPE');

      setPreviewContent({
        type: isHtmlLike ? 'html' : 'code',
        content: codeBlock.code,
        language: codeBlock.language,
      });
    }
  }, [messages, setPreviewContent]);

  const speakText = async (text: string) => {
    try {
      const plain = text.replace(/[#*`[\]()]/g, '').replace(/\n+/g, ' ');
      for (let i = 0; i < plain.length; i += 900) {
        const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: plain.slice(i, i + 900) }) });
        if (!res.ok) continue; const audio = new Audio(URL.createObjectURL(await res.blob())); await audio.play();
      }
    } catch { toast.error('TTS unavailable'); }
  };

  const resolveBadgeName = (msgSkill: string) => {
    const skill = SKILLS.find((s) => s.id === msgSkill);
    if (skill) return skill.name;
    const agent = AGENTS.find((a) => a.id === msgSkill);
    if (agent) return agent.name;
    return msgSkill;
  };

  const handlePreviewCode = useCallback((content: string) => {
    const isHtmlLike = content.trim().startsWith('<') || content.includes('<html') || content.includes('<!DOCTYPE');
    if (isHtmlLike) {
      setPreviewContent({ type: 'html', content, language: 'html' });
    } else {
      setPreviewContent({ type: 'code', content, language: 'typescript' });
    }
    setPreviewOpen(true);
  }, [setPreviewContent, setPreviewOpen]);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-6 space-y-4 message-scroll">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div key={msg.id} className={`message-wrapper flex gap-3 max-w-4xl mx-auto animate-message-in ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'}`}>
              {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
              {msg.imageUrl && (
                <div className={`mb-2 ${isUser ? 'flex justify-end' : ''}`}>
                  <img
                    src={msg.imageUrl}
                    alt=""
                    className="max-w-sm rounded-lg border border-border cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                    onClick={() => {
                      if (msg.imageUrl) {
                        setPreviewContent({ type: 'image', content: msg.imageUrl });
                        setPreviewOpen(true);
                      }
                    }}
                  />
                </div>
              )}
              <div className={`inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-full ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
                {msg.isStreaming && !msg.content ? (
                  <div className="flex items-center gap-2">
                    <TypingIndicator />
                    <span className="text-muted-foreground text-xs">Thinking...</span>
                  </div>
                ) : isUser ? (
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                ) : (
                  <MessageRenderer content={msg.content} isStreaming={msg.isStreaming} />
                )}
              </div>
              {!isUser && !msg.isStreaming && msg.content && !msg.content.startsWith('Error:') && (
                <div className="flex items-center gap-1 mt-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 transition-all duration-200 hover:scale-110" onClick={() => speakText(msg.content)} title="Read aloud">
                    <Volume2 className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 transition-all duration-200 hover:scale-110" onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedId(msg.id); setTimeout(() => setCopiedId(null), 2000); toast.success('Copied'); }} title="Copy">
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 transition-all duration-200 hover:scale-110" onClick={() => handlePreviewCode(msg.content)} title="View in Preview Panel">
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 transition-all duration-200 hover:scale-110 text-emerald-500 hover:text-emerald-600"
                    onClick={() => {
                      // Extract code blocks or use full content
                      const codeBlock = extractFirstCodeBlock(msg.content);
                      const content = codeBlock ? codeBlock.code : msg.content;
                      const ext = codeBlock?.language || 'txt';
                      const blob = new Blob([content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `ai-output.${ext}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast.success('Downloaded');
                    }}
                    title="Download"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 transition-all duration-200 hover:scale-110 text-blue-500 hover:text-blue-600"
                    onClick={() => {
                      const codeBlock = extractFirstCodeBlock(msg.content);
                      if (codeBlock) {
                        const isHtml = ['html', 'xml', 'svg'].includes(codeBlock.language?.toLowerCase()) || codeBlock.code.trim().startsWith('<');
                        if (isHtml) {
                          const newWin = window.open('', '_blank');
                          if (newWin) { newWin.document.write(codeBlock.code); newWin.document.close(); }
                        } else {
                          const newWin = window.open('', '_blank');
                          if (newWin) {
                            newWin.document.write(`<!DOCTYPE html><html><head><title>Code</title><style>body{margin:0;background:#0d1117;color:#c9d1d9;font-family:monospace;white-space:pre;padding:20px;font-size:13px;line-height:1.6;}</style></head><body>${codeBlock.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`);
                            newWin.document.close();
                          }
                        }
                      } else {
                        const newWin = window.open('', '_blank');
                        if (newWin) {
                          newWin.document.write(`<!DOCTYPE html><html><head><title>Output</title><style>body{margin:0;background:#0d1117;color:#c9d1d9;font-family:monospace;white-space:pre-wrap;padding:20px;font-size:13px;line-height:1.6;}</style></head><body>${msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`);
                          newWin.document.close();
                        }
                      }
                    }}
                    title="View in new window"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                  <span className="message-timestamp text-[10px] text-muted-foreground ml-2">{formatTimestamp(msg.createdAt)}</span>
                </div>
              )}
              {msg.skill && <Badge variant="outline" className="text-[10px] mt-1">{resolveBadgeName(msg.skill)}</Badge>}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
