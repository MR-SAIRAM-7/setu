/**
 * Local persistence.
 *
 * Maps and preferences stay in this browser by default — the product handles
 * material for vulnerable users, so nothing leaves the device unless they
 * explicitly connect a backend account.
 */

const MAPS_KEY = 'setu.maps.v1';
const PREFS_KEY = 'setu.prefs.v1';
const MAX_MAPS = 40;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    // Corrupt or blocked storage should degrade, never crash the app.
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

/* ----------------------------- maps ----------------------------- */

export function listMaps() {
  return read(MAPS_KEY, []);
}

export function saveMap(map) {
  if (!map?.title) return;

  const maps = listMaps();
  const record = {
    id: map.id || `map_${Date.now()}`,
    title: map.title,
    topic: map.topic,
    summary: map.summary,
    keyFacts: map.keyFacts,
    followUps: map.followUps,
    sources: map.sources,
    grounded: map.grounded,
    root: map.root,
    createdAt: map.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Re-saving the same topic updates in place rather than duplicating.
  const existing = maps.findIndex((m) => m.title === record.title);
  if (existing !== -1) {
    record.id = maps[existing].id;
    record.createdAt = maps[existing].createdAt;
    maps.splice(existing, 1);
  }

  write(MAPS_KEY, [record, ...maps].slice(0, MAX_MAPS));
  return record;
}

export function getMap(id) {
  return listMaps().find((map) => map.id === id) || null;
}

export function deleteMap(id) {
  write(MAPS_KEY, listMaps().filter((map) => map.id !== id));
}

/* --------------------------- preferences --------------------------- */

export const DEFAULT_PREFS = {
  font: 'system', // 'system' | 'dyslexic'
  textSize: 'normal', // 'normal' | 'comfortable' | 'large'
  reduceMotion: false
};

export function getPrefs() {
  return { ...DEFAULT_PREFS, ...read(PREFS_KEY, {}) };
}

export function savePrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  write(PREFS_KEY, next);
  applyPrefs(next);
  return next;
}

/** Reflect preferences onto <html> so CSS can act on them globally. */
export function applyPrefs(prefs = getPrefs()) {
  const root = document.documentElement;

  root.classList.toggle('font-dyslexic', prefs.font === 'dyslexic');
  root.classList.toggle('text-comfortable', prefs.textSize === 'comfortable');
  root.classList.toggle('text-large', prefs.textSize === 'large');

  if (prefs.reduceMotion) root.style.setProperty('scroll-behavior', 'auto');
  else root.style.removeProperty('scroll-behavior');
}
