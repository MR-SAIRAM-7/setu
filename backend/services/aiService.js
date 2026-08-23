/**
 * SETU Shared AI Orchestration Engine
 * -----------------------------------
 * Primary Provider: OpenRouter (with automated multi-model fallback chain)
 * Secondary Provider: Google Gemini Direct
 * Tertiary Provider: OpenAI Direct
 * Offline Fallback: Deterministic L0 Cognitive Rule Engine
 *
 * Design features:
 *  - Automated Model Fallback Chain: If OpenRouter rate limits (429), runs out of
 *    credits (402), or encounters provider overload (503/504), it walks down the
 *    prioritized model chain seamlessly without interrupting the user.
 *  - Multi-provider Redundancy: Falls over between OpenRouter -> Gemini -> OpenAI.
 *  - Multimodal Vision: Supports diagrams, PDFs screenshots, charts and visual OCR.
 *  - SSE Streaming & Strict Structured Schema extraction with loose JSON recovery.
 */

const crypto = require('crypto');
const config = require('../config');

const OPENROUTER_BASE = config.openRouterBaseUrl || 'https://openrouter.ai/api/v1';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENAI_BASE = 'https://api.openai.com/v1';

/** In-Memory High Speed AI Response Cache (TTL 1 hour, max 500 entries) */
const aiCache = new Map();
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 60 * 60 * 1000;

function getCacheKey(prefix, payload) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24);
  return `${prefix}:${hash}`;
}

function getFromCache(key) {
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    aiCache.delete(key);
    return null;
  }
  return entry.value;
}

function setToCache(key, value, ttl = CACHE_TTL_MS) {
  if (aiCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = aiCache.keys().next().value;
    aiCache.delete(oldestKey);
  }
  aiCache.set(key, { value, expiresAt: Date.now() + ttl });
}

/** Remembers the last working OpenRouter and Gemini models so we try them first */
let resolvedOpenRouterModel = null;
let resolvedGeminiModel = null;

/** Model name -> epoch ms until which it is known to be quota-exhausted */
const exhaustedUntil = new Map();

/**
 * Returns available OpenRouter models in order of priority, skipping cooldowns.
 */
function openRouterChain() {
  const now = Date.now();
  const ordered = resolvedOpenRouterModel
    ? [
        resolvedOpenRouterModel,
        ...config.openRouterModelChain.filter((m) => m !== resolvedOpenRouterModel)
      ]
    : [...config.openRouterModelChain];

  const available = ordered.filter((model) => (exhaustedUntil.get(model) || 0) <= now);
  return available.length ? available : ordered;
}

/**
 * Returns available direct Gemini models in order of priority, skipping cooldowns.
 */
function geminiChain() {
  const now = Date.now();
  const ordered = resolvedGeminiModel
    ? [resolvedGeminiModel, ...config.geminiModelChain.filter((m) => m !== resolvedGeminiModel)]
    : [...config.geminiModelChain];

  const available = ordered.filter((model) => (exhaustedUntil.get(model) || 0) <= now);
  return available.length ? available : ordered;
}

/**
 * A wall-clock budget for one logical request.
 *
 * Per-request timeouts are not a budget, and treating them as one was the
 * single worst latency bug in this service. `timeoutMs` bounds one HTTP call —
 * but a structured request walks a five-model OpenRouter chain, retries, and
 * then does the same against Gemini and OpenAI. At 20 seconds each, a request
 * nobody would describe as "slow" could legitimately run for four minutes
 * before returning, with a human watching a panel the whole time.
 *
 * This is the ceiling on the whole operation. Every chain walk checks it before
 * starting another model, and every individual call is capped at whatever is
 * left, so the caller's stated budget is the budget.
 */
function makeDeadline(ms) {
  const at = Number.isFinite(ms) && ms > 0 ? Date.now() + ms : Number.POSITIVE_INFINITY;
  return {
    at,
    remaining: () => at - Date.now(),
    expired: () => Date.now() >= at
  };
}

/** The timeout for one call: the smaller of what was asked for and what is left. */
function budgetFor(timeoutMs, deadline) {
  const asked = Number(timeoutMs) || config.aiTimeoutMs;
  if (!deadline || !Number.isFinite(deadline.at)) return asked;
  return Math.max(1500, Math.min(asked, deadline.remaining()));
}

