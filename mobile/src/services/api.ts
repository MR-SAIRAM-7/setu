/**
 * SETU Mobile — Centralized REST API Client
 * ----------------------------------------
 * Connects the React Native Android application to the SETU FastAPI/Express backend.
 * Provides transparent identity injection (x-user-id), configurable backend URLs
 * (Android emulator 10.0.2.2, LAN IP, or cloud deployed URL), timeout safety,
 * and deterministic fallback handling for resilient offline presentations.
 */

import { getUserId, getStoredPreferences } from './storage';
import {
  SystemHealthStatus,
  MindMapDocument,
  MindMapNode,
  StartModeResult,
  SimplifyModeResult,
  LearnModeResult,
  MeetModeResult,
  PracticeModeResult,
  WriteModeResult,
  GuideModeResult,
  DocumentFileResult,
} from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Timeouts in milliseconds */
const TIMEOUTS = {
  health: 8000,
  read: 15000,
  write: 20000,
  ai: 120000,
  upload: 180000,
};

async function getBaseUrl(): Promise<string> {
  try {
    const prefs = await getStoredPreferences();
    if (prefs.customApiUrl && prefs.customApiUrl.trim()) {
      return prefs.customApiUrl.replace(/\/+$/, '');
    }
  } catch (_) {}
  // Default to localhost for Android emulator / dev
  return 'http://10.0.2.2:3000';
}

async function makeHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const userId = await getUserId();
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-user-id': userId,
    ...extra,
  };
}

/**
 * Generic request dispatcher with timeout and error handling.
 */
async function request<T>(
  method: string,
  endpoint: string,
  body?: any,
  timeoutMs?: number,
  soft?: false,
  externalSignal?: AbortSignal
): Promise<T>;
async function request<T>(
  method: string,
  endpoint: string,
  body?: any,
  timeoutMs?: number,
  soft?: boolean,
  externalSignal?: AbortSignal
): Promise<T | null>;
async function request<T>(
  method: string,
  endpoint: string,
  body?: any,
  timeoutMs: number = TIMEOUTS.read,
  soft: boolean = false,
  externalSignal?: AbortSignal
): Promise<T | null> {
  const baseUrl = await getBaseUrl();
  const fullUrl = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = await makeHeaders();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const abortHandler = () => controller.abort();
  if (externalSignal) {
    externalSignal.addEventListener('abort', abortHandler);
  }

  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || `Request failed with status ${response.status}`,
        response.status
      );
    }
    return data as T;
  } catch (error: any) {
    if (soft) {
      return null;
    }
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. The engine took too long to answer.', 408);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error.message || 'Cannot reach the SETU engine. Ensure the backend server is running.',
      0
    );
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
  }
}

export function syncInBackground(method: string, path: string, body?: any): void {
  getBaseUrl().then((baseUrl) => {
    getUserId().then((userId) => {
      const fullUrl = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
      fetch(fullUrl, {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'x-user-id': userId },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }).catch(() => {});
    }).catch(() => {});
  }).catch(() => {});
}

/* -------------------------------------------------------------------------- */
/* API Client Implementation                                                  */
/* -------------------------------------------------------------------------- */

