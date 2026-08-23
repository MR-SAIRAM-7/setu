/**
 * Sarvam AI text-to-speech & speech-to-text service.
 *
 * Read-aloud & voice querying are primary comprehension accommodations in SETU:
 * - Dyslexic & ADHD learners decode spoken information with far lower cognitive friction.
 * - High quality natural Indian voices (Bulbul v3) significantly improve retention.
 * - Multilingual Speech-to-Text (Saaras v3) enables direct voice interaction across 11 Indian languages + English.
 *
 * The API key never reaches the browser — clients call /api/speech endpoints.
 * Everything degrades to the browser's built-in speech synthesis / recognition when no key is configured.
 */

const crypto = require('crypto');
const config = require('../config');
const { resolveLanguage, LANGUAGES } = require('../config/languages');

/**
 * Speaker catalogues, per model version.
 *
 * These are NOT interchangeable: `anushka` exists only on bulbul:v2 and `priya`
 * only on bulbul:v3, and sending the wrong pair is a hard 400 on every request.
 * Keeping both lists here lets `resolveVoice` repair a mismatch instead of
 * silently killing read-aloud.
 */
const VOICES = {
  'bulbul:v3': {
    female: [
      { id: 'priya', label: 'Priya', note: 'Warm and conversational' },
      { id: 'ritu', label: 'Ritu', note: 'Bright and clear' },
      { id: 'neha', label: 'Neha', note: 'Soft and unhurried' },
      { id: 'kavya', label: 'Kavya', note: 'Friendly, everyday' },
      { id: 'shreya', label: 'Shreya', note: 'Calm and even' },
      { id: 'ishita', label: 'Ishita', note: 'Gentle and low' },
      { id: 'tanya', label: 'Tanya', note: 'Lively and warm' },
      { id: 'simran', label: 'Simran', note: 'Steady narration' },
      { id: 'pooja', label: 'Pooja', note: 'Measured and clear' },
      { id: 'shruti', label: 'Shruti', note: 'Soft-spoken' },
      { id: 'suhani', label: 'Suhani', note: 'Light and easy' },
      { id: 'roopa', label: 'Roopa', note: 'Mature and reassuring' },
      { id: 'kavitha', label: 'Kavitha', note: 'Even and neutral' },
      { id: 'rupali', label: 'Rupali', note: 'Crisp and articulate' }
    ],
    male: [
      { id: 'shubh', label: 'Shubh', note: 'Clear and natural' },
      { id: 'aditya', label: 'Aditya', note: 'Warm and authoritative' },
      { id: 'rahul', label: 'Rahul', note: 'Youthful and energetic' },
      { id: 'rohan', label: 'Rohan', note: 'Calm and measured' },
      { id: 'amit', label: 'Amit', note: 'Professional and crisp' },
      { id: 'dev', label: 'Dev', note: 'Deep and resonant' },
      { id: 'varun', label: 'Varun', note: 'Conversational' },
      { id: 'kabir', label: 'Kabir', note: 'Storyteller tone' },
      { id: 'tarun', label: 'Tarun', note: 'Even and neutral' }
    ]
  },
  'bulbul:v2': {
    female: [
      { id: 'anushka', label: 'Anushka', note: 'Warm, the classic default' },
      { id: 'manisha', label: 'Manisha', note: 'Bright and friendly' },
      { id: 'vidya', label: 'Vidya', note: 'Calm and measured' },
      { id: 'arya', label: 'Arya', note: 'Soft and gentle' }
    ],
    male: [
      { id: 'abhilash', label: 'Abhilash', note: 'Deep' },
      { id: 'karun', label: 'Karun', note: 'Clear' },
      { id: 'hitesh', label: 'Hitesh', note: 'Even' }
    ]
  }
};

const DEFAULT_FEMALE = { 'bulbul:v3': 'priya', 'bulbul:v2': 'anushka' };

/** Sarvam's documented ceiling is 2500 (v3) / 1500 (v2); stay under the lower one. */
const MAX_CHARS = 1400;

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Synthesised clips, keyed by the exact text and voice settings.
 *
 * Hovering across a mind map re-requests the same handful of branch labels constantly.
 * Without this cache, every hover is an unnecessary round trip and visible delay.
 */
const clipCache = new Map();
const MAX_CACHE_ENTRIES = 300;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function cacheKey(parts) {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
}

function readCache(key) {
  const entry = clipCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    clipCache.delete(key);
    return null;
  }
  // Refresh insertion order
  clipCache.delete(key);
  clipCache.set(key, entry);
  return entry.value;
}