class AIError extends Error {
  constructor(message, { provider, status, model, retryable = false, retryAfterMs = null } = {}) {
    super(message);
    this.name = 'AIError';
    this.provider = provider;
    this.status = status;
    this.model = model;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/* -------------------------------------------------------------------------- */
/* Schema translation & JSON Recovery                                         */
/* -------------------------------------------------------------------------- */

function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);

  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (['additionalProperties', 'minItems', 'maxItems', 'strict', '$schema'].includes(key)) {
      continue;
    }
    if (key === 'properties' && value && typeof value === 'object') {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, toGeminiSchema(v)])
      );
    } else if (key === 'items') {
      out.items = toGeminiSchema(value);
    } else {
      out[key] = value;
    }
  }

  if (out.type === 'object' && out.properties && !out.propertyOrdering) {
    out.propertyOrdering = Object.keys(out.properties);
  }
  return out;
}

/**
 * Render a JSON schema as an instruction block.
 *
 * OpenRouter's `json_object` response format only guarantees *valid* JSON, not
 * JSON matching a schema, and the chain spans models with very different levels
 * of structured-output support — asking for `json_schema` strict mode would 400
 * on several of them and burn the whole fallback chain. Putting the schema in
 * the prompt is the one approach every model in the chain honours, and it is
 * what keeps field names stable across providers.
 */
function schemaInstruction(schema, name, example = null) {
  const required = Array.isArray(schema?.required) ? schema.required : [];

  const arrayKeys = Object.entries(schema?.properties || {})
    .filter(([, spec]) => spec?.type === 'array')
    .map(([key]) => key);

  return [
    '',
    'You must reply with a single raw JSON object and nothing else.',
    'No markdown, no code fence, no commentary before or after.',
    '',
    `It must match this JSON Schema exactly${name ? ` (${name})` : ''}:`,
    JSON.stringify(schema, null, 2),
    '',
    'Use these exact key names and nesting. Do not rename, add, or omit keys.',
    required.length ? `Every one of these keys is required: ${required.join(', ')}.` : '',
    'Where a property lists an "enum", the value must be one of those strings verbatim.',
    // Smaller models reliably fill the scalar fields and then hand back `[]`
    // for every array — a schema-valid reply carrying no content at all. Naming
    // the arrays explicitly is what stops that, and it costs a single line.
    arrayKeys.length
      ? `Populate every array. Returning an empty [] for ${arrayKeys.join(', ')} is a failed reply — ` +
        'fill each one with real entries drawn from the input.'
      : '',
    // And an example beats every rule above it. A model that ignores prose
    // instructions about nesting will still copy the shape it was shown.
    example
      ? ['', 'A correctly shaped reply looks exactly like this:', JSON.stringify(example)].join('\n')
      : ''
  ]
    .filter(Boolean)
    .join('\n');
}

