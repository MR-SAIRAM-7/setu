/**
 * SETU API client.
 *
 * In dev, Vite proxies /api to the backend, so requests stay same-origin.
 * In production, VITE_API_URL points at the deployed engine.
 */

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const url = (path) => `${BASE}${path}`;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function post(path, body, { signal, timeoutMs = 90000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(data.error || `Request failed (${response.status})`, response.status);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('The engine took too long to answer. Try a narrower topic.', 408);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      'Cannot reach the SETU engine. Make sure the backend is running (npm start in /backend).',
      0
    );
  } finally {
    clearTimeout(timer);
  }
}

async function get(path, { signal, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const response = await fetch(url(path), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(data.error || `Request failed (${response.status})`, response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function del(path) {
  try {
    const response = await fetch(url(path), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(data.error || `Delete failed (${response.status})`, response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return { success: false, error: error.message };
  }
}

async function put(path, body) {
  try {
    const response = await fetch(url(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(data.error || `Update failed (${response.status})`, response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return null;
  }
}

/**
 * Upload a document file (PDF, DOCX, TXT, MD, Image) using multipart/form-data.
 */
export async function uploadFile(file, conversationId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (conversationId) formData.append('conversationId', conversationId);

  const response = await fetch(url('/api/files/upload'), {
    method: 'POST',
    body: formData
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || `Upload failed (${response.status})`, response.status);
  }
  return data.document;
}

/**
 * Stream a chat turn using Server-Sent Events (SSE).
 */
export async function streamChat(payload, handlers = {}, signal) {
  const response = await fetch(url('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok || !response.body) {
    throw new ApiError('The chat engine is unavailable.', response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          let data;
          try {
            data = JSON.parse(line.slice(5).trim());
          } catch (_) {
            continue;
          }

          if (event === 'status') handlers.onStatus?.(data);
          else if (event === 'reply') handlers.onReply?.(data);
          else if (event === 'map') handlers.onMap?.(data);
          else if (event === 'error') handlers.onError?.(data);
          else if (event === 'done') handlers.onDone?.(data);
        }
      }
    }
  }
}

export const api = {
  health: async () => {
    try {
      const response = await fetch(url('/api/health'));
      return response.ok ? response.json() : null;
    } catch (_) {
      return null;
    }
  },

  healthAi: async () => {
    try {
      const response = await fetch(url('/api/health/ai'));
      return response.ok ? response.json() : null;
    } catch (_) {
      return null;
    }
  },

  dbStatus: () => get('/api/db/status'),

  // Research & Mind Maps
  mindMap: (topic, context = '', documentId = null) =>
    post('/api/research/mindmap', { topic, context, documentId }),

  expandNode: (topic, nodeLabel, nodeDetail, path = []) =>
    post('/api/research/expand', { topic, nodeLabel, nodeDetail, path }),

  // MongoDB Mind Maps persistence
  listMindMaps: (search = '') => get(`/api/mindmaps?search=${encodeURIComponent(search)}`),
  saveMindMapToDb: (map) => post('/api/mindmaps', map),
  deleteMindMapFromDb: (id) => del(`/api/mindmaps/${id}`),

  // File Upload & Document Management
  uploadFile,
  listFiles: (conversationId = '') =>
    get(`/api/files${conversationId ? `?conversationId=${conversationId}` : ''}`),
  getFile: (id) => get(`/api/files/${id}`),
  deleteFile: (id) => del(`/api/files/${id}`),
  mindMapFromFile: (id) => post(`/api/files/${id}/mindmap`, {}),
  queryFile: (id, query) => post(`/api/files/${id}/query`, { query }),

  // Conversation Threads & Chat History
  listConversations: (search = '') =>
    get(`/api/conversations?search=${encodeURIComponent(search)}`),
  createConversation: (data) => post('/api/conversations', data),
  getConversation: (id) => get(`/api/conversations/${id}`),
  updateConversation: (id, data) => put(`/api/conversations/${id}`, data),
  deleteConversation: (id) => del(`/api/conversations/${id}`),
  getMessages: (conversationId) => get(`/api/conversations/${conversationId}/messages`),
  saveMessage: (conversationId, msg) =>
    post(`/api/conversations/${conversationId}/messages`, msg),

  // Summaries & Artifacts
  listSummaries: () => get('/api/summaries'),
  saveSummaryToDb: (summary) => post('/api/summaries', summary),

  // Settings
  getSettingsFromDb: () => get('/api/settings'),
  saveSettingsToDb: (settings) => post('/api/settings', settings),

  // General helpers
  summarize: (text) => post('/api/summarize', { text }),
  explain: (text, language = 'English') => post('/api/agent/explain', { text, language }),

  // Seven cognitive modes
  start: (task, isStuck = false) => post('/api/start', { task, isStuck }),
  simplify: (text) => post('/api/simplify', { text }),
  learn: (text) => post('/api/learn', { text }),
  meet: (transcript) => post('/api/meet', { transcript }),
  practice: (topic, userUtterance = '') => post('/api/practice', { topic, userUtterance }),
  write: (text) => post('/api/write', { text }),
  guide: (goal) => post('/api/guide', { goal }),

  exportMarkdown: (mode, data) => post('/api/export', { mode, data })
};

export { ApiError };
