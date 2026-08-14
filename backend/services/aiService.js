/**
 * SETU Shared AI Orchestration Engine
 * -----------------------------------
 * One engine, two providers (Gemini primary, OpenAI fallback), three call shapes:
 *
 *   requestStructuredAI() -> validated JSON matching a supplied schema
 *   requestText()         -> free-form prose (chat turns, explanations)
 *   streamText()          -> async generator of text chunks for SSE
 *
 * Design notes:
 *  - Model names are a *chain*, not a constant. A retired model no longer takes
 *    the whole product down; we walk the chain and cache the first that answers.
 *  - Gemini gets a real `responseSchema`, not just a mime-type hint, so the JSON
 *    actually conforms instead of being best-effort.
 *  - Every failure is surfaced with a typed reason so callers can decide between
 *    retrying, falling back to L0, or reporting honestly to the user.
 */

const config = require('../config');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENAI_BASE = 'https://api.openai.com/v1';

/** Remembers the last Gemini model that answered, so we try it first. */
let resolvedGeminiModel = null;

/** model name -> epoch ms until which it is known to be quota-exhausted. */
const exhaustedUntil = new Map();

/**
 * Preferred model first, then the rest of the chain, skipping any model we
 * know is rate-limited right now.
 *
 * This matters on Gemini's free tier, where the quota is 20 requests *per day
 * per model*. Once a model is spent, retrying it is futile — but a sibling
 * model has its own separate allowance, so falling through keeps the product
 * alive instead of failing for the rest of the day.
 */
function geminiChain() {
  const now = Date.now();
  const ordered = resolvedGeminiModel
    ? [resolvedGeminiModel, ...config.geminiModelChain.filter((m) => m !== resolvedGeminiModel)]
    : [...config.geminiModelChain];

  const available = ordered.filter((model) => (exhaustedUntil.get(model) || 0) <= now);
  // If everything is spent, still try them all rather than refusing outright.
  return available.length ? available : ordered;
}

class AIError extends Error {
  constructor(message, { provider, status, retryable = false, retryAfterMs = null } = {}) {
    super(message);
    this.name = 'AIError';
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
    /** Provider-supplied wait before retrying, in ms. */
    this.retryAfterMs = retryAfterMs;
  }
}

/* -------------------------------------------------------------------------- */
/* Schema translation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Gemini accepts a subset of OpenAPI 3.0 schema. Keywords that are valid for
 * OpenAI's strict JSON-schema mode (additionalProperties, minItems, ...) make
 * Gemini reject the whole request, so strip them on the way in.
 */
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

  // Preserve field order in the model's output for stable, readable JSON.
  if (out.type === 'object' && out.properties && !out.propertyOrdering) {
    out.propertyOrdering = Object.keys(out.properties);
  }
  return out;
}

/** Models sometimes wrap JSON in prose or a ```json fence. Recover it. */
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
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

