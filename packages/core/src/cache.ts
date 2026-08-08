import { dnaFingerprint } from './prompts';
import { sha256Hex } from './crypto/vault';
import type { DNAProfile, Mode } from './types';

/**
 * Cache keys (§25.2).
 *
 * key = sha256(mode | dnaFingerprint | contentHash)
 *
 * The DNA fingerprint deliberately includes ONLY the fields that change model
 * output — reading level, language, tone, chunk size. It excludes `fontStack`,
 * `lineGuide`, `density` and `motion`, which change rendering but not content.
 * Getting that distinction right roughly doubles the hit rate.
 *
 * ⚠️ Demo-day rule: pre-warm this cache for every demo input the night before.
 * A 200ms cached response reads as competence, and it gives you a free proof
 * point — "same input, same output, every time, which matters when your user
 * is anxious."
 */
export async function cacheKey(mode: Mode, dna: DNAProfile, content: string): Promise<string> {
  const contentHash = await sha256Hex(content);
  return sha256Hex(`${mode}|${dnaFingerprint(dna)}|${contentHash}`);
}

export interface CacheEntry<T> {
  value: T;
  at: number;
}

export interface CacheStore<T> {
  get(key: string): Promise<CacheEntry<T> | undefined>;
  set(key: string, entry: CacheEntry<T>): Promise<void>;
}

/** In-memory LRU. Used by the edge process and by the extension SW. */
export function createMemoryCache<T>(max = 200, ttlMs = 24 * 60 * 60 * 1000): CacheStore<T> {
  const map = new Map<string, CacheEntry<T>>();
  return {
    async get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.at > ttlMs) {
        map.delete(key);
        return undefined;
      }
      // refresh recency
      map.delete(key);
      map.set(key, hit);
      return hit;
    },
    async set(key, entry) {
      map.set(key, entry);
      while (map.size > max) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
  };
}