/** Models sometimes wrap JSON in prose or a ```json fence. Recover it cleanly. */
function parseJsonLoose(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new AIError('Model returned an empty response.', { retryable: true });
  }
  const text = raw.trim();

  try {
    return JSON.parse(text);
  } catch (_) {
    /* fall through to recovery */
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (_) {
      /* keep trying */
    }
  }

  const start = text.search(/[{[]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (_) {
      /* give up below */
    }
  }

  throw new AIError('Model response was not valid JSON.', { retryable: true });
}

/* -------------------------------------------------------------------------- */
/* HTTP Transport                                                             */
/* -------------------------------------------------------------------------- */

/**
 * POST JSON with a timeout that actually covers the whole response.
 *
 * @param {boolean} [options.parse] resolve to the parsed body rather than the
 *   Response. Use this for everything that is not a stream.
 *
 * The distinction matters more than it looks. `fetch` resolves as soon as the
 * *headers* arrive, and an LLM sends those immediately and then takes as long
 * as it likes to generate the body. Clearing the abort timer when `postJson`
 * returned meant the timeout only ever bounded time-to-first-byte: a model
 * that answered in 0.3s and then spent fourteen seconds writing was completely
 * unbounded, and no per-call or overall budget could see it. Parsing inside
 * the timed region is what makes `timeoutMs` mean what it says.
 */
async function postJson(
  url,
  body,
  { headers = {}, timeoutMs = config.aiTimeoutMs, provider, model, parse = false } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      let message = detail.slice(0, 400);
      let retryAfterMs = null;

      try {
        const parsed = JSON.parse(detail);
        message = parsed?.error?.message || parsed?.message || message;

        const retryInfo = (parsed?.error?.details || []).find((d) =>
          String(d['@type'] || '').includes('RetryInfo')
        );
        const seconds = parseFloat(
          retryInfo?.retryDelay || response.headers.get('retry-after') || ''
        );
        if (Number.isFinite(seconds)) retryAfterMs = seconds * 1000;
      } catch (_) {
        const header = parseFloat(response.headers.get('retry-after') || '');
        if (Number.isFinite(header)) retryAfterMs = header * 1000;
      }

      if (response.status === 429) {
        const wait = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : null;
        throw new AIError(
          `Rate limit reached on ${provider}${model ? ` (${model})` : ''}${wait ? ` — retry in ${wait}s` : ''}`,
          { provider, model, status: 429, retryable: true, retryAfterMs }
        );
      }

      if (response.status === 402) {
        throw new AIError(
          `Insufficient credits or quota on ${provider}${model ? ` for model ${model}` : ''}`,
          { provider, model, status: 402, retryable: true }
        );
      }

      throw new AIError(`${provider}${model ? ` (${model})` : ''} HTTP ${response.status}: ${message}`, {
        provider,
        model,
        status: response.status,
        retryable: response.status >= 500 || response.status === 429 || response.status === 402,
        retryAfterMs
      });
    }

    return parse ? await response.json() : response;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeout = new AIError(
        `${provider}${model ? ` (${model})` : ''} request timed out after ${timeoutMs}ms.`,
        { provider, model, retryable: true }
      );
      // Flagged so the chain walk can tell "this model is too slow, try the
      // next one" apart from "this request failed". Without it, a slow model
      // was retried into the same timeout instead of being stepped over.
      timeout.timedOut = true;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* 1. OpenRouter (Primary Engine with automated model fallback chain)          */
/* -------------------------------------------------------------------------- */

function readOpenRouterSources(payload, text) {
  const sources = [];
  const seen = new Set();

  // 1. Annotations (e.g. url_citation)
  const annotations = payload?.choices?.[0]?.message?.annotations || [];
  for (const ann of annotations) {
    const url = ann?.url_citation?.url || ann?.url || ann?.uri;
    const title = ann?.url_citation?.title || ann?.title || url;
    if (url && typeof url === 'string' && !seen.has(url)) {
      seen.add(url);
      sources.push({ title: String(title).trim(), url: String(url).trim() });
    }
  }

  // 2. Direct citations array
  const citations = payload?.citations || payload?.choices?.[0]?.citations || [];
  for (const cit of citations) {
    const url = typeof cit === 'string' ? cit : cit?.url || cit?.uri;
    const title = typeof cit === 'object' ? cit?.title || url : url;
    if (url && typeof url === 'string' && !seen.has(url)) {
      seen.add(url);
      sources.push({ title: String(title).trim(), url: String(url).trim() });
    }
  }

  // 3. Fallback to markdown links in text
  if (text && typeof text === 'string') {
    const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
    let match;
    while ((match = mdRegex.exec(text)) !== null) {
      const title = match[1].trim();
      const url = match[2].trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        sources.push({ title, url });
      }
    }
  }

  return sources.slice(0, 12);
}

async function callOpenRouter({
  system,
  messages,
  schema,
  name,
  example,
  temperature,
  timeoutMs,
  deadline,
  webSearch = false,
  withSources = false
}) {
  if (!config.openRouterApiKey) {
    throw new AIError('No OpenRouter API key configured.', { provider: 'openrouter' });
  }

  const chain = openRouterChain();
  let lastError;

  for (const model of chain) {
    // Starting another 20-second model call with two seconds of budget left
    // is how a bounded request becomes an unbounded one.
    if (deadline?.expired()) {
      throw lastError || new AIError('Ran out of time before any model answered.', {
        provider: 'openrouter',
        retryable: false
      });
    }

    try {
      const systemContent = schema
        ? `${system || ''}\n${schemaInstruction(schema, name, example)}`.trim()
        : system;

      const body = {
        model,
        messages: [
          ...(systemContent ? [{ role: 'system', content: systemContent }] : []),
          ...messages
        ],
        temperature: temperature ?? 0.7
      };

      if (schema) {
        body.response_format = { type: 'json_object' };
      }

      if (webSearch && config.openRouterWebSearchEnabled) {
        body.tools = [config.openRouterWebTools.search];
      }

      const payload = await postJson(`${OPENROUTER_BASE}/chat/completions`, body, {
        provider: 'openrouter',
        model,
        timeoutMs: budgetFor(timeoutMs, deadline),
        parse: true,
        headers: {
          Authorization: `Bearer ${config.openRouterApiKey}`,
          'HTTP-Referer': config.openRouterSiteUrl,
          'X-Title': config.openRouterAppName
        }
      });

      const message = payload?.choices?.[0]?.message;
      const text = message?.content || message?.reasoning;

      if (!text && !message?.tool_calls) {
        throw new AIError(`OpenRouter model ${model} returned empty content.`, {
          provider: 'openrouter',
          model,
          retryable: true
        });
      }

      if (resolvedOpenRouterModel !== model) {
        resolvedOpenRouterModel = model;
        console.log(`[SETU AI] OpenRouter active model locked in: ${model}`);
      }

      if (withSources) {
        const sources = readOpenRouterSources(payload, text || '');
        return { text: text || '', sources };
      }

      return text || '';
    } catch (error) {
      lastError = error;

      // Rate limited, out of credit, unavailable, 5xx, or simply too slow:
      // mark a cooldown and try the next model. Timeouts belong in this list —
      // a model that cannot answer inside the budget will not answer inside
      // the budget on the next attempt either, and retrying it burns the whole
      // deadline on one bad endpoint.
      if (
        error.timedOut ||
        error.status === 429 ||
        error.status === 402 ||
        error.status === 404 ||
        error.status === 400 ||
        error.status >= 500
      ) {
        const cooldown = error.retryAfterMs && error.retryAfterMs > 30000 ? error.retryAfterMs : 45000;
        exhaustedUntil.set(model, Date.now() + cooldown);
        if (resolvedOpenRouterModel === model) resolvedOpenRouterModel = null;
        console.warn(
          `[SETU AI] OpenRouter model "${model}" failed (${error.status || error.message}) — falling back to next model in chain.`
        );
        continue;
      }

      throw error;
    }
  }

  throw lastError || new AIError('All OpenRouter fallback models failed.', { provider: 'openrouter' });
}

