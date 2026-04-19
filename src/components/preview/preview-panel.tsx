'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import {
  X, Code, FileCode, Image as ImageIcon, FileText,
  ZoomIn, ZoomOut, Copy, Check, Eye, Layers,
  Download, ExternalLink, Maximize2, Minimize2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import hljs from 'highlight.js/lib/core';

// Register languages for preview panel
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
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

const registered = new Set<string>();
function registerLang(name: string, lang: unknown) {
  if (!registered.has(name)) {
    hljs.registerLanguage(name, lang as never);
    registered.add(name);
  }
}
registerLang('javascript', javascript);
registerLang('js', javascript);
registerLang('typescript', typescript);
registerLang('ts', typescript);
registerLang('python', python);
registerLang('py', python);
registerLang('css', css);
registerLang('html', xml);
registerLang('xml', xml);
registerLang('json', json);
registerLang('bash', bash);
registerLang('sql', sql);
registerLang('yaml', yaml);
registerLang('yml', yaml);
registerLang('rust', rust);
registerLang('go', go);
registerLang('java', java);
registerLang('cpp', cpp);
registerLang('c', cpp);
registerLang('csharp', csharp);
registerLang('cs', csharp);
registerLang('kotlin', kotlin);
registerLang('kt', kotlin);
registerLang('swift', swift);
registerLang('php', php);
registerLang('ruby', ruby);
registerLang('rb', ruby);

function getFileExtension(language: string): string {
  const extMap: Record<string, string> = {
    javascript: 'js', js: 'js', typescript: 'ts', ts: 'tsx',
    python: 'py', py: 'py', css: 'css', html: 'html', xml: 'xml',
    json: 'json', bash: 'sh', sql: 'sql', yaml: 'yml', yml: 'yml',
    rust: 'rs', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    csharp: 'cs', cs: 'cs', kotlin: 'kt', kt: 'kt', swift: 'swift',
    php: 'php', ruby: 'rb', rb: 'rb', jsx: 'jsx', tsx: 'tsx',
    markdown: 'md', md: 'md',
  };
  return extMap[language.toLowerCase()] || 'txt';
}

