/**
 * Languages SETU can hold a conversation in.
 *
 * This is the single source of truth for both halves of "speaking Hindi": the
 * Sarvam `language_code` used to synthesise audio, and the instruction that
 * makes the model answer in that language in the first place. Keeping them in
 * one list is deliberate — setting only the voice gives you a Hindi speaker
 * reading English sentences, which is worse than either alone.
 *
 * The set is bounded by what Sarvam Bulbul can actually speak (11 codes, the
 * same for v2 and v3). Adding a language the TTS cannot voice would produce
 * text nobody in this audience can use, since audio is the whole point.
 */

const LANGUAGES = [
  { code: 'en-IN', name: 'English', native: 'English' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी' },
  { code: 'od-IN', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు' }
];

const BY_CODE = new Map(LANGUAGES.map((entry) => [entry.code, entry]));

const DEFAULT_CODE = 'en-IN';

/**
 * Normalise a requested language to one we can actually speak.
 *
 * Accepts a bare tag as well as a full code ("hi" -> "hi-IN"), because browser
 * locale strings and hand-written config both show up in that shorter form.
 * Anything unrecognised falls back to the default rather than being passed
 * through to Sarvam, which would reject it.
 */
function resolveLanguage(requested, fallback = DEFAULT_CODE) {
  const raw = String(requested || '').trim();
  if (!raw) return BY_CODE.get(fallback) || BY_CODE.get(DEFAULT_CODE);

  if (BY_CODE.has(raw)) return BY_CODE.get(raw);

  const short = raw.toLowerCase().split(/[-_]/)[0];
  const match = LANGUAGES.find((entry) => entry.code.split('-')[0] === short);
  return match || BY_CODE.get(fallback) || BY_CODE.get(DEFAULT_CODE);
}

function isSupported(code) {
  return BY_CODE.has(String(code || ''));
}

/**
 * The instruction appended to every model prompt for a non-English language.
 *
 * The enum caveat is load-bearing rather than decorative. Several mode schemas
 * carry English enums — effort levels, action-item priorities, the operation
 * type on each Numbers step — and the client compares those values as literal
 * strings. A model that helpfully translates "High" to "उच्च" silently breaks
 * priority badges and object rendering, and it fails in a way that looks like a
 * data bug rather than a translation one. Same for the JSON keys themselves.
 *
 * Returns an empty string for English so the English path is byte-identical to
 * what it was before languages existed.
 */
function languageDirective(code) {
  const language = resolveLanguage(code);
  if (language.code === DEFAULT_CODE) return '';

  return `

LANGUAGE
Write every piece of human-readable prose in ${language.name} (${language.native}), using its
native script. This includes summaries, explanations, labels, questions, steps, and any text a
person reads or hears.

These must stay exactly as specified in the schema and must NOT be translated:
- every JSON key name, in English;
- every value of a property that declares an "enum" — output the English string verbatim;
- numbers, which stay as digits.

Write naturally in ${language.name} rather than translating word-for-word from English. Keep
widely used English technical terms in English where a ${language.name} speaker would normally say
them that way.`;
}

/** Plain-language sentence used where a directive would be overkill (chat replies). */
function replyLanguageNote(code) {
  const language = resolveLanguage(code);
  if (language.code === DEFAULT_CODE) return '';
  return `\n\nReply in ${language.name} (${language.native}), in its native script, written naturally rather than translated word-for-word.`;
}

module.exports = {
  LANGUAGES,
  DEFAULT_CODE,
  resolveLanguage,
  isSupported,
  languageDirective,
  replyLanguageNote
};
