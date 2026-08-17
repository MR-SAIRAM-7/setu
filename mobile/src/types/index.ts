/**
 * SETU Mobile — Core TypeScript Type Definitions
 */

/** Theme options matching web frontend */
export type ThemeOption = 'broadsheet' | 'cream' | 'pastel' | 'sage' | 'velvet' | 'contrast';
export type SpacingOption = 'normal' | 'relaxed' | 'spacious';

export type FontStyleOption = 'serif' | 'system' | 'hyper' | 'lexend' | 'dyslexic';
export type TextSizeOption = 'normal' | 'comfortable' | 'large';
export type MotionOption = 'movement' | 'reduced';

export type ReadingProfile =
  | 'adhd'
  | 'dyslexia'
  | 'autistic'
  | 'overwhelmed'
  | 'general';

export interface UserPreferences {
  profile: ReadingProfile[];
  font: FontStyleOption;
  size: TextSizeOption;
  theme?: ThemeOption;
  spacing?: SpacingOption;
  motion: MotionOption;
  bionic: boolean;
  readingRuler: boolean;
  speechRate: number;
  speechPitch: number;
  hasCompletedOnboarding: boolean;
  customApiUrl: string;
}

export interface FocusSessionState {
  isActive: boolean;
  isPaused: boolean;
  secondsRemaining: number; // starts at 25 * 60 = 1500
  totalSessionsCompleted: number;
  isBreakDialogOpen: boolean;
}

/** Mind Map Tree Data Model */
export interface MindMapNode {
  id: string;
  label: string;
  detail?: string;
  children?: MindMapNode[];
  branch?: number;
  sources?: string[];
  keyFacts?: string[];
}

export interface PlacedNode {
  id: string;
  label: string;
  detail?: string;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  branch: number;
  childCount: number;
  collapsed: boolean;
  raw: MindMapNode;
}

export interface PlacedEdge {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  depth: number;
  branch: number;
}

export interface MindMapDocument {
  _id?: string;
  id?: string;
  topic: string;
  summary: string;
  root: MindMapNode;
  totalTopics?: number;
  sourceType?: 'query' | 'document' | 'seed';
  createdAt?: string;
  updatedAt?: string;
}

/** 7 Cognitive Modes Types */
export type CognitiveModeKey =
  | 'start'
  | 'simplify'
  | 'learn'
  | 'meet'
  | 'practice'
  | 'write'
  | 'guide';

export interface StartModeResult {
  supportiveMessage: string;
  confidenceMeter: {
    effortLevel: string;
    anxietyLevel: string;
    estimatedTimeMinutes: number;
  };
  immediateTenMinuteAction: string;
  microSteps: string[];
  clarifyingQuestion?: string;
}

export interface SimplifyModeResult {
  readabilityGrade: string;
  plainLanguageRewrite: string;
  keyTakeaways: string[];
  sensoryTips: string[];
}

export interface LearnQuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface LearnModeResult {
  summary: string;
  mindMap: {
    rootNode: string;
    branches: { topic: string; details: string[] }[];
  };
  quiz: LearnQuizQuestion[];
}

export interface MeetActionItem {
  task: string;
  owner: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface MeetModeResult {
  summary: string;
  actionItems: MeetActionItem[];
  keyDecisions: string[];
  jargonDecoded: { term: string; plainMeaning: string }[];
}

export interface PracticeSuggestedResponse {
  tone: string;
  text: string;
}

export interface PracticeModeResult {
  scenarioContext: string;
  openingLine: string;
  suggestedResponses: PracticeSuggestedResponse[];
  coachingTip: string;
}

export interface WriteClarityFix {
  originalSnippet: string;
  suggestedSnippet: string;
  reason: string;
}

export interface WriteModeResult {
  originalGradeLevel: string;
  improvedText: string;
  passiveVoiceInstances: string[];
  clarityFixes: WriteClarityFix[];
}

export interface GuideStep {
  stepNumber: number;
  title: string;
  actionRequired: string;
  tip: string;
}

export interface GuideModeResult {
  workflowName: string;
  totalSteps: number;
  steps: GuideStep[];
}

export type CognitiveModeResult =
  | StartModeResult
  | SimplifyModeResult
  | LearnModeResult
  | MeetModeResult
  | PracticeModeResult
  | WriteModeResult
  | GuideModeResult;

export interface CognitiveModeConfig {
  key: CognitiveModeKey;
  name: string;
  icon: string;
  tint: string;
  tagline: string;
  blurb: string;
  fieldLabel: string;
  placeholder: string;
  rows: number;
  workedExample: CognitiveModeResult;
}

/** Chat & Conversation Types */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  mapData?: MindMapNode;
  sources?: string[];
}

export interface ConversationThread {
  id: string;
  topic: string;
  preview: string;
  lastUpdated: string;
  messagesCount: number;
}

/** File Upload / OCR Types */
export interface DocumentFileResult {
  id: string;
  name: string;
  size: number;
  extractedText: string;
  summary: string;
  keyPoints: string[];
  mimeType: string;
  createdAt: string;
}

/** System Status Probe Types */
export interface SystemHealthStatus {
  status: string;
  product: string;
  version: string;
  primaryProvider: string;
  aiConfigured: boolean;
  database: {
    provider: string;
    connected: boolean;
    state: string;
    name?: string;
  };
  modes: string[];
  timestamp: string;
}

/** Summarize mode result (POST /api/summarize) */
export interface SummarizeResult {
  gist: string;
  points: string[];
  readingTimeMinutes: number;
}

/** Conversation thread from MongoDB */
export interface Conversation {
  id: string;
  _id?: string;
  title: string;
  currentTopic?: string;
  mode?: string;
  mindMapId?: string;
  documentIds?: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** Persisted message in a conversation */
export interface PersistedMessage {
  id: string;
  _id?: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  sources?: string[];
  fileAttachments?: { fileId: string }[];
  createdAt: string;
}

/** Document file record from MongoDB */
export interface DocumentFile {
  id: string;
  _id?: string;
  originalName: string;
  mimeType: string;
  size: number;
  extractedText?: string;
  summary?: string;
  keyPoints?: string[];
  userId: string;
  conversationId?: string;
  createdAt: string;
}

/** Mind map with full MongoDB fields */
export interface MindMapRecord extends MindMapDocument {
  title?: string;
  keyFacts?: string[];
  followUps?: string[];
  sources?: string[];
  grounded?: boolean;
  isLensHandoff?: boolean;
  isSeed?: boolean;
  userId?: string;
  conversationId?: string;
  documentId?: string;
}

/** SSE Chat stream event types */
export interface ChatStreamStatusEvent {
  stage: string;
  message: string;
}

export interface ChatStreamReplyEvent {
  text: string;
  intent: string;
  final?: boolean;
  sources?: string[];
}

export interface ChatStreamDoneEvent {
  ok: boolean;
  conversationId: string;
}

/** Agent plan response (for future extension integration) */
export interface AgentPlanStep {
  stepNumber: number;
  instruction: string;
  actionType: string;
  targetRef?: string;
  targetText?: string;
  valueToFill?: string;
  tip: string;
  requiresConfirmation: boolean;
}

export interface AgentPlanResult {
  goal: string;
  understanding: string;
  feasible: boolean;
  blockedReason?: string;
  steps: AgentPlanStep[];
  supportiveMessage: string;
  fallback: boolean;
}

/** API mode response wrapper — all modes include fallback info */
export interface ModeResponseMeta {
  fallback: boolean;
  fallbackReason?: string;
}

