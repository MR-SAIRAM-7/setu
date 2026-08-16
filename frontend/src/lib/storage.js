/**
 * SETU Broadsheet Storage & Preferences Module
 * --------------------------------------------
 * Resilient Multi-Tier Storage Engine:
 *  1. Safe LocalStorage Detection (respects browser Tracking Prevention, private mode, and sandboxed iframes)
 *  2. In-Memory Resilient Fallback (ensures smooth UI operations without throwing Tracking Prevention errors)
 *  3. Seamless MongoDB Cloud/Local Synchronization
 *
 * Writes are local-first: the browser copy is the source of truth for the UI and
 * the MongoDB mirror is best-effort, so the app stays fully usable with the
 * engine offline.
 */

import { syncInBackground } from './api';
import { SEED_MAPS } from './seedData';

const MAPS_KEY = 'setu.maps.v1';
const PREFS_KEY = 'setu.prefs.v1';
const SEEDED_KEY = 'setu.seeded.v1';
const MAX_MAPS = 40;

export { DEFAULT_WORKED_MAP } from './seedData';

/* -------------------------------------------------------------------------- */
/* Safe Storage Adapter (Tracking Prevention & Private Mode Resilient)        */
/* -------------------------------------------------------------------------- */

let storageSupported = null;
const inMemoryStore = new Map();

/**
 * Checks if browser storage is accessible without triggering repeated Tracking Prevention errors.
 */
function isStorageAvailable() {
  if (storageSupported !== null) return storageSupported;

  try {
    if (typeof window === 'undefined') {
      storageSupported = false;
      return false;
    }
    const testKey = '__setu_storage_probe__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    storageSupported = true;
    return true;
  } catch (_) {
    // Tracking Prevention, 3rd-party cookie blocking, sandboxed iframe, or quota reached
    storageSupported = false;
    return false;
  }
}

function read(key, fallback) {
  if (isStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      // Fallback to memory
    }
  }

  if (inMemoryStore.has(key)) {
    return inMemoryStore.get(key);
  }
  return fallback;
}

function write(key, value) {
  // Always update in-memory store for instant sync
  inMemoryStore.set(key, value);

  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return true; // Still preserved in-memory
    }
  }
  return true;
}

function remove(key) {
  inMemoryStore.delete(key);
  if (isStorageAvailable()) {
    try {
      window.localStorage.removeItem(key);
    } catch (_) {}
  }
}

/* ----------------------------- Maps ----------------------------- */

/**
 * All maps for this browser, newest first.
 *
 * On first run the library is seeded with the reference maps in seedData so the
 * app never opens on an empty shelf. Seeding is recorded separately from the map
 * list, so deleting every map genuinely leaves it empty rather than silently
 * restoring the seeds on the next read.
 */
export function listMaps() {
  const maps = read(MAPS_KEY, null);

  if (Array.isArray(maps)) return maps;

  if (read(SEEDED_KEY, false)) {
    // Seeded before, then emptied — respect that.
    write(MAPS_KEY, []);
    return [];
  }

  const seeds = SEED_MAPS.map((map) => ({ ...map }));
  write(MAPS_KEY, seeds);
  write(SEEDED_KEY, true);
  return seeds;
}

/**
 * Persist a map locally and mirror it to MongoDB in the background.
 *
 * Always returns the stored record — callers must use the returned `id` rather
 * than the id they passed in, because a map arriving straight from the engine
 * may carry no id at all and one is minted here.
 */
