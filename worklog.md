---
Task ID: 1
Agent: Main Agent
Task: Fix 502 Bad Gateway error when sending chat messages

Work Log:
- Investigated the error: `JSON.parse: unexpected character at line 1 column 1` and `502 Bad Gateway`
- Found root cause: The chat API was returning non-streaming responses that took 30-55 seconds, causing the ALB (Application Load Balancer) to timeout and return 502
- Implemented SSE streaming for the `/api/chat` route to send data incrementally, preventing gateway timeouts
- Discovered ZAI SDK streaming returns raw SSE byte chunks (indexed byte objects), not parsed JSON
- Wrote custom SSE parser in the API route to convert ZAI SDK's raw byte stream into proper `data: {...}\n\n` SSE format
- Updated chat-panel.tsx to consume streaming responses using ReadableStream + TextDecoder
- Added `appendToLastMsg` function for real-time token-by-token display in the chat UI
- Added streaming cursor (animated blinking bar) during streaming
- Added `X-Accel-Buffering: no` header to prevent nginx/ALB from buffering SSE responses
- Fixed vision API route to use `createVision` method instead of `create` for multimodal content
- Build passes successfully, streaming tested and working via standalone server

Stage Summary:
- Key fix: Chat API now uses Server-Sent Events (SSE) streaming instead of waiting for complete response
- This prevents the ALB 502 timeout by sending data continuously
- Frontend shows real-time token-by-token AI responses
- Files modified: `/src/app/api/chat/route.ts`, `/src/components/chat/chat-panel.tsx`, `/src/app/api/vision/route.ts`

---
Task ID: 2
Agent: Main Agent
Task: Fix preview panel visibility - make it always visible with View/Download buttons

Work Log:
- Analyzed user screenshot showing the code editor (StackBlitz/web IDE) - user couldn't see the preview panel
- Root cause: The preview panel was embedded in the flex layout as a child div, which could be pushed off-screen by sidebar (320px) + history panel + chat area consuming all available width
- Previous fix attempts (removing hidden class, removing CSS animation, adjusting width) all failed because the fundamental issue was flex layout
- Took completely different approach: Rewrote preview panel as a FLOATING OVERLAY using fixed positioning
- Preview panel now uses `fixed top-0 right-0 h-full z-40` - it can NEVER be pushed off-screen by other elements
- Added View button (opens code/HTML in new browser tab/window)
- Added Download button (downloads code as file with correct extension)
- Added Copy button with visual feedback
- Added Maximize/Restore toggle (full-width mode)
- Added Preview/Source toggle for HTML content
- Added bottom action bar with line count, View and Download buttons
- Chat area now adds right padding (420px) when preview is open so content isn't hidden behind the floating panel
- Also added View and Download buttons directly to code blocks in message-renderer.tsx
- Also added Download and View-in-new-window buttons to the chat message action bar
- Removed old CSS animation (preview-slide-in with translateX(100%)) that was keeping panel off-screen
- Build passes successfully

Stage Summary:
- Preview panel is now a floating overlay that can NEVER disappear due to layout issues
- Added View button: opens generated code/HTML in a new browser tab
- Added Download button: downloads code as a file with correct extension
- Added Maximize/Restore toggle for the panel
- Code blocks in messages now show View, Download, and Copy buttons
- Message action bar now includes Download and View-in-new-window buttons
- Files modified: preview-panel.tsx, page.tsx, chat-panel.tsx, message-renderer.tsx, globals.css
---
Task ID: 1
Agent: Main Agent
Task: Fix poor AI response quality - add 227 skills and 47 agents context to system prompt, smart model selection for coding

Work Log:
- Investigated current codebase: system prompt was very basic (just "You are Z"), no skills/agents catalog in prompt
- Found that auto-routing only had 7 hardcoded skill shortcuts and fell through to "general" often
- Found that free models weren't matched to task type (coding should use qwen3-coder)
- Found that skill content was truncated at 6000 chars and only loaded when explicitly matched
- Rewrote buildSystemPrompt() to include complete skills/agents catalog in base prompt
- Added 15+ detailed skill-specific instruction blocks (code-review, tdd, architect, security, planner, writer, researcher, fullstack-dev, python-patterns, rust-patterns, golang-patterns, frontend-patterns, backend-patterns)
- Increased skill content limit from 6000 to 8000 chars
- Added smart model selection: 'auto' hint uses general models, 'coder' hint uses qwen/qwen3-coder:free
- Added ModelHint type ('auto' | 'coder') to AIClient
- Added separate model lists: GENERAL_FREE_MODELS and CODER_FREE_MODELS
- Improved auto-routing with 20+ keyword patterns for language-specific detection
- Added isCodingMessage() helper for broad coding detection
- Auto-route now returns modelHint alongside route info
- Built successfully and pushed to GitHub (commit 5ff7e1e)
- Vercel auto-deploy triggered

Stage Summary:
- System prompt now includes full 227 skills catalog and 47 agents catalog
- Coding tasks auto-routed to qwen/qwen3-coder:free for better code quality
- Non-coding tasks use openrouter/free for general chat
- Auto-routing expanded from 7 to 20+ keyword patterns including language detection
- Each skill has detailed instruction block for production-quality output
