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

const config = require('../config');

const OPENROUTER_BASE = config.openRouterBaseUrl || 'https://openrouter.ai/api/v1';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENAI_BASE = 'https://api.openai.com/v1';

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
function schemaInstruction(schema, name) {
  const required = Array.isArray(schema?.required) ? schema.required : [];

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
    'Where a property lists an "enum", the value must be one of those strings verbatim.'
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

async function postJson(url, body, { headers = {}, timeoutMs = config.aiTimeoutMs, provider, model } = {}) {
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

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AIError(`${provider}${model ? ` (${model})` : ''} request timed out after ${timeoutMs}ms.`, {
        provider,
        model,
        retryable: true
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* 1. OpenRouter (Primary Engine with automated model fallback chain)          */
/* -------------------------------------------------------------------------- */

async function callOpenRouter({ system, messages, schema, name, temperature }) {
  if (!config.openRouterApiKey) {
    throw new AIError('No OpenRouter API key configured.', { provider: 'openrouter' });
  }

  const chain = openRouterChain();
  let lastError;

  for (const model of chain) {
    try {
      const systemContent = schema
        ? `${system || ''}\n${schemaInstruction(schema, name)}`.trim()
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

      const response = await postJson(`${OPENROUTER_BASE}/chat/completions`, body, {
        provider: 'openrouter',
        model,
        headers: {
          Authorization: `Bearer ${config.openRouterApiKey}`,
          'HTTP-Referer': config.openRouterSiteUrl,
          'X-Title': config.openRouterAppName
        }
      });

      const payload = await response.json();
      const text = payload?.choices?.[0]?.message?.content;
      if (!text) {
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

      return text;
    } catch (error) {
      lastError = error;

      // If rate limited, credit exhausted, unavailable, or 5xx: mark cooldown and try next model
      if (
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
        { provider: 'gemini', model }
      );
      const payload = await response.json();
      const text = readGeminiText(payload);
      if (!text) throw new AIError('Gemini returned no text.', { provider: 'gemini', model, retryable: true });

      if (resolvedGeminiModel !== model) {
        resolvedGeminiModel = model;
        console.log(`[SETU AI] Gemini model locked in: ${model}`);
      }
      return withSources ? { text, sources: readGeminiSources(payload) } : text;
    } catch (error) {
      lastError = error;

      if (error.status === 404 || error.status === 400) {
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
    model: config.openAiModel,
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
 * Runs `attempt` across the provider hierarchy:
 *  1. OpenRouter (Primary with multi-model fallback chain)
 *  2. Gemini (Secondary with multi-model fallback chain)
 *  3. OpenAI (Tertiary)
 */
async function withProviders(attempt) {
  const providers = [];
  if (config.openRouterApiKey) providers.push('openrouter');
  if (config.geminiApiKey) providers.push('gemini');
  if (config.openAiApiKey) providers.push('openai');

  if (!providers.length) {
    throw new AIError('No AI provider configured. Set OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.');
  }

  const errors = [];

  for (const provider of providers) {
    for (let tryIndex = 0; tryIndex <= config.aiMaxRetries; tryIndex += 1) {
      try {
        return await attempt(provider);
      } catch (error) {
        errors.push(error);
        if (!error.retryable || tryIndex === config.aiMaxRetries) break;

        const wait = error.retryAfterMs
          ? Math.min(error.retryAfterMs, config.maxRetryWaitMs)
          : 400 * 2 ** tryIndex;
        await sleep(wait);
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

/** Structured JSON generation against a schema. */
async function requestStructuredAI({ name, schema, instructions, input, messages, temperature = 0.3 }) {
  const chat = normalizeMessages(input, messages);

  return withProviders(async (provider) => {
    let raw;
    if (provider === 'openrouter') {
      raw = await callOpenRouter({ system: instructions, messages: chat, schema, name, temperature });
    } else if (provider === 'gemini') {
      raw = await callGemini({ system: instructions, messages: chat, schema, temperature });
    } else {
      raw = await callOpenAI({ system: instructions, messages: chat, schema, name, temperature });
    }

    const parsed = parseJsonLoose(raw);

    const violation = findContractViolation(parsed, schema);
    if (violation) {
      // Retryable: the retry loop gets another sample, then the next provider.
      throw new AIError(`${provider} returned an off-contract response — ${violation}.`, {
        provider,
        retryable: true
      });
    }

    return parsed;
  });
}

/** Free-form prose generation. */
async function requestText({ instructions, input, messages, temperature = 0.7 }) {
  const chat = normalizeMessages(input, messages);

  return withProviders(async (provider) => {
    if (provider === 'openrouter') {
      return callOpenRouter({ system: instructions, messages: chat, temperature });
    } else if (provider === 'gemini') {
      return callGemini({ system: instructions, messages: chat, temperature });
    } else {
      return callOpenAI({ system: instructions, messages: chat, temperature });
    }
  });
}

/**
 * Web-grounded / deep research pass.
 */
async function requestResearch({ instructions, input, messages, temperature = 0.4 }) {
  const chat = normalizeMessages(input, messages);

  // If Gemini direct is configured and has search grounding:
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
      console.warn('[SETU AI] Gemini grounded research unavailable, falling back to OpenRouter/Model knowledge:', error.message);
    }
  }

  const text = await requestText({ instructions, messages: chat, temperature });
  return { text, sources: [], grounded: false };
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
async function describeImage({ imageBase64, mimeType = 'image/jpeg', instructions, prompt }) {
  if (config.openRouterApiKey) {
    const chain = openRouterChain();
    for (const model of chain) {
      try {
        const response = await postJson(
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
            headers: {
              Authorization: `Bearer ${config.openRouterApiKey}`,
              'HTTP-Referer': config.openRouterSiteUrl,
              'X-Title': config.openRouterAppName
            }
          }
        );

        const text = (await response.json())?.choices?.[0]?.message?.content;
        if (text) {
          resolvedOpenRouterModel = model;
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
            generationConfig: { temperature: 0.3 }
          },
          { provider: 'gemini', model }
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
        temperature: 0.3
      },
      { provider: 'openai', model: config.openAiModel, headers: { Authorization: `Bearer ${config.openAiApiKey}` } }
    );

    const text = (await response.json())?.choices?.[0]?.message?.content;
    if (text) return text;
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