export function saveMap(map) {
  if (!map?.title || !map?.root) return null;

  const maps = listMaps();
  const record = {
    id: map.id || `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: map.title,
    topic: map.topic || map.title,
    summary: map.summary || '',
    keyFacts: map.keyFacts || [],
    followUps: map.followUps || [],
    sources: map.sources || [],
    grounded: Boolean(map.grounded),
    root: map.root,
    isLensHandoff: Boolean(map.isLensHandoff),
    isSeed: Boolean(map.isSeed),
    createdAt: map.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const existing = maps.findIndex((m) => m.id === record.id || m.title === record.title);
  if (existing !== -1) {
    record.id = maps[existing].id;
    record.createdAt = maps[existing].createdAt;
    maps.splice(existing, 1);
  }

  const updatedMaps = [record, ...maps].slice(0, MAX_MAPS);
  write(MAPS_KEY, updatedMaps);

  syncInBackground('POST', '/api/mindmaps', record);

  return record;
}

export function getMap(id) {
  return listMaps().find((map) => map.id === id) || null;
}

export function deleteMap(id) {
  const filtered = listMaps().filter((map) => map.id !== id);
  write(MAPS_KEY, filtered);
  syncInBackground('DELETE', `/api/mindmaps/${encodeURIComponent(id)}`);
}

export function clearAllMaps() {
  write(MAPS_KEY, []);
  syncInBackground('DELETE', '/api/mindmaps');
}

/**
 * Put the reference library back without touching the user's own maps.
 * Exposed in Settings so a cleared demo can be reset before a walkthrough.
 */
export function restoreSeedMaps() {
  const existing = listMaps();
  const own = existing.filter((map) => !map.isSeed);
  const missing = SEED_MAPS.filter((seed) => !existing.some((map) => map.id === seed.id));

  const merged = [...own, ...missing.map((map) => ({ ...map }))]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, MAX_MAPS);

  write(MAPS_KEY, merged);
  write(SEEDED_KEY, true);

  for (const seed of missing) syncInBackground('POST', '/api/mindmaps', seed);

  return merged;
}

/* --------------------------- Preferences --------------------------- */

export const FONT_STACKS = {
  serif: '"Source Serif 4", Georgia, serif',
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  hyper: '"Atkinson Hyperlegible", Verdana, sans-serif',
  lexend: '"Lexend", system-ui, sans-serif',
  dyslexic: '"Lexend", "Atkinson Hyperlegible", sans-serif'
};

export const SIZE_SCALE = {
  normal: 1,
  comfortable: 1.1,
  large: 1.22
};

export const THEMES = {
  broadsheet: 'Broadsheet Light',
  cream: 'Warm Parchment (Anti-Glare)',
  pastel: 'Calming Blue (ADHD Focus)',
  sage: 'Muted Sage Green',
  velvet: 'Velvet Dark',
  contrast: 'High-Contrast Yellow/Black'
};

export const DEFAULT_PREFS = {
  profile: [],
  theme: 'broadsheet', // 'broadsheet' | 'cream' | 'pastel' | 'sage' | 'velvet' | 'contrast'
  font: 'serif', // 'serif' | 'system' | 'hyper' | 'lexend' | 'dyslexic'
  textSize: 'normal', // 'normal' | 'comfortable' | 'large'
  spacing: 'normal', // 'normal' | 'relaxed' | 'spacious'
  motion: 'move', // 'move' | 'still'
  readingRuler: false,
  bionicReading: false,
  onboardingDone: false
};

export function getPrefs() {
  return { ...DEFAULT_PREFS, ...read(PREFS_KEY, {}) };
}

export function savePrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  write(PREFS_KEY, next);
  applyPrefs(next);

  syncInBackground('POST', '/api/settings', next);

  return next;
}

/** Reflect reading preferences onto <html> so CSS variables, themes, and fonts act globally. */
export function applyPrefs(prefs = getPrefs()) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Theme classes
  root.classList.remove(
    'theme-broadsheet',
    'theme-cream',
    'theme-pastel',
    'theme-sage',
    'theme-velvet',
    'theme-contrast'
  );
  if (prefs.theme && prefs.theme !== 'broadsheet') {
    root.classList.add(`theme-${prefs.theme}`);
  }

  // Font classes
  root.classList.remove('font-serif', 'font-system', 'font-hyper', 'font-lexend', 'font-dyslexic');
  if (prefs.font === 'system') root.classList.add('font-system');
  else if (prefs.font === 'hyper') root.classList.add('font-hyper');
  else if (prefs.font === 'lexend') root.classList.add('font-lexend');
  else if (prefs.font === 'dyslexic') root.classList.add('font-dyslexic');
  else root.classList.add('font-serif');

  // Text size classes
  root.classList.remove('text-normal', 'text-comfortable', 'text-large');
  if (prefs.textSize === 'comfortable') root.classList.add('text-comfortable');
  else if (prefs.textSize === 'large') root.classList.add('text-large');
  else root.classList.add('text-normal');

  // Spacing classes
  root.classList.remove('spacing-normal', 'spacing-relaxed', 'spacing-spacious');
  if (prefs.spacing === 'relaxed') root.classList.add('spacing-relaxed');
  else if (prefs.spacing === 'spacious') root.classList.add('spacing-spacious');

  // Motion class
  try {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefs.motion === 'still' || prefersReduced) {
      root.classList.add('motion-still');
      root.style.setProperty('scroll-behavior', 'auto');
    } else {
      root.classList.remove('motion-still');
      root.style.removeProperty('scroll-behavior');
    }
  } catch (_) {}
}