async function* streamOpenRouter({ system, messages, temperature }) {
  if (!config.openRouterApiKey) {
    throw new AIError('No OpenRouter API key configured.', { provider: 'openrouter' });
  }

  const chain = openRouterChain();
  let lastError;

  for (const model of chain) {
    try {
      const response = await postJson(
        `${OPENROUTER_BASE}/chat/completions`,
        {
          model,
          messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
          temperature: temperature ?? 0.7,
          stream: true
        },
        {
          provider: 'openrouter',
          model,
          headers: {
            Authorization: `Bearer ${config.openRouterApiKey}`,
            'HTTP-Referer': config.openRouterSiteUrl,
            'X-Title': config.openRouterAppName
          }
        }
      );

      resolvedOpenRouterModel = model;
      const decoder = new TextDecoder();
      let buffer = '';

      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch (_) {
            /* partial frame */
          }
        }
      }
      return;
    } catch (error) {
      lastError = error;
      if (
        error.status === 429 ||
        error.status === 402 ||
        error.status === 404 ||
        error.status === 400 ||
        error.status >= 500
      ) {
        exhaustedUntil.set(model, Date.now() + 45000);
        if (resolvedOpenRouterModel === model) resolvedOpenRouterModel = null;
        console.warn(`[SETU AI] OpenRouter streaming model "${model}" failed — trying next model in chain.`);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new AIError('All OpenRouter models failed to stream.', { provider: 'openrouter' });
}

/* -------------------------------------------------------------------------- */
/* 2. Google Gemini Direct (Secondary Provider)                               */
/* -------------------------------------------------------------------------- */

function buildGeminiBody({ system, messages, schema, temperature, grounded }) {
  const generationConfig = { temperature: temperature ?? 0.7 };

  if (schema && !grounded) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = toGeminiSchema(schema);
  }

  const body = {
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    generationConfig
  };

  if (grounded) {
    body.tools = [{ google_search: {} }];
  }

  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }
  return body;
}

function readGeminiText(payload) {
  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');

  if (!text && candidate?.finishReason === 'SAFETY') {
    throw new AIError('Gemini blocked the response for safety reasons.', { provider: 'gemini' });
  }
  return text;
}

