/**
 * Every environment variable this service reads, resolved in one place.
 *
 * ⚠️ Model IDs are configurable and default to models that exist today.
 * The Build Bible names `gemini-3.5-flash` / `gemini-3.1-flash-lite`; those are
 * placeholders for whatever the current generation is called. Verify the exact
 * IDs against the provider on Day 1 — a wrong model ID is a 404 that looks
 * like a bug in your code for twenty confusing minutes.
 */

export const env = {
  googleKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
  groqKey: process.env.GROQ_API_KEY ?? '',

  modelFlash: process.env.SETU_MODEL_FLASH ?? 'gemini-2.5-flash',
  modelFlashLite: process.env.SETU_MODEL_FLASH_LITE ?? 'gemini-2.5-flash-lite',
  modelPro: process.env.SETU_MODEL_PRO ?? 'gemini-2.5-pro',
  modelGroq: process.env.SETU_MODEL_GROQ ?? 'llama-3.3-70b-versatile',

  authMode: (process.env.SETU_AUTH_MODE ?? 'open') as 'open' | 'supabase',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',

  allowedExtensionIds: (process.env.SETU_ALLOWED_EXTENSION_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  ratePerMin: Number(process.env.SETU_RATE_PER_MIN ?? 30),
  ratePerDay: Number(process.env.SETU_RATE_PER_DAY ?? 300),

  isDev: process.env.NODE_ENV !== 'production',
} as const;

export function availableProviders(): string[] {
  const out: string[] = [];
  if (env.googleKey) out.push('google');
  if (env.groqKey) out.push('groq');
  return out;
}
