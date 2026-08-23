/**
 * Speech & Voice endpoints (TTS & STT).
 *
 * Provides natural text-to-speech read-aloud via Sarvam Bulbul and
 * high-accuracy multilingual speech-to-text via Sarvam Saaras.
 *
 * Designed with fail-safe fallbacks: machine-readable flags allow clients
 * to instantly switch to browser Web Speech APIs if offline.
 */

const speech = require('../services/speechService');
const config = require('../config');
const { LANGUAGES, resolveLanguage } = require('../config/languages');

/**
 * GET /api/speech/voices — Catalogue plus whether the natural voice and STT are live.
 */
function handleListVoices(_req, res) {
  res.json({
    enabled: config.speechEnabled,
    sttEnabled: config.sttEnabled,
    provider: 'sarvam',
    model: config.sarvamTtsModel,
    sttModel: config.sarvamSttModel,
    language: resolveLanguage(config.sarvamTtsLanguage).code,
    defaultSpeaker: speech.resolveVoice(null, config.sarvamTtsModel).speaker,
    maxCharacters: speech.MAX_CHARS,
    voices: speech.listVoices(),
    languages: LANGUAGES
  });
}

/**
 * POST /api/speech — Synthesise one clip of at most MAX_CHARS characters.
 */
async function handleSynthesize(req, res, next) {
  try {
    const { text, speaker, model, pace, language } = req.body || {};

    if (!String(text || '').trim()) {
      return res.status(400).json({ error: 'Nothing to say.' });
    }

    if (!config.speechEnabled) {
      return res.status(503).json({
        error: 'Natural voice is not configured. Set SARVAM_API_KEY to enable it.',
        fallbackToBrowser: true
      });
    }

    const clip = await speech.synthesize({ text, speaker, model, pace, language });
    res.json(clip);
  } catch (error) {
    if (error.name === 'SpeechError') {
      return res.status(error.status).json({
        error: error.message,
        fallbackToBrowser: true
      });
    }
    next(error);
  }
}

/**
 * POST /api/speech/transcribe — Transcribe audio from microphone or file.
 * Accepts multipart/form-data with 'file' OR JSON with { audio: base64, mimeType, language }.
 */
async function handleTranscribe(req, res, next) {
  try {
    if (!config.sttEnabled) {
      return res.status(503).json({
        error: 'Speech-to-text is not configured. Set SARVAM_API_KEY to enable it.',
        fallbackToBrowser: true
      });
    }

    let audioBuffer = null;
    let mimeType = 'audio/webm';
    let filename = 'audio.webm';
    let language = req.body?.language || req.body?.language_code;
    let model = req.body?.model;
    let mode = req.body?.mode || 'transcribe';
    let prompt = req.body?.prompt || '';

    if (req.file) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'audio/webm';
      filename = req.file.originalname || 'audio.webm';
    } else if (req.body?.audio) {
      // Decode Base64 string
      const base64Data = req.body.audio.replace(/^data:[^;]+;base64,/, '');
      audioBuffer = Buffer.from(base64Data, 'base64');
      mimeType = req.body.mimeType || 'audio/webm';
      filename = req.body.filename || 'audio.webm';
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({
        error: 'No audio data received. Please provide an audio file or base64 audio payload.'
      });
    }

    const result = await speech.transcribe({
      audioBuffer,
      mimeType,
      filename,
      language,
      model,
      mode,
      prompt
    });

    res.json(result);
  } catch (error) {
    if (error.name === 'SpeechError') {
      return res.status(error.status).json({
        error: error.message,
        fallbackToBrowser: true
      });
    }
    next(error);
  }
}

module.exports = {
  handleListVoices,
  handleSynthesize,
  handleTranscribe
};