export function PreviewPanel() {
  const { previewContent, setPreviewOpen, setPreviewContent, previewOpen } = useChatStore();
  const [imageZoom, setImageZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [viewMode, setViewMode] = useState<'source' | 'preview'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const newWindowRef = useRef<Window | null>(null);

  // When preview content changes, reset view mode
  useEffect(() => {
    if (previewContent) {
      setViewMode(previewContent.type === 'html' ? 'preview' : 'source');
    }
  }, [previewContent]);

  const handleCopy = useCallback(() => {
    if (previewContent) {
      navigator.clipboard.writeText(previewContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [previewContent]);

  const handleDownload = useCallback(() => {
    if (!previewContent) return;
    const ext = getFileExtension(previewContent.language || 'txt');
    const mimeType = 'text/plain';
    const blob = new Blob([previewContent.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [previewContent]);

  const handleViewNewWindow = useCallback(() => {
    if (!previewContent) return;
    if (previewContent.type === 'html') {
      const newWin = window.open('', '_blank');
      if (newWin) {
        newWin.document.write(previewContent.content);
        newWin.document.close();
      }
    } else {
      // For non-HTML, open in a new window with syntax highlighting
      const newWin = window.open('', '_blank');
      if (newWin) {
        newWin.document.write(`
          <!DOCTYPE html>
          <html><head><title>Code Preview</title>
          <style>body{margin:0;background:#0d1117;color:#c9d1d9;font-family:monospace;white-space:pre;padding:20px;font-size:13px;line-height:1.6;}</style>
          </head><body>${previewContent.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>
        `);
        newWin.document.close();
      }
    }
  }, [previewContent]);

  const highlightedCode = useMemo(() => {
    if (!previewContent || previewContent.type === 'image') return '';
    if (previewContent.type === 'html' && viewMode === 'preview') return '';
    try {
      const lang = previewContent.language || '';
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(previewContent.content, { language: lang }).value;
      }
      return hljs.highlightAuto(previewContent.content).value;
    } catch {
      return previewContent.content;
    }
  }, [previewContent, viewMode]);

  const typeIcon = {
    code: <Code className="w-4 h-4" />,
    html: <FileCode className="w-4 h-4" />,
    image: <ImageIcon className="w-4 h-4" />,
    markdown: <FileText className="w-4 h-4" />,
  };

  const typeLabel = {
    code: 'Code Preview',
    html: 'HTML Preview',
    image: 'Image Preview',
    markdown: 'Markdown Preview',
  };

  if (!previewOpen) return null;

  return (
    <>
      {/* Floating panel - absolutely positioned so it can never be pushed off-screen */}
      <div
        className={`fixed top-0 right-0 h-full z-40 flex flex-col bg-background border-l border-border shadow-2xl transition-all duration-300 ${
          isMaximized ? 'w-full' : 'w-[420px]'
        }`}
        style={{ maxHeight: '100vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
              {previewContent ? typeIcon[previewContent.type] : <Layers className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {previewContent ? typeLabel[previewContent.type] : 'Preview'}
              </h3>
              {previewContent?.language && (
                <Badge variant="secondary" className="text-[10px] font-mono mt-0.5">
                  {previewContent.language}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {/* View Mode Toggle (for HTML) */}
            {previewContent?.type === 'html' && (
              <div className="flex items-center mr-1 bg-muted rounded-md p-0.5">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
                    viewMode === 'preview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Eye className="w-3 h-3 inline mr-1" />
                  Preview
                </button>
                <button
                  onClick={() => setViewMode('source')}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
                    viewMode === 'source' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Code className="w-3 h-3 inline mr-1" />
                  Source
                </button>
              </div>
            )}

            {/* Image zoom controls */}
            {previewContent?.type === 'image' && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImageZoom((z) => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground w-10 text-center">{Math.round(imageZoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImageZoom((z) => Math.min(3, z + 0.25))}>
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Separator orientation="vertical" className="h-5 mx-1" />
              </>
            )}

            {/* ACTION BUTTONS — View, Download, Copy */}
            {previewContent && (
              <>
                {/* View in new window */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                  onClick={handleViewNewWindow}
                  title="View in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>

                {/* Download */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  onClick={handleDownload}
                  title="Download code"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>

                {/* Copy */}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title="Copy to clipboard">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </>
            )}

            {/* Maximize/Restore */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>

            {/* Close */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setPreviewOpen(false);
                setPreviewContent(null);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Empty state */}
            {!previewContent && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Eye className="w-8 h-8 opacity-40" />
                </div>
                <h4 className="text-sm font-medium mb-1">No Preview Yet</h4>
                <p className="text-xs text-center max-w-[200px] leading-relaxed">
                  Code and HTML previews will appear here automatically when the AI generates output.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-[10px]">
                    <ExternalLink className="w-3 h-3" /> View
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-[10px]">
                    <Download className="w-3 h-3" /> Download
                  </div>
                </div>
              </div>
            )}

            {/* Image preview */}
            {previewContent?.type === 'image' && (
              <div className="flex items-center justify-center min-h-[200px]">
                <img
                  src={previewContent.content}
                  alt="Preview"
                  style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center' }}
                  className="max-w-full rounded-lg border border-border transition-transform duration-200"
                />
              </div>
            )}

            {/* HTML preview */}
            {previewContent?.type === 'html' && viewMode === 'preview' && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/50 border-b border-border text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center justify-between">
                  <span>Live Preview</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[9px] gap-1 text-emerald-600 hover:text-emerald-700"
                    onClick={handleViewNewWindow}
                  >
                    <ExternalLink className="w-2.5 h-2.5" /> Open in new tab
                  </Button>
                </div>
                <iframe
                  ref={iframeRef}
                  srcDoc={previewContent.content}
                  className="w-full bg-white"
                  style={{ minHeight: '400px', height: isMaximized ? 'calc(100vh - 120px)' : '400px' }}
                  sandbox="allow-scripts"
                  title="HTML Preview"
                />
              </div>
            )}

            {/* Source code view (for HTML in source mode, and for code/markdown types) */}
            {(previewContent?.type === 'html' && viewMode === 'source') && (
              <div className="rounded-xl border border-border overflow-hidden bg-[#0d1117] dark:bg-[#161b22]">
                <div className="px-3 py-1.5 bg-[#161b22] dark:bg-[#1c2333] border-b border-border/30 text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center justify-between">
                  <span>Source Code</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1" onClick={handleCopy}>
                      {copied ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />} Copy
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1 text-emerald-600" onClick={handleDownload}>
                      <Download className="w-2.5 h-2.5" /> Download
                    </Button>
                  </div>
                </div>
                <pre className="p-4 overflow-x-auto">
                  <code
                    className="text-[12px] leading-5 font-mono"
                    dangerouslySetInnerHTML={{
                      __html: highlightedCode,
                    }}
                  />
                </pre>
              </div>
            )}

            {/* Code/Markdown type */}
            {(previewContent?.type === 'code' || previewContent?.type === 'markdown') && (
              <div className="rounded-xl border border-border overflow-hidden bg-[#0d1117] dark:bg-[#161b22]">
                {previewContent.language && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] dark:bg-[#1c2333] border-b border-border/30">
                    <Badge variant="secondary" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      {previewContent.language}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1" onClick={handleCopy}>
                        {copied ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />} Copy
                      </Button>
                      <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1 text-emerald-600" onClick={handleDownload}>
                        <Download className="w-2.5 h-2.5" /> Download
                      </Button>
                      <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1 text-blue-500" onClick={handleViewNewWindow}>
                        <ExternalLink className="w-2.5 h-2.5" /> View
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex">
                  <div className="flex-shrink-0 py-4 pl-4 pr-2 select-none">
                    {previewContent.content.split('\n').map((_, i) => (
                      <div key={i} className="text-[12px] leading-5 text-white/20 font-mono text-right">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <pre className="flex-1 py-4 px-4 overflow-x-auto">
                    <code
                      className="text-[12px] leading-5 font-mono"
                      dangerouslySetInnerHTML={{
                        __html: highlightedCode,
                      }}
                    />
                  </pre>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom action bar — always visible when there's content */}
        {previewContent && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border shrink-0 bg-muted/30">
            <div className="text-[10px] text-muted-foreground">
              {previewContent.content.split('\n').length} lines &bull; {previewContent.content.length} chars
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
                onClick={handleViewNewWindow}
              >
                <ExternalLink className="w-3 h-3" /> View
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1.5 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                onClick={handleDownload}
              >
                <Download className="w-3 h-3" /> Download
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Overlay backdrop when maximized */}
      {isMaximized && (
        <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setIsMaximized(false)} />
      )}
    </>
  );
}