function writeCache(key, value) {
  if (clipCache.size >= MAX_CACHE_ENTRIES) {
    clipCache.delete(clipCache.keys().next().value);
  }
  clipCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/* -------------------------------------------------------------------------- */
/* Voice resolution                                                           */
/* -------------------------------------------------------------------------- */

function listVoices(model = config.sarvamTtsModel) {
  const catalogue = VOICES[model] || VOICES['bulbul:v3'];
  return [...catalogue.female, ...catalogue.male];
}

/**
 * Pick a valid (model, speaker) pair.
 */
function resolveVoice(requestedSpeaker, requestedModel) {
  const model = VOICES[requestedModel] ? requestedModel : config.sarvamTtsModel;
  const catalogue = VOICES[model] || VOICES['bulbul:v3'];

  const known = new Set([
    ...catalogue.female.map((v) => v.id),
    ...catalogue.male.map((v) => (typeof v === 'string' ? v : v.id))
  ]);
  const wanted = String(requestedSpeaker || config.sarvamTtsSpeaker || '').toLowerCase();

  if (known.has(wanted)) return { model, speaker: wanted };
  return { model, speaker: DEFAULT_FEMALE[model] || catalogue.female[0].id };
}

/* -------------------------------------------------------------------------- */
/* Text-to-Speech Synthesis                                                   */
/* -------------------------------------------------------------------------- */

function cleanForSpeech(text) {
  return String(text || '')
    .replace(/[*_`#~|]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

class SpeechError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'SpeechError';
    this.status = status;
  }
}

/**
 * Synthesise one clip with Sarvam Bulbul TTS.
 */
async function synthesize({ text, speaker, model, pace = 1, language }) {
  if (!config.speechEnabled) {
    throw new SpeechError('No speech provider is configured on the server.', 503);
  }

  const cleaned = cleanForSpeech(text);
  if (!cleaned) throw new SpeechError('Nothing to say.', 400);
  if (cleaned.length > MAX_CHARS) {
    throw new SpeechError(`Text is too long for one clip (max ${MAX_CHARS} characters).`, 400);
  }

  const voice = resolveVoice(speaker, model);
  const lang = resolveLanguage(language, config.sarvamTtsLanguage);
  const safePace = Math.min(2, Math.max(0.5, Number(pace) || 1));

  const key = cacheKey([cleaned, voice.model, voice.speaker, safePace, lang.code]);
  const cached = readCache(key);
  if (cached) return { ...cached, cached: true };

  const body = {
    text: cleaned,
    language_code: lang.code,
    speaker: voice.speaker,
    model: voice.model,
    pace: safePace,
    output_audio_codec: 'mp3'
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.sarvamTimeoutMs);

  let response;
  try {
    response = await fetch(`${config.sarvamBaseUrl}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': config.sarvamApiKey
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new SpeechError('The voice engine took too long to answer.', 504);
    }
    throw new SpeechError(`Could not reach the voice engine: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      payload?.error?.message || payload?.message || payload?.detail || `HTTP ${response.status}`;
    const status = response.status === 401 || response.status === 403 ? 502 : response.status;
    throw new SpeechError(`Voice engine rejected the request: ${detail}`, status);
  }

  const audio = Array.isArray(payload.audios) ? payload.audios[0] : null;
  if (!audio) throw new SpeechError('Voice engine returned no audio.');

  const result = {
    audio,
    mime: 'audio/mpeg',
    speaker: voice.speaker,
    model: voice.model,
    language: lang.code,
    characters: cleaned.length
  };

  writeCache(key, result);
  return { ...result, cached: false };
}

/* -------------------------------------------------------------------------- */
/* Speech-to-Text (STT) Transcription with Sarvam Saaras                       */
/* -------------------------------------------------------------------------- */

/**
 * Transcribe speech audio using Sarvam Saaras AI.
 *
 * @param {Object} options
 * @param {Buffer|Blob} options.audioBuffer - Audio binary buffer
 * @param {string} [options.mimeType='audio/webm'] - Mime type of input audio
 * @param {string} [options.filename='audio.webm'] - Virtual filename
 * @param {string} [options.language='en-IN'] - Language code (or 'auto')
 * @param {string} [options.model='saaras:v3'] - STT model
 * @param {string} [options.mode='transcribe'] - 'transcribe' | 'translate' | 'verbatim' | 'codemix'
 * @param {string} [options.prompt=''] - Optional context prompt
 */
async function transcribe({
  audioBuffer,
  mimeType = 'audio/webm',
  filename = 'audio.webm',
  language,
  model,
  mode = 'transcribe',
  prompt = ''
}) {
  if (!config.sttEnabled) {
    throw new SpeechError('Speech-to-text is not configured on the server.', 503);
  }

  if (!audioBuffer || (Buffer.isBuffer(audioBuffer) && audioBuffer.length === 0)) {
    throw new SpeechError('Audio data is required for transcription.', 400);
  }

  const sttModel = model || config.sarvamSttModel || 'saaras:v3';
  const lang = resolveLanguage(language, config.sarvamTtsLanguage);
  const languageCode = language === 'auto' || language === 'unknown' ? 'unknown' : lang.code;

  const form = new FormData();
  const blob = Buffer.isBuffer(audioBuffer)
    ? new Blob([audioBuffer], { type: mimeType })
    : audioBuffer;

  form.append('file', blob, filename);
  form.append('model', sttModel);
  if (languageCode && languageCode !== 'unknown') {
    form.append('language_code', languageCode);
  }
  if (mode) {
    form.append('mode', mode);
  }
  if (prompt) {
    form.append('prompt', String(prompt).slice(0, 500));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.sarvamTimeoutMs);

  let response;
  try {
    response = await fetch(`${config.sarvamBaseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'api-subscription-key': config.sarvamApiKey
      },
      body: form,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new SpeechError('Transcription engine took too long to respond.', 504);
    }
    throw new SpeechError(`Could not reach transcription engine: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      payload?.error?.message || payload?.message || payload?.detail || `HTTP ${response.status}`;
    const status = response.status === 401 || response.status === 403 ? 502 : response.status;
    throw new SpeechError(`Transcription engine error: ${detail}`, status);
  }

  const transcript = typeof payload.transcript === 'string' ? payload.transcript.trim() : '';

  return {
    transcript,
    language_code: payload.language_code || lang.code,
    request_id: payload.request_id || null,
    model: sttModel,
    provider: 'sarvam'
  };
}

module.exports = {
  synthesize,
  transcribe,
  listVoices,
  resolveVoice,
  cleanForSpeech,
  SpeechError,
  MAX_CHARS,
  VOICES
};