function readGeminiSources(payload) {
  const chunks = payload?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();

  return chunks
    .map((chunk) => chunk.web)
    .filter(Boolean)
    .map((web) => ({ title: web.title || web.uri, url: web.uri }))
    .filter((source) => {
      if (!source.url || seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    })
    .slice(0, 12);
}

async function callGemini({
  system,
  messages,
  schema,
  temperature,
  timeoutMs,
  deadline,
  grounded,
  withSources = false
}) {
  if (!config.geminiApiKey) throw new AIError('No Gemini API key configured.', { provider: 'gemini' });

  const chain = geminiChain();
  const body = buildGeminiBody({ system, messages, schema, temperature, grounded });
  let lastError;

  for (const model of chain) {
    if (deadline?.expired()) {
      throw lastError || new AIError('Ran out of time before any model answered.', {
        provider: 'gemini',
        retryable: false
      });
    }

    try {
      const payload = await postJson(
        `${GEMINI_BASE}/models/${model}:generateContent?key=${config.geminiApiKey}`,
        body,
        { provider: 'gemini', model, timeoutMs: budgetFor(timeoutMs, deadline), parse: true }
      );
      const text = readGeminiText(payload);
      if (!text) throw new AIError('Gemini returned no text.', { provider: 'gemini', model, retryable: true });

      if (resolvedGeminiModel !== model) {
        resolvedGeminiModel = model;
        console.log(`[SETU AI] Gemini model locked in: ${model}`);
      }
      return withSources ? { text, sources: readGeminiSources(payload) } : text;
    } catch (error) {
      lastError = error;

      if (error.status === 404 || error.status === 400 || error.timedOut) {
        if (error.timedOut) exhaustedUntil.set(model, Date.now() + 45000);
        if (resolvedGeminiModel === model) resolvedGeminiModel = null;
        continue;
      }

      if (error.status === 429) {
        const cooldown = error.retryAfterMs && error.retryAfterMs > 60000 ? error.retryAfterMs : 60000;
        exhaustedUntil.set(model, Date.now() + cooldown);
        if (resolvedGeminiModel === model) resolvedGeminiModel = null;
        console.warn(`[SETU AI] Gemini model "${model}" rate-limited — falling through to next model.`);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new AIError('No usable Gemini model found.', { provider: 'gemini' });
}

async function* streamGemini({ system, messages, temperature }) {
  const chain = geminiChain();
  const body = buildGeminiBody({ system, messages, temperature });
  let lastError;

  for (const model of chain) {
    let response;
    try {
      response = await postJson(
        `${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${config.geminiApiKey}`,
        body,
        { provider: 'gemini', model }
      );
    } catch (error) {
      lastError = error;
      if (error.status === 404 || error.status === 400 || error.status === 429) {
        if (error.status === 429) exhaustedUntil.set(model, Date.now() + 60000);
        if (resolvedGeminiModel === model) resolvedGeminiModel = null;
        continue;
      }
      throw error;
    }

    resolvedGeminiModel = model;
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const text = readGeminiText(JSON.parse(payload));
          if (text) yield text;
        } catch (_) {
          /* partial frame */
        }
      }
    }
    return;
  }

  throw lastError || new AIError('No usable Gemini model found.', { provider: 'gemini' });
}

/* -------------------------------------------------------------------------- */
/* 3. OpenAI Direct (Tertiary Fallback)                                       */
/* -------------------------------------------------------------------------- */

async function callOpenAI({ system, messages, schema, name, temperature, timeoutMs, deadline }) {
  if (!config.openAiApiKey) throw new AIError('No OpenAI API key configured.', { provider: 'openai' });

  const body = {
    model: config.openAiModel,
    messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
    temperature: temperature ?? 0.7
  };

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: name || 'setu_response', strict: true, schema }
    };
  }

  const payload = await postJson(`${OPENAI_BASE}/chat/completions`, body, {
    provider: 'openai',
    model: config.openAiModel,
    timeoutMs: budgetFor(timeoutMs, deadline),
    parse: true,
    headers: { Authorization: `Bearer ${config.openAiApiKey}` }
  });

  const text = payload?.choices?.[0]?.message?.content;
  if (!text) throw new AIError('OpenAI returned no content.', { provider: 'openai', retryable: true });
  return text;
}

async function* streamOpenAI({ system, messages, temperature }) {
  const response = await postJson(
    `${OPENAI_BASE}/chat/completions`,
    {
      model: config.openAiModel,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      temperature: temperature ?? 0.7,
      stream: true
    },
    { provider: 'openai', model: config.openAiModel, headers: { Authorization: `Bearer ${config.openAiApiKey}` } }
  );

  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch (_) {
        /* partial frame */
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Public Multi-Provider Orchestrator                                         */
/* -------------------------------------------------------------------------- */

function normalizeMessages(input, messages) {
  if (Array.isArray(messages) && messages.length) {
    return messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: m.content
      }));
  }
  return [{ role: 'user', content: String(input ?? '') }];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Per-stage timing, behind SETU_AI_TRACE=1.
 *
 * Latency here is almost never in the place it looks like it is: the visible
 * symptom is one slow request, and the cause is a chain walk, a retry backoff,
 * or a provider that fails slowly. Timing the stages is the only way to tell
 * those apart, and guessing wasted more time than building this did.
 */
const TRACE = process.env.SETU_AI_TRACE === '1';
let traceStart = 0;

function trace(message) {
  if (!TRACE) return;
  if (!traceStart) traceStart = Date.now();
  console.log(`[ai-trace +${((Date.now() - traceStart) / 1000).toFixed(1)}s] ${message}`);
}

/**
 * Runs `attempt` across the provider hierarchy:
 *  1. OpenRouter (Primary with multi-model fallback chain)
 *  2. Gemini (Secondary with multi-model fallback chain)
 *  3. OpenAI (Tertiary)
 *
 * `maxRetries` is a per-call budget rather than a global constant because the
 * two kinds of work here want opposite things. A background research pass
 * should keep trying — it has nobody waiting on it. An in-page explanation has
 * a human staring at a panel, and four attempts across three providers, each
 * walking a five-model chain, is the difference between "slow" and "the
 * extension is broken". Interactive callers pass a small budget and fall back
 * to the in-page engine instead.
 */
