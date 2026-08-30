/**
 * The eleven languages SETU can think and speak in, mirrored for the client.
 *
 * `backend/config/languages.js` is the source of truth — it holds the Sarvam
 * `language_code` and the prompt directive together, because setting only one
 * of those gives you a Hindi voice reading English sentences. This copy exists
 * so a screen can *label* the active language without waiting on
 * `/api/speech/voices`: the node explainer has to render "Explaining in हिन्दी"
 * in the same frame the panel opens, and a round trip for a chip is a round
 * trip the reader watches.
 *
 * Codes must stay identical to the backend list. Anything not in it falls back
 * to English rather than being passed through, which is what the engine does
 * with an unknown code anyway.
 */

export const LANGUAGES = [
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

export const DEFAULT_LANGUAGE = BY_CODE.get('en-IN');

/** Resolve a code — full ('hi-IN') or bare ('hi') — to a catalogue entry. */
export function resolveLanguage(code) {
  const raw = String(code || '').trim();
  if (BY_CODE.has(raw)) return BY_CODE.get(raw);

  const short = raw.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.find((entry) => entry.code.split('-')[0] === short) || DEFAULT_LANGUAGE;
}

/** True when the chosen language is not English — i.e. the chip is worth showing. */
export function isTranslated(code) {
  return resolveLanguage(code).code !== DEFAULT_LANGUAGE.code;
}
