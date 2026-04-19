import { create } from 'zustand';
import type { Message, Conversation, Skill, Agent } from '@/types';

export interface PreviewContent {
  type: 'code' | 'html' | 'image' | 'markdown';
  content: string;
  language?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  activeSkill: Skill | null;
  activeAgent: Agent | null;
  sidebarOpen: boolean;
  previewOpen: boolean;
  previewContent: PreviewContent | null;
  setConversations: (c: Conversation[]) => void;
  addConversation: (c: Conversation) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (m: Message[]) => void;
  addMessage: (m: Message) => void;
  setIsLoading: (l: boolean) => void;
  setActiveSkill: (s: Skill | null) => void;
  setActiveAgent: (a: Agent | null) => void;
  setSidebarOpen: (o: boolean) => void;
  setPreviewOpen: (o: boolean) => void;
  setPreviewContent: (c: PreviewContent | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  activeSkill: null,
  activeAgent: null,
  sidebarOpen: false,
  previewOpen: true,
  previewContent: null,
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((s) => ({ conversations: [conversation, ...s.conversations], activeConversationId: conversation.id, messages: [] })),
  removeConversation: (id) =>
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id), activeConversationId: s.activeConversationId === id ? null : s.activeConversationId, messages: s.activeConversationId === id ? [] : s.messages })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setIsLoading: (isLoading) => set({ isLoading }),
  setActiveSkill: (skill) => set({ activeSkill: skill }),
  setActiveAgent: (agent) => set({ activeAgent: agent }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setPreviewOpen: (previewOpen) => set({ previewOpen }),
  setPreviewContent: (previewContent) => set({ previewContent, previewOpen: previewContent !== null }),
}));