async function withProviders(attempt, { maxRetries = config.aiMaxRetries, deadlineMs } = {}) {
  const providers = [];
  if (config.openRouterApiKey) providers.push('openrouter');
  if (config.geminiApiKey) providers.push('gemini');
  if (config.openAiApiKey) providers.push('openai');

  if (!providers.length) {
    throw new AIError('No AI provider configured. Set OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.');
  }

  const errors = [];
  const budget = Math.max(0, Number(maxRetries) || 0);
  const deadline = makeDeadline(deadlineMs);

  for (const provider of providers) {
    for (let tryIndex = 0; tryIndex <= budget; tryIndex += 1) {
      if (deadline.expired()) {
        throw new AIError(
          `The AI providers did not answer within ${Math.round(deadlineMs / 1000)}s.`,
          { retryable: false, status: 504 }
        );
      }

      try {
        trace(`attempt ${provider} #${tryIndex} (deadline in ${Math.round(deadline.remaining() / 1000)}s)`);
        const value = await attempt(provider, deadline);
        trace(`attempt ${provider} #${tryIndex} succeeded`);
        return value;
      } catch (error) {
        trace(`attempt ${provider} #${tryIndex} failed: ${error.message.slice(0, 90)}`);
        errors.push(error);
        if (!error.retryable || tryIndex === budget) break;

        const wait = Math.min(
          error.retryAfterMs ? Math.min(error.retryAfterMs, config.maxRetryWaitMs) : 400 * 2 ** tryIndex,
          // Never sleep past the deadline — that time belongs to the caller.
          Math.max(0, deadline.remaining() - 500)
        );
        trace(`backing off ${wait}ms`);
        if (wait > 0) await sleep(wait);
      }
    }
  }

  const actionable = errors.find((error) => error.status === 429 || error.status === 402);
  if (actionable) throw actionable;

  throw new AIError(
    `All AI providers failed — ${errors.map((error) => error.message).join(' | ')}`
  );
}

/**
 * Check a parsed response against the schema's top-level contract.
 *
 * Only the shallow shape is enforced. That is the layer that actually breaks —
 * a model inventing `success_signal` where the schema said `tip` produces a
 * response the UI renders as blank — while deep validation would reject
 * otherwise-usable answers over a nested detail.
 */
function findContractViolation(value, schema) {
  if (!schema || schema.type !== 'object') return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'response was not a JSON object';
  }

  const missing = (schema.required || []).filter((key) => value[key] === undefined);
  if (missing.length) return `missing required key(s): ${missing.join(', ')}`;

  for (const [key, spec] of Object.entries(schema.properties || {})) {
    if (value[key] === undefined) continue;
    if (spec.type === 'array' && !Array.isArray(value[key])) {
      return `"${key}" should be an array`;
    }
    if (spec.type === 'object' && (typeof value[key] !== 'object' || Array.isArray(value[key]))) {
      return `"${key}" should be an object`;
    }
  }

  return null;
}

/**
 * Structured JSON generation against a schema.
 *
 * @param {(parsed: object) => (string|null)} [options.validate] caller-supplied
 *   contract check, returning a description of what is wrong or null. This
 *   belongs here rather than at the call site for two reasons: a rejected
 *   response must not be written to the cache (or every later attempt is
 *   served the same bad answer instantly), and it must count as a failure the
 *   retry-and-fallback machinery can act on.
 */
async function requestStructuredAI({
  name,
  schema,
  instructions,
  input,
  messages,
  example,
  validate,
  temperature = 0.3,
  timeoutMs,
  maxRetries,
  deadlineMs
}) {
  const chat = normalizeMessages(input, messages);
  const cacheKey = getCacheKey('struct', { name, schema, instructions, chat, temperature });
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const result = await withProviders(
    async (provider, deadline) => {
      let raw;
      if (provider === 'openrouter') {
        raw = await callOpenRouter({
          system: instructions, messages: chat, schema, name, example, temperature, timeoutMs, deadline
        });
      } else if (provider === 'gemini') {
        raw = await callGemini({
          system: instructions, messages: chat, schema, temperature, timeoutMs, deadline
        });
      } else {
        raw = await callOpenAI({
          system: instructions, messages: chat, schema, name, temperature, timeoutMs, deadline
        });
      }

      const parsed = parseJsonLoose(raw);
      const violation = findContractViolation(parsed, schema) || validate?.(parsed) || null;

      if (violation) {
        // Skip whichever model produced this for a while. Without it, a model
        // that reliably returns the right keys and empty arrays — which the
        // small free ones do — is retried into the same failure and the rest
        // of the chain is never reached.
        penaliseCurrentModel(provider);

        // Retryable: the retry loop gets another sample from another model,
        // then the next provider.
        throw new AIError(`${provider} returned an off-contract response — ${violation}.`, {
          provider,
          retryable: true
        });
      }

      return parsed;
    },
    { maxRetries, deadlineMs }
  );

  setToCache(cacheKey, result);
  return result;
}

