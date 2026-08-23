/**
 * Languages SETU can hold a conversation in.
 *
 * Mirrors `backend/config/languages.js` exactly — the set is bounded by what
 * Sarvam Bulbul can actually speak, because for this audience the audio is the
 * accommodation. A language the voice engine cannot read aloud would be text
 * the people who need it most still cannot use.
 *
 * One code drives both halves at once: the language the model answers in, and
 * the language the audio is synthesised in. Setting only one gives you a Hindi
 * voice reading English sentences, which helps nobody.
 */

export interface Language {
  code: string;
  name: string;
  native: string;
  /**
   * One sentence used by the "test voice" control.
   *
   * Written in the language itself rather than translated on the fly, so the
   * test actually demonstrates the voice a user is about to rely on. A Bulbul
   * speaker reading an English sentence in a Tamil voice tells you nothing about
   * whether Tamil read-aloud will work.
   */
  sample: string;
}

export const LANGUAGES: Language[] = [
  {
    code: 'en-IN',
    name: 'English',
    native: 'English',
    sample: 'This is how SETU will read things back to you.',
  },
  {
    code: 'hi-IN',
    name: 'Hindi',
    native: 'हिन्दी',
    sample: 'SETU आपको चीज़ें इसी आवाज़ में पढ़कर सुनाएगा।',
  },
  {
    code: 'bn-IN',
    name: 'Bengali',
    native: 'বাংলা',
    sample: 'SETU আপনাকে এই কণ্ঠেই পড়ে শোনাবে।',
  },
  {
    code: 'gu-IN',
    name: 'Gujarati',
    native: 'ગુજરાતી',
    sample: 'SETU તમને આ અવાજમાં વાંચી સંભળાવશે.',
  },
  {
    code: 'kn-IN',
    name: 'Kannada',
    native: 'ಕನ್ನಡ',
    sample: 'SETU ನಿಮಗೆ ಈ ಧ್ವನಿಯಲ್ಲಿ ಓದಿ ಹೇಳುತ್ತದೆ.',
  },
  {
    code: 'ml-IN',
    name: 'Malayalam',
    native: 'മലയാളം',
    sample: 'SETU നിങ്ങൾക്ക് ഈ ശബ്ദത്തിൽ വായിച്ചു കേൾപ്പിക്കും.',
  },
  {
    code: 'mr-IN',
    name: 'Marathi',
    native: 'मराठी',
    sample: 'SETU तुम्हाला याच आवाजात वाचून दाखवेल.',
  },
  {
    code: 'od-IN',
    name: 'Odia',
    native: 'ଓଡ଼ିଆ',
    sample: 'SETU ଆପଣଙ୍କୁ ଏହି ସ୍ୱରରେ ପଢ଼ି ଶୁଣାଇବ।',
  },
  {
    code: 'pa-IN',
    name: 'Punjabi',
    native: 'ਪੰਜਾਬੀ',
    sample: 'SETU ਤੁਹਾਨੂੰ ਇਸੇ ਆਵਾਜ਼ ਵਿੱਚ ਪੜ੍ਹ ਕੇ ਸੁਣਾਏਗਾ।',
  },
  {
    code: 'ta-IN',
    name: 'Tamil',
    native: 'தமிழ்',
    sample: 'SETU உங்களுக்கு இதே குரலில் படித்துக் காட்டும்.',
  },
  {
    code: 'te-IN',
    name: 'Telugu',
    native: 'తెలుగు',
    sample: 'SETU మీకు ఈ స్వరంలోనే చదివి వినిపిస్తుంది.',
  },
];

export const DEFAULT_LANGUAGE = 'en-IN';

const BY_CODE = new Map(LANGUAGES.map((entry) => [entry.code, entry]));

/** Normalise a requested tag to one we can actually speak ('hi' -> 'hi-IN'). */
export function resolveLanguage(requested?: string | null): Language {
  const raw = String(requested || '').trim();
  if (BY_CODE.has(raw)) return BY_CODE.get(raw)!;

  const short = raw.toLowerCase().split(/[-_]/)[0];
  const match = LANGUAGES.find((entry) => entry.code.split('-')[0] === short);
  return match || BY_CODE.get(DEFAULT_LANGUAGE)!;
}

/** The demo sentence for a language, used by the voice tester. */
export function languageSample(code?: string | null): string {
  return resolveLanguage(code).sample;
}

export function languageLabel(code?: string | null): string {
  const language = resolveLanguage(code);
  return language.code === DEFAULT_LANGUAGE
    ? language.name
    : `${language.native} · ${language.name}`;
}