export const api = {
  // System Health
  health: () => request<SystemHealthStatus>('GET', '/api/health', undefined, TIMEOUTS.health, true),
  healthAi: () => request<any>('GET', '/api/health/ai', undefined, 45000, true),
  dbStatus: () => request<any>('GET', '/api/db/status', undefined, TIMEOUTS.health, true),

  // Research & Mind Maps
  mindMap: async (
    topic: string,
    context: string = '',
    documentId: string | null = null
  ): Promise<{ map: MindMapNode; summary: string; totalTopics: number }> => {
    return request('POST', '/api/research/mindmap', { topic, context, documentId }, TIMEOUTS.ai);
  },

  expandNode: async (
    topic: string,
    nodeLabel: string,
    nodeDetail: string = '',
    path: string[] = []
  ): Promise<{ children: MindMapNode[]; explanation?: string }> => {
    return request('POST', '/api/research/expand', { topic, nodeLabel, nodeDetail, path }, TIMEOUTS.ai);
  },

  listMindMaps: (search: string = '') =>
    request<MindMapDocument[]>('GET', search ? `/api/mindmaps?search=${encodeURIComponent(search)}` : '/api/mindmaps', undefined, TIMEOUTS.read, true),

  saveMindMapToDb: (map: MindMapDocument) =>
    request<any>('POST', '/api/mindmaps', map, TIMEOUTS.write),

  deleteMindMapFromDb: (id: string) =>
    request<any>('DELETE', `/api/mindmaps/${encodeURIComponent(id)}`, undefined, TIMEOUTS.write, true),

  clearMindMapsInDb: () =>
    request<any>('DELETE', '/api/mindmaps', undefined, TIMEOUTS.write, true),

  // 7 Cognitive Modes
  start: (task: string, isStuck: boolean = true) =>
    request<StartModeResult>('POST', '/api/start', { task, isStuck }, TIMEOUTS.ai),

  simplify: (text: string) =>
    request<SimplifyModeResult>('POST', '/api/simplify', { text }, TIMEOUTS.ai),

  learn: (text: string) =>
    request<LearnModeResult>('POST', '/api/learn', { text }, TIMEOUTS.ai),

  meet: (transcript: string) =>
    request<MeetModeResult>('POST', '/api/meet', { transcript }, TIMEOUTS.ai),

  practice: (topic: string, userUtterance: string = '') =>
    request<PracticeModeResult>('POST', '/api/practice', { topic, userUtterance }, TIMEOUTS.ai),

  write: (text: string) =>
    request<WriteModeResult>('POST', '/api/write', { text }, TIMEOUTS.ai),

  guide: (goal: string) =>
    request<GuideModeResult>('POST', '/api/guide', { goal }, TIMEOUTS.ai),

  // Document & Image OCR
  describeImage: (image: string, prompt?: string) =>
    request<{ description: string; extractedText?: string }>('POST', '/api/agent/describe-image', { image, prompt }, TIMEOUTS.ai),

  uploadFile: async (
    fileUri: string,
    mimeType: string = 'image/jpeg',
    fileName: string = 'document.jpg'
  ): Promise<DocumentFileResult> => {
    const baseUrl = await getBaseUrl();
    const userId = await getUserId();

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUTS.upload);

    try {
      const response = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new ApiError(data.error || 'Document upload failed', response.status);
      }
      return data.document;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ApiError('Upload timed out. Try a smaller image or document.', 408);
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError('Could not upload document to SETU engine.', 0);
    } finally {
      clearTimeout(timer);
    }
  },

  // File Management
  listFiles: (conversationId?: string) =>
    request<any>('GET', conversationId ? `/api/files?conversationId=${encodeURIComponent(conversationId)}` : '/api/files', undefined, TIMEOUTS.read, true),

  getFile: (id: string) =>
    request<any>('GET', `/api/files/${encodeURIComponent(id)}`, undefined, TIMEOUTS.read, true),

  deleteFile: (id: string) =>
    request<any>('DELETE', `/api/files/${encodeURIComponent(id)}`, undefined, TIMEOUTS.write, true),

  mindMapFromFile: (id: string) =>
    request<any>('POST', `/api/files/${encodeURIComponent(id)}/mindmap`, undefined, TIMEOUTS.ai),

  queryFile: (id: string, query: string) =>
    request<any>('POST', `/api/files/${encodeURIComponent(id)}/query`, { query }, TIMEOUTS.ai),

  // Conversation Threads
  listConversations: (search?: string) =>
    request<any>('GET', search ? `/api/conversations?search=${encodeURIComponent(search)}` : '/api/conversations', undefined, TIMEOUTS.read, true),

  createConversation: (data: any) =>
    request<any>('POST', '/api/conversations', data, TIMEOUTS.write),

  getConversation: (id: string) =>
    request<any>('GET', `/api/conversations/${encodeURIComponent(id)}`, undefined, TIMEOUTS.read, true),

  updateConversation: (id: string, data: any) =>
    request<any>('PUT', `/api/conversations/${encodeURIComponent(id)}`, data, TIMEOUTS.write),

  deleteConversation: (id: string) =>
    request<any>('DELETE', `/api/conversations/${encodeURIComponent(id)}`, undefined, TIMEOUTS.write, true),

  getMessages: (conversationId: string) =>
    request<any>('GET', `/api/conversations/${encodeURIComponent(conversationId)}/messages`, undefined, TIMEOUTS.read, true),

  saveMessage: (conversationId: string, msg: any) =>
    request<any>('POST', `/api/conversations/${encodeURIComponent(conversationId)}/messages`, msg, TIMEOUTS.write),

  // Conversational Chat
  chat: async (
    topic: string,
    message: string,
    history: { role: string; content: string }[] = []
  ): Promise<{ reply: string; mapData?: MindMapNode }> => {
    return request('POST', '/api/chat', { topic, message, history }, TIMEOUTS.ai);
  },

  // General Summarize & Explain
  summarize: (text: string) =>
    request<{ summary: string; keyPoints: string[] }>('POST', '/api/summarize', { text }, TIMEOUTS.ai),

  explain: (text: string, language: string = 'English') =>
    request<{ explanation: string }>('POST', '/api/agent/explain', { text, language }, TIMEOUTS.ai),

  // Summaries & Settings
  listSummaries: () =>
    request<any>('GET', '/api/summaries', undefined, TIMEOUTS.read, true),

  saveSummaryToDb: (summary: any) =>
    request<any>('POST', '/api/summaries', summary, TIMEOUTS.write),

  getSettingsFromDb: () =>
    request<any>('GET', '/api/settings', undefined, TIMEOUTS.read, true),

  saveSettingsToDb: (settings: any) =>
    request<any>('POST', '/api/settings', settings, TIMEOUTS.write),

  // Export
  exportMarkdown: (mode: string, data: any) =>
    request<any>('POST', '/api/export', { mode, data }, TIMEOUTS.write),
};