/**
 * Take the model that just answered out of rotation briefly.
 *
 * Model selection is sticky — the chain remembers whichever model last worked
 * and tries it first — which is right for latency and wrong when that model is
 * producing well-formed rubbish. This unsticks it.
 */
const OFF_CONTRACT_COOLDOWN_MS = 90000;

function penaliseCurrentModel(provider) {
  if (provider === 'openrouter' && resolvedOpenRouterModel) {
    exhaustedUntil.set(resolvedOpenRouterModel, Date.now() + OFF_CONTRACT_COOLDOWN_MS);
    console.warn(
      `[SETU AI] OpenRouter model "${resolvedOpenRouterModel}" returned an unusable structure — ` +
        'trying the next model in the chain.'
    );
    resolvedOpenRouterModel = null;
  } else if (provider === 'gemini' && resolvedGeminiModel) {
    exhaustedUntil.set(resolvedGeminiModel, Date.now() + OFF_CONTRACT_COOLDOWN_MS);
    resolvedGeminiModel = null;
  }
}

/** Free-form prose generation. */
async function requestText({
  instructions,
  input,
  messages,
  temperature = 0.7,
  timeoutMs,
  maxRetries,
  deadlineMs
}) {
  const chat = normalizeMessages(input, messages);
  const cacheKey = getCacheKey('text', { instructions, chat, temperature });
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const result = await withProviders(
    async (provider, deadline) => {
      if (provider === 'openrouter') {
        return callOpenRouter({ system: instructions, messages: chat, temperature, timeoutMs, deadline });
      } else if (provider === 'gemini') {
        return callGemini({ system: instructions, messages: chat, temperature, timeoutMs, deadline });
      } else {
        return callOpenAI({ system: instructions, messages: chat, temperature, timeoutMs, deadline });
      }
    },
    { maxRetries, deadlineMs }
  );

  setToCache(cacheKey, result);
  return result;
}

/**
 * Web-grounded / deep research pass.
 */
async function requestResearch({ instructions, input, messages, temperature = 0.4 }) {
  const chat = normalizeMessages(input, messages);
  const cacheKey = getCacheKey('research', { instructions, chat, temperature });
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // 1. OpenRouter (Primary Provider with real-time web search tool)
  if (config.openRouterApiKey && config.openRouterWebSearchEnabled) {
    try {
      const { text, sources } = await callOpenRouter({
        system: instructions,
        messages: chat,
        temperature,
        webSearch: true,
        withSources: true
      });
      if (text) {
        const res = { text, sources: sources || [], grounded: true };
        setToCache(cacheKey, res);
        return res;
      }
    } catch (error) {
      console.warn('[SETU AI] OpenRouter web search research failed, falling back to next provider:', error.message);
    }
  }

  // 2. Google Gemini Direct (Secondary Provider with search grounding)
  if (config.geminiApiKey) {
    try {
      const { text, sources } = await callGemini({
        system: instructions,
        messages: chat,
        temperature,
        grounded: true,
        withSources: true
      });
      const res = { text, sources: sources || [], grounded: true };
      setToCache(cacheKey, res);
      return res;
    } catch (error) {
      console.warn('[SETU AI] Gemini grounded research unavailable, falling back to model knowledge:', error.message);
    }
  }

  // 3. Model knowledge fallback
  const text = await requestText({ instructions, messages: chat, temperature });
  const res = { text, sources: [], grounded: false };
  setToCache(cacheKey, res);
  return res;
}

/** Streaming prose generation — yields text chunks. */
async function* streamText({ instructions, input, messages, temperature = 0.7 }) {
  const chat = normalizeMessages(input, messages);

  if (config.openRouterApiKey) {
    try {
      yield* streamOpenRouter({ system: instructions, messages: chat, temperature });
      return;
    } catch (error) {
      console.warn('[SETU AI] OpenRouter stream failed, attempting next provider:', error.message);
    }
  }

  if (config.geminiApiKey) {
    try {
      yield* streamGemini({ system: instructions, messages: chat, temperature });
      return;
    } catch (error) {
      console.warn('[SETU AI] Gemini stream failed, attempting next provider:', error.message);
    }
  }

  if (config.openAiApiKey) {
    yield* streamOpenAI({ system: instructions, messages: chat, temperature });
    return;
  }

  throw new AIError('No AI provider available for streaming.');
}