async function postJson(url, body, { headers = {}, timeoutMs = config.aiTimeoutMs, provider } = {}) {
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
      let message = detail.slice(0, 300);
      let retryAfterMs = null;

      try {
        const parsed = JSON.parse(detail);
        message = parsed?.error?.message || message;

        // Providers tell us how long to wait; honour it instead of guessing.
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

      // Rate limits are the one 4xx worth surfacing in the user's own words.
      if (response.status === 429) {
        const wait = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : null;
        throw new AIError(
          `Rate limit reached on ${provider}${wait ? ` — try again in about ${wait}s` : ''}.`,
          { provider, status: 429, retryable: true, retryAfterMs }
        );
      }

      throw new AIError(`${provider} HTTP ${response.status}: ${message}`, {
        provider,
        status: response.status,
        // 5xx is transient; other 4xx are configuration errors we should not retry.
        retryable: response.status >= 500,
        retryAfterMs
      });
    }

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AIError(`${provider} request timed out after ${timeoutMs}ms.`, {
        provider,
        retryable: true
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Gemini                                                                     */
/* -------------------------------------------------------------------------- */

function buildGeminiBody({ system, messages, schema, temperature, grounded }) {
  const generationConfig = { temperature: temperature ?? 0.7 };

  // Grounding and JSON mode are mutually exclusive on Gemini, so callers that
  // need both run two passes: grounded research first, then schema shaping.
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

/** Pull the citation list out of a grounded Gemini response. */
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

async function callGemini({ system, messages, schema, temperature, grounded, withSources = false }) {
  if (!config.geminiApiKey) throw new AIError('No Gemini API key configured.', { provider: 'gemini' });

  const chain = geminiChain();
  const body = buildGeminiBody({ system, messages, schema, temperature, grounded });
  let lastError;

  for (const model of chain) {
    try {
      const response = await postJson(
        `${GEMINI_BASE}/models/${model}:generateContent?key=${config.geminiApiKey}`,
        body,
        { provider: 'gemini' }
      );
      const payload = await response.json();
      const text = readGeminiText(payload);
      if (!text) throw new AIError('Gemini returned no text.', { provider: 'gemini', retryable: true });

      if (resolvedGeminiModel !== model) {
        resolvedGeminiModel = model;
        console.log(`[SETU AI] Gemini model locked in: ${model}`);
      }
      return withSources ? { text, sources: readGeminiSources(payload) } : text;
    } catch (error) {
      lastError = error;

      // 404/400 = model retired or unavailable to this key.
      if (error.status === 404 || error.status === 400) {
        console.warn(`[SETU AI] Gemini model "${model}" unavailable — trying next. (${error.message})`);
        if (resolvedGeminiModel === model) resolvedGeminiModel = null;
        continue;
      }

      // 429 = this model's quota is spent. Park it and try a sibling, which
      // has its own allowance, rather than retrying into the same wall.
      if (error.status === 429) {
        const cooldown = error.retryAfterMs && error.retryAfterMs > 60000
          ? error.retryAfterMs
          : 60000;
        exhaustedUntil.set(model, Date.now() + cooldown);
        if (resolvedGeminiModel === model) resolvedGeminiModel = null;
        console.warn(`[SETU AI] Gemini model "${model}" rate-limited — falling through to the next model.`);
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
        { provider: 'gemini' }
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
          /* partial frame — ignore and keep reading */
        }
      }
    }
    return;
  }

  throw lastError || new AIError('No usable Gemini model found.', { provider: 'gemini' });
}

/* -------------------------------------------------------------------------- */
/* OpenAI                                                                     */
/* -------------------------------------------------------------------------- */

async function callOpenAI({ system, messages, schema, name, temperature }) {
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

  const response = await postJson(`${OPENAI_BASE}/chat/completions`, body, {
    provider: 'openai',
    headers: { Authorization: `Bearer ${config.openAiApiKey}` }
  });

  const text = (await response.json())?.choices?.[0]?.message?.content;
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
    { provider: 'openai', headers: { Authorization: `Bearer ${config.openAiApiKey}` } }
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
/* Public API                                                                 */
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
 * Run `attempt` against Gemini, then OpenAI, retrying retryable failures with
 * exponential backoff. Throws an aggregate AIError if every provider fails.
 */
async function withProviders(attempt) {
  const providers = [];
  if (config.geminiApiKey) providers.push('gemini');
  if (config.openAiApiKey) providers.push('openai');

  if (!providers.length) {
    throw new AIError('No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.');
  }

  const errors = [];

  for (const provider of providers) {
    for (let tryIndex = 0; tryIndex <= config.aiMaxRetries; tryIndex += 1) {
      try {
        return await attempt(provider);
      } catch (error) {
        errors.push(error);
        if (!error.retryable || tryIndex === config.aiMaxRetries) break;

        // Honour the provider's own retry hint, capped so a request never
        // hangs for a minute; otherwise fall back to exponential backoff.
        const wait = error.retryAfterMs
          ? Math.min(error.retryAfterMs, config.maxRetryWaitMs)
          : 400 * 2 ** tryIndex;
        await sleep(wait);
      }
    }
  }

  // A rate limit is actionable for the user; other failures are not, so lead
  // with it rather than burying it in a concatenated dump.
  const rateLimited = errors.find((error) => error.status === 429);
  if (rateLimited) throw rateLimited;

  throw new AIError(
    `All AI providers failed — ${errors.map((error) => error.message).join(' | ')}`
  );
}

/** Structured JSON generation against a schema. */
async function requestStructuredAI({ name, schema, instructions, input, messages, temperature = 0.4 }) {
  const chat = normalizeMessages(input, messages);

  return withProviders(async (provider) => {
    const raw =
      provider === 'gemini'
        ? await callGemini({ system: instructions, messages: chat, schema, temperature })
        : await callOpenAI({ system: instructions, messages: chat, schema, name, temperature });
    return parseJsonLoose(raw);
  });
}

/** Free-form prose generation. */
async function requestText({ instructions, input, messages, temperature = 0.7 }) {
  const chat = normalizeMessages(input, messages);

  return withProviders(async (provider) =>
    provider === 'gemini'
      ? callGemini({ system: instructions, messages: chat, temperature })
      : callOpenAI({ system: instructions, messages: chat, temperature })
  );
}

/**
 * Web-grounded research pass. Uses Gemini's Google Search tool so answers are
 * built on retrieved sources rather than recall alone; returns the prose plus
 * its citations. Falls back to ungrounded generation when grounding is
 * unavailable, flagging `grounded: false` so callers never imply false rigor.
 */
async function requestResearch({ instructions, input, messages, temperature = 0.5 }) {
  const chat = normalizeMessages(input, messages);

  if (config.geminiApiKey) {
    try {
      const { text, sources } = await callGemini({
        system: instructions,
        messages: chat,
        temperature,
        grounded: true,
        withSources: true
      });
      return { text, sources, grounded: true };
    } catch (error) {
      console.warn('[SETU AI] Grounded research unavailable, using model knowledge:', error.message);
    }
  }

  const text = await requestText({ instructions, messages: chat, temperature });
  return { text, sources: [], grounded: false };
}

/** Streaming prose generation — yields text chunks. */
async function* streamText({ instructions, input, messages, temperature = 0.7 }) {
  const chat = normalizeMessages(input, messages);

  if (config.geminiApiKey) {
    try {
      yield* streamGemini({ system: instructions, messages: chat, temperature });
      return;
    } catch (error) {
      console.warn('[SETU AI] Gemini stream failed, falling back:', error.message);
    }
  }

  if (config.openAiApiKey) {
    yield* streamOpenAI({ system: instructions, messages: chat, temperature });
    return;
  }

  throw new AIError('No AI provider available for streaming.');
}

/**
 * Describe an image (chart, diagram, screenshot) in plain language.
 * `imageBase64` is raw base64 with no data: prefix.
 */
async function describeImage({ imageBase64, mimeType = 'image/jpeg', instructions, prompt }) {
  if (config.geminiApiKey) {
    const chain = geminiChain();

    for (const model of chain) {
      try {
        const response = await postJson(
          `${GEMINI_BASE}/models/${model}:generateContent?key=${config.geminiApiKey}`,
          {
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }]
              }
            ],
            systemInstruction: { parts: [{ text: instructions }] },
            generationConfig: { temperature: 0.4 }
          },
          { provider: 'gemini' }
        );

        const text = readGeminiText(await response.json());
        if (text) {
          resolvedGeminiModel = model;
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

  if (config.openAiApiKey) {
    const response = await postJson(
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
        temperature: 0.4
      },
      { provider: 'openai', headers: { Authorization: `Bearer ${config.openAiApiKey}` } }
    );

    const text = (await response.json())?.choices?.[0]?.message?.content;
    if (text) return text;
  }

  throw new AIError('No provider could describe this image.');
}

/** Live provider probe used by /api/health. */
async function checkHealth() {
  if (!config.aiEnabled) {
    return { ok: false, provider: null, model: null, reason: 'No API key configured' };
  }
  try {
    await requestText({ instructions: 'Reply with the single word: ok', input: 'ping', temperature: 0 });
    return {
      ok: true,
      provider: config.geminiApiKey ? 'gemini' : 'openai',
      model: resolvedGeminiModel || config.openAiModel
    };
  } catch (error) {
    return { ok: false, provider: null, model: null, reason: error.message };
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
