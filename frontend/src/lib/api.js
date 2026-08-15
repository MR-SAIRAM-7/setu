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

/**
 * Stream a chat turn using SSE.
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

  mindMap: (topic, context = '') => post('/api/research/mindmap', { topic, context }),

  expandNode: (topic, nodeLabel, nodeDetail, path = []) =>
    post('/api/research/expand', { topic, nodeLabel, nodeDetail, path }),

  // MongoDB persistence endpoints
  listMindMaps: (search = '') => get(`/api/mindmaps?search=${encodeURIComponent(search)}`),
  saveMindMapToDb: (map) => post('/api/mindmaps', map),
  deleteMindMapFromDb: (id) =>
    fetch(url(`/api/mindmaps/${id}`), { method: 'DELETE' }).then((r) => r.json()),

  listSummaries: () => get('/api/summaries'),
  saveSummaryToDb: (summary) => post('/api/summaries', summary),

  getSettingsFromDb: () => get('/api/settings'),
  saveSettingsToDb: (settings) => post('/api/settings', settings),

  summarize: (text) => post('/api/summarize', { text }),
  explain: (text, language = 'English') => post('/api/agent/explain', { text, language }),

  // The seven cognitive modes
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
