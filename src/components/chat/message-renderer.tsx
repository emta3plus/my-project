'use client';

import React, { useMemo, useCallback, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import kotlin from 'highlight.js/lib/languages/kotlin';
import swift from 'highlight.js/lib/languages/swift';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import scala from 'highlight.js/lib/languages/scala';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import shell from 'highlight.js/lib/languages/shell';
import { Copy, Check, Eye, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChatStore } from '@/store/chat-store';
import { toast } from 'sonner';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('kt', kotlin);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rb', ruby);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('docker', dockerfile);

interface CodeBlockProps {
  language: string;
  code: string;
  isStreaming?: boolean;
}

function getFileExtension(language: string): string {
  const extMap: Record<string, string> = {
    javascript: 'js', js: 'js', typescript: 'ts', ts: 'tsx',
    python: 'py', py: 'py', css: 'css', html: 'html', xml: 'xml',
    json: 'json', bash: 'sh', sql: 'sql', yaml: 'yml', yml: 'yml',
    rust: 'rs', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    csharp: 'cs', cs: 'cs', kotlin: 'kt', kt: 'kt', swift: 'swift',
    php: 'php', ruby: 'rb', rb: 'rb', jsx: 'jsx', tsx: 'tsx',
    markdown: 'md', md: 'md', scala: 'scala', dockerfile: 'dockerfile',
    shell: 'sh', docker: 'dockerfile',
  };
  return extMap[language.toLowerCase()] || 'txt';
}

function CodeBlock({ language, code, isStreaming }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { setPreviewContent, setPreviewOpen } = useChatStore();

  const highlighted = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  }, [code, language]);

  const lines = code.split('\n');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handlePreview = useCallback(() => {
    const isHtmlLike = ['html', 'xml', 'svg'].includes(language?.toLowerCase()) || code.trim().startsWith('<');
    const isReactLike = code.includes('return (') && (code.includes('React') || code.includes('useState') || code.includes('jsx'));

    if (isHtmlLike || isReactLike) {
      setPreviewContent({ type: 'html', content: code, language });
    } else {
      setPreviewContent({ type: 'code', content: code, language });
    }
    setPreviewOpen(true);
  }, [code, language, setPreviewContent, setPreviewOpen]);

  const handleDownload = useCallback(() => {
    const ext = getFileExtension(language || 'txt');
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
  }, [code, language]);

  const displayLang = language || 'code';

  return (
    <div className="code-block-container my-3 rounded-xl overflow-hidden border border-border/50 bg-[#0d1117] dark:bg-[#161b22]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] dark:bg-[#1c2333] border-b border-border/30">
        <Badge variant="secondary" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
          {displayLang}
        </Badge>
        <div className="flex items-center gap-0.5">
          {/* View / Preview button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
            onClick={handlePreview}
            title="View in Preview Panel"
          >
            <Eye className="w-3 h-3" /> View
          </Button>
          {/* Download button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            onClick={handleDownload}
            title="Download code"
          >
            <Download className="w-3 h-3" /> Download
          </Button>
          {/* Copy button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/10"
            onClick={handleCopy}
            title="Copy"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
      {/* Code content */}
      <div className="flex overflow-x-auto">
        {/* Line numbers */}
        <div className="flex-shrink-0 py-4 pl-4 pr-2 select-none">
          {lines.map((_, i) => (
            <div key={i} className="text-[12px] leading-5 text-white/20 font-mono text-right">
              {i + 1}
            </div>
          ))}
        </div>
        {/* Code */}
        <pre className="flex-1 py-4 px-4 overflow-x-auto">
          <code
            className={`language-${displayLang} text-[12px] leading-5 font-mono`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
          {isStreaming && <span className="inline-block w-2 h-4 bg-emerald-400 animate-streaming-cursor ml-0.5 align-text-bottom" />}
        </pre>
      </div>
    </div>
  );
}

interface InlineCodeProps {
  children: string;
}

function InlineCode({ children }: InlineCodeProps) {
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-muted text-foreground text-[13px] font-mono">
      {children}
    </code>
  );
}

interface ParsedBlock {
  type: 'code' | 'text';
  language?: string;
  content: string;
}

