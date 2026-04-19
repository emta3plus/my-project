'use client';

import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { useChatStore } from '@/store/chat-store';
import type { Message } from '@/types';
import { Send, Mic, MicOff, Image as ImageIcon, Loader2, Zap, Brain, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ── SSE Stream Reader with keepalive support and better error handling ──
async function streamChat(
  url: string,
  body: Record<string, unknown>,
  onChunk: (content: string) => void,
  onDone: (usage?: Record<string, number>) => void,
  onError: (error: string) => void,
  onRoute?: (name: string, type: 'skill' | 'agent', id: string) => void,
  onStatus?: (status: string) => void,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (fetchErr) {
    onError(`Network error: ${fetchErr instanceof Error ? fetchErr.message : 'Request failed'}`);
    return;
  }

  // Handle non-200 responses
  if (!res.ok) {
    try {
      const errorText = await res.text();
      let errorMsg = `Server error (${res.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error || errorMsg;
      } catch {
        errorMsg += `: ${errorText.slice(0, 200)}`;
      }
      onError(errorMsg);
    } catch {
      onError(`Server error (${res.status})`);
    }
    return;
  }

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    const reader = res.body?.getReader();
    if (!reader) {
      onError('No response stream available');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let hasReceivedData = false;
    let lastActivityTime = Date.now();
    const STREAM_TIMEOUT_MS = 120_000; // 2 min timeout for no activity

    try {
      while (true) {
        // Check for stream timeout (no data for too long)
        if (Date.now() - lastActivityTime > STREAM_TIMEOUT_MS) {
          onError('Stream timed out — no data received for 2 minutes');
          return;
        }

        const { done, value } = await reader.read();
        if (done) {
          // Stream ended — if we got some content, consider it a success
          if (hasReceivedData) {
            onDone();
          } else {
            onError('Stream ended without any data');
          }
          return;
        }

        lastActivityTime = Date.now();
        hasReceivedData = true;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines and SSE comments (used as keepalives)
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') {
            onDone();
            return;
          }

          try {
            const data = JSON.parse(jsonStr);

            // Error from server
            if (data.error) {
              onError(String(data.error));
              return;
            }

            // Auto-route event
            if (data.route && onRoute) {
              onRoute(data.route, data.routeType, data.routeId);
            }

            // Status events (thinking, routing, generating)
            if (data.status && onStatus) {
              onStatus(data.status);
            }

            // Content chunk
            if (data.content) {
              onChunk(data.content);
            }

            // Done signal
            if (data.done) {
              onDone(data.usage);
              return;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (readErr: unknown) {
      // Only show error if we haven't received any content yet
      const errMessage = readErr instanceof Error ? readErr.message : 'Unknown error';

      // Common browser errors that mean the connection was lost
      const isConnectionLost =
        errMessage.includes('input stream') ||
        errMessage.includes('network') ||
        errMessage.includes('abort') ||
        errMessage.includes('fetch');

      if (isConnectionLost && hasReceivedData) {
        // We got some data before the connection dropped — treat as partial success
        console.warn('[Stream] Connection lost after receiving data, treating as partial completion');
        onDone();
      } else {
        onError(`Stream error: ${errMessage}. Try sending your message again.`);
      }
    }
  } else {
    // Non-streaming JSON response
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data.error) {
        onError(String(data.error));
      } else if (data.content) {
        onChunk(data.content);
        onDone(data.usage);
      }
    } catch {
      onError(`Server returned non-JSON response (status ${res.status}). ${text.slice(0, 200)}`);
    }
  }
}

async function safeFetchJSON(url: string, options: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (fetchErr) {
    throw new Error(`Network error: ${fetchErr instanceof Error ? fetchErr.message : 'Request failed'}`);
  }
  const text = await res.text();
  if (!text) throw new Error(`Server returned empty response (status ${res.status})`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON response (status ${res.status}). ${text.slice(0, 200)}`);
  }
}

export function ChatInput() {
  const { messages, addMessage, isLoading, setIsLoading, activeConversationId } = useChatStore();
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [autoRouteLabel, setAutoRouteLabel] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateLastMsg = useCallback((updater: (m: Message) => Message) => {
    useChatStore.setState((s) => {
      const msgs = [...s.messages];
      if (msgs.length > 0) msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
      return { messages: msgs };
    });
  }, []);

  const appendToLastMsg = useCallback((extraContent: string) => {
    useChatStore.setState((s) => {
      const msgs = [...s.messages];
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        msgs[msgs.length - 1] = { ...last, content: last.content + extraContent };
      }
      return { messages: msgs };
    });
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if ((!trimmed && !attachedImage) || isLoading) return;

    const content = trimmed;
    setAutoRouteLabel(null);
    setStreamStatus('thinking');

    addMessage({ id: crypto.randomUUID(), role: 'user', content, imageUrl: attachedImage || undefined, createdAt: new Date().toISOString() });
    addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', isStreaming: true, createdAt: new Date().toISOString() });
    setInput('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const lowerContent = content.toLowerCase();
      const isImageGenIntent = /\b(generate|create|draw|make)\b.*\b(image|picture|photo|illustration|artwork)\b/.test(lowerContent);

      if (isImageGenIntent && !attachedImage) {
        // Image generation
        setAutoRouteLabel('Image Generation');
        setStreamStatus('generating');
        const data = await safeFetchJSON('/api/image-gen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmed }),
        });
        if (data.error) throw new Error(String(data.error));
        updateLastMsg((m) => ({
          ...m,
          content: `Generated image for: "${trimmed}"`,
          imageUrl: `data:image/png;base64,${data.image}`,
          skill: 'image-generation',
          isStreaming: false,
        }));
      } else {
        // All other messages go through the unified chat API with auto-routing
        const chatMsgs = messages
          .filter((m) => !m.isStreaming)
          .map((m) => ({ role: m.role, content: m.content }));
        chatMsgs.push({ role: 'user', content });

        // If image is attached, analyze it first
        if (attachedImage) {
          try {
            const vd = await safeFetchJSON('/api/vision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: content || 'Describe this image',
                imageBase64: attachedImage.replace(/^data:image\/\w+;base64,/, ''),
              }),
            });
            if (!vd.error && vd.description) {
              chatMsgs.push({ role: 'user', content: `[Image Analysis Result]: ${vd.description}` });
            }
          } catch {
            /* optional vision */
          }
        }

        await streamChat(
          '/api/chat',
          { messages: chatMsgs, conversationId: activeConversationId, stream: true },
          (chunk) => {
            appendToLastMsg(chunk);
          },
          (usage) => {
            setStreamStatus(null);
            updateLastMsg((m) => ({ ...m, isStreaming: false, tokensUsed: usage?.total_tokens }));
          },
          (error) => {
            setStreamStatus(null);
            updateLastMsg((m) => ({
              ...m,
              content: m.content
                ? `${m.content}\n\n⚠️ *Connection lost. Partial response shown above.*`
                : `Error: ${error}`,
              isStreaming: false,
            }));
          },
          // Auto-route callback
          (name, type, id) => {
            setAutoRouteLabel(name);
            updateLastMsg((m) => ({ ...m, skill: id }));
          },
          // Status callback (thinking, routing, generating)
          (status) => {
            setStreamStatus(status);
          },
        );
      }
    } catch (e) {
      setStreamStatus(null);
      updateLastMsg((m) => ({
        ...m,
        content: `Error: ${e instanceof Error ? e.message : 'Failed'}`,
        isStreaming: false,
      }));
    } finally {
      setIsLoading(false);
      setStreamStatus(null);
      updateLastMsg((m) => (m.isStreaming ? { ...m, isStreaming: false } : m));
    }
  }, [input, attachedImage, isLoading, activeConversationId, messages, addMessage, setIsLoading, updateLastMsg, appendToLastMsg]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const d = await safeFetchJSON('/api/asr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: (reader.result as string).split(',')[1] }),
            });
            if (!d.error && d.text) {
              setInput(String(d.text));
              toast.success('Transcribed');
            }
          } catch {
            toast.error('ASR failed');
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      toast.error('Microphone denied');
    }
  };

  const handleImageAttach = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setAttachedImage(r.result as string);
    r.readAsDataURL(f);
  };

  // Quick action listener
  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent).detail as string;
      if (prompt) {
        setInput(prompt);
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    };
    window.addEventListener('quick-action', handler);
    return () => window.removeEventListener('quick-action', handler);
  }, []);

  // Status indicator text and icon
  const statusDisplay = streamStatus
    ? streamStatus === 'thinking'
      ? { text: 'Thinking...', icon: <Brain className="w-3 h-3 animate-pulse" /> }
      : streamStatus === 'routing'
        ? { text: 'Selecting skill...', icon: <Route className="w-3 h-3 animate-pulse" /> }
        : streamStatus === 'generating'
          ? { text: 'Generating...', icon: <Zap className="w-3 h-3 animate-pulse" /> }
          : null
    : null;

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur-sm">
      {attachedImage && (
        <div className="px-4 pt-3">
          <div className="relative inline-block">
            <img src={attachedImage} alt="" className="h-20 rounded-lg border border-border" />
            <button
              onClick={() => setAttachedImage(null)}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs transition-transform duration-200 hover:scale-110"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="px-4 pt-2 pb-1 flex items-center gap-2 flex-wrap">
        {autoRouteLabel && (
          <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <Zap className="w-3 h-3" />
            Auto: {autoRouteLabel}
          </Badge>
        )}
        {statusDisplay && (
          <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse">
            {statusDisplay.icon}
            {statusDisplay.text}
          </Badge>
        )}
      </div>

      <div className="p-4 pt-2">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 transition-all duration-200 hover:scale-110 hover:shadow-md"
              title="Attach image"
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageAttach} className="hidden" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleRecording}
              className={`shrink-0 transition-all duration-200 hover:scale-110 hover:shadow-md ${isRecording ? 'text-red-500 bg-red-50 dark:bg-red-950' : ''}`}
              title="Voice input"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          </div>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything — I'll automatically pick the right skill or agent..."
            className="flex-1 min-h-[44px] max-h-[200px] resize-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !attachedImage)}
            size="icon"
            className="shrink-0 transition-all duration-200 hover:scale-110 hover:shadow-md bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
