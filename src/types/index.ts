export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  skill?: string;
  agent?: string;
  tokensUsed?: number;
  createdAt: string;
  imageUrl?: string;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  color: string;
}

export type SkillCategory =
  | 'ai-core'
  | 'blockchain'
  | 'communication'
  | 'data'
  | 'design'
  | 'development'
  | 'devops'
  | 'education'
  | 'finance'
  | 'health'
  | 'marketing'
  | 'media'
  | 'operations'
  | 'productivity'
  | 'research'
  | 'security'
  | 'writing';

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: 'opus' | 'sonnet' | 'haiku';
  tools: string[];
  category: AgentCategory;
}

export type AgentCategory =
  | 'architecture'
  | 'review'
  | 'build'
  | 'security'
  | 'quality'
  | 'testing'
  | 'docs'
  | 'operations'
  | 'infrastructure';

export interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface SkillCategoryInfo {
  id: SkillCategory;
  label: string;
  icon: string;
}