function parseMessageContent(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index);
      if (textContent.trim()) {
        blocks.push({ type: 'text', content: textContent });
      }
    }
    blocks.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex);
    if (textContent.trim()) {
      blocks.push({ type: 'text', content: textContent });
    }
  }

  return blocks;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split by inline code, bold, italic, and links
  const regex = /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Inline code
      parts.push(<InlineCode key={`ic-${keyIndex++}`}>{match[2]}</InlineCode>);
    } else if (match[4]) {
      // Bold
      parts.push(<strong key={`b-${keyIndex++}`} className="font-semibold text-foreground">{match[4]}</strong>);
    } else if (match[6]) {
      // Italic
      parts.push(<em key={`i-${keyIndex++}`} className="italic">{match[6]}</em>);
    } else if (match[8] && match[9]) {
      // Link
      parts.push(
        <a
          key={`a-${keyIndex++}`}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2 inline-flex items-center gap-0.5"
        >
          {match[8]}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderTextBlock(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const result: React.ReactNode[] = [];
  let listItems: string[] = [];
  let orderedList = false;
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = orderedList ? 'ol' : 'ul';
      result.push(
        <ListTag key={`list-${listKey++}`} className={`ml-4 mb-2 ${orderedList ? 'list-decimal' : 'list-disc'}`}>
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed mb-1">{renderInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heading patterns
    const h3Match = line.match(/^###\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h1Match = line.match(/^#\s+(.+)/);

    if (h3Match) {
      flushList();
      result.push(<h3 key={`h3-${i}`} className="text-base font-semibold text-foreground mt-3 mb-1">{renderInlineMarkdown(h3Match[1])}</h3>);
      continue;
    }
    if (h2Match) {
      flushList();
      result.push(<h2 key={`h2-${i}`} className="text-lg font-semibold text-foreground mt-4 mb-2">{renderInlineMarkdown(h2Match[1])}</h2>);
      continue;
    }
    if (h1Match) {
      flushList();
      result.push(<h1 key={`h1-${i}`} className="text-xl font-bold text-foreground mt-4 mb-2">{renderInlineMarkdown(h1Match[1])}</h1>);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      orderedList = false;
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      orderedList = true;
      listItems.push(olMatch[1]);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList();
      result.push(<hr key={`hr-${i}`} className="my-3 border-border" />);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    result.push(<p key={`p-${i}`} className="text-sm leading-relaxed mb-2">{renderInlineMarkdown(line)}</p>);
  }

  flushList();
  return result;
}

interface MessageRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function MessageRenderer({ content, isStreaming = false }: MessageRendererProps) {
  const blocks = useMemo(() => parseMessageContent(content), [content]);

  // Handle streaming with potentially unclosed code block
  const processedBlocks = useMemo(() => {
    if (!isStreaming) return blocks;

    // Check for unclosed code block in streaming
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock?.type === 'text') {
      const unclosedMatch = lastBlock.content.match(/```(\w*)\n([\s\S]*)$/);
      if (unclosedMatch) {
        // Split into text before code and the streaming code block
        const beforeCode = lastBlock.content.slice(0, lastBlock.content.lastIndexOf('```'));
        const result: ParsedBlock[] = [
          ...blocks.slice(0, -1),
        ];
        if (beforeCode.trim()) {
          result.push({ type: 'text', content: beforeCode });
        }
        result.push({
          type: 'code',
          language: unclosedMatch[1] || 'plaintext',
          content: unclosedMatch[2],
        });
        return result;
      }
    }
    return blocks;
  }, [blocks, isStreaming]);

  return (
    <div className="message-renderer">
      {processedBlocks.map((block, i) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={`code-${i}`}
              language={block.language || 'plaintext'}
              code={block.content}
              isStreaming={isStreaming && i === processedBlocks.length - 1}
            />
          );
        }
        return (
          <div key={`text-${i}`}>
            {renderTextBlock(block.content)}
          </div>
        );
      })}
      {isStreaming && processedBlocks[processedBlocks.length - 1]?.type === 'text' && (
        <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-streaming-cursor ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}