/**
 * Describe an image (chart, document screenshot, visual graphic) in plain language.
 */
async function describeImage({
  imageBase64,
  mimeType = 'image/jpeg',
  instructions,
  prompt,
  timeoutMs,
  deadlineMs
}) {
  const cacheKey = getCacheKey('img', { mimeType, prompt, instructions, len: imageBase64?.length, slice: imageBase64?.slice(0, 100) });
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Vision calls are the slowest thing this service does and the most likely
  // to be attempted against a model that cannot do them at all, so the whole
  // walk is bounded rather than each hop.
  const deadline = makeDeadline(deadlineMs);

  if (config.openRouterApiKey) {
    const chain = openRouterChain();
    for (const model of chain) {
      if (deadline.expired()) break;
      try {
        const payload = await postJson(
          `${OPENROUTER_BASE}/chat/completions`,
          {
            model,
            messages: [
              ...(instructions ? [{ role: 'system', content: instructions }] : []),
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt || 'Describe this image clearly and extract key information.' },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
                ]
              }
            ],
            temperature: 0.3
          },
          {
            provider: 'openrouter',
            model,
            timeoutMs: budgetFor(timeoutMs, deadline),
            parse: true,
            headers: {
              Authorization: `Bearer ${config.openRouterApiKey}`,
              'HTTP-Referer': config.openRouterSiteUrl,
              'X-Title': config.openRouterAppName
            }
          }
        );

        const text = payload?.choices?.[0]?.message?.content;
        if (text) {
          resolvedOpenRouterModel = model;
          setToCache(cacheKey, text);
          return text;
        }
      } catch (error) {
        if (error.status === 429 || error.status === 402 || error.status >= 500) {
          exhaustedUntil.set(model, Date.now() + 45000);
          continue;
        }
      }
    }
  }

  if (config.geminiApiKey) {
    const chain = geminiChain();
    for (const model of chain) {
      if (deadline.expired()) break;
      try {
        const payload = await postJson(
          `${GEMINI_BASE}/models/${model}:generateContent?key=${config.geminiApiKey}`,
          {
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }]
              }
            ],
            systemInstruction: { parts: [{ text: instructions }] },
            generationConfig: { temperature: 0.3 }
          },
          { provider: 'gemini', model, timeoutMs: budgetFor(timeoutMs, deadline), parse: true }
        );

        const text = readGeminiText(payload);
        if (text) {
          resolvedGeminiModel = model;
          setToCache(cacheKey, text);
          return text;
        }
      } catch (error) {
        if (error.status === 404 || error.status === 400 || error.status === 429) {
          if (error.status === 429) exhaustedUntil.set(model, Date.now() + 60000);
          continue;
        }
        throw error;
      }
    }
  }

  if (config.openAiApiKey && !deadline.expired()) {
    const payload = await postJson(
      `${OPENAI_BASE}/chat/completions`,
      {
        model: config.openAiModel,
        messages: [
          { role: 'system', content: instructions },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.3
      },
      {
        provider: 'openai',
        model: config.openAiModel,
        timeoutMs: budgetFor(timeoutMs, deadline),
        parse: true,
        headers: { Authorization: `Bearer ${config.openAiApiKey}` }
      }
    );

    const text = payload?.choices?.[0]?.message?.content;
    if (text) {
      setToCache(cacheKey, text);
      return text;
    }
  }

  throw new AIError('No provider could describe this image.');
}

/** Live provider probe used by /api/health and /api/health/ai. */
async function checkHealth() {
  if (!config.aiEnabled) {
    return { ok: false, provider: null, model: null, reason: 'No API key configured (set OPENROUTER_API_KEY or GEMINI_API_KEY)' };
  }
  try {
    const primary = config.primaryProvider;
    await requestText({ instructions: 'Reply with the single word: ok', input: 'ping', temperature: 0 });
    return {
      ok: true,
      provider: primary,
      model:
        primary === 'openrouter'
          ? resolvedOpenRouterModel || config.openRouterModelChain[0]
          : primary === 'gemini'
            ? resolvedGeminiModel || config.geminiModelChain[0]
            : config.openAiModel,
      fallbackChain:
        primary === 'openrouter'
          ? config.openRouterModelChain
          : primary === 'gemini'
            ? config.geminiModelChain
            : [config.openAiModel]
    };
  } catch (error) {
    return { ok: false, provider: config.primaryProvider, model: null, reason: error.message };
  }
}

module.exports = {
  AIError,
  requestStructuredAI,
  requestText,
  requestResearch,
  describeImage,
  streamText,
  checkHealth,
  parseJsonLoose
};
