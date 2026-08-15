/**
 * SETU Broadsheet Storage & Preferences Module
 *
 * Maps and reading preferences are saved in this browser by default.
 * When the backend is reachable, it automatically synchronizes with MongoDB.
 */

const MAPS_KEY = 'setu.maps.v1';
const PREFS_KEY = 'setu.prefs.v1';
const MAX_MAPS = 40;

export const DEFAULT_WORKED_MAP = {
  id: 'map_transformer_worked_example',
  title: 'Transformer neural networks',
  topic: 'How does a transformer neural network work?',
  summary: 'Attention replaces recurrence — the whole sequence is considered at once.',
  keyFacts: [
    'Self-attention allows each token to attend to every other token simultaneously.',
    'Positional encodings inject sequence order without sequential processing.',
    'Multi-head attention captures distinct relational patterns in parallel.',
    'Feed-forward layers process each position independently and store factual representations.'
  ],
  followUps: [
    'Why did attention beat recurrence in LSTMs?',
    'How does multi-head attention work mathematically?',
    'What is the role of residual connections and layer norm?'
  ],
  sources: [
    { title: 'Attention Is All You Need (Vaswani et al.)', url: 'https://arxiv.org/abs/1706.03762' },
    { title: 'The Illustrated Transformer (Jay Alammar)', url: 'https://jalammar.github.io/illustrated-transformer/' }
  ],
  grounded: true,
  root: {
    id: 'root',
    label: 'Transformer',
    detail: 'The architecture that replaced recurrence',
    children: [
      {
        id: 'b1',
        label: 'Self-attention',
        detail: 'Every word weighs every other word in parallel',
        children: [
          { id: 'b1_1', label: 'Query, key, value', detail: 'Dot-product attention scoring mechanism' },
          { id: 'b1_2', label: 'Multi-head attention', detail: 'Multiple representation subspaces simultaneously' }
        ]
      },
      {
        id: 'b2',
        label: 'Positional encoding',
        detail: 'Sequence order without sequential processing',
        children: [
          { id: 'b2_1', label: 'Sinusoidal vs learned', detail: 'Fixed trigonometric frequencies or learned embedding weights' }
        ]
      },
      {
        id: 'b3',
        label: 'Feed-forward layers',
        detail: 'Where relational representations are transformed',
        children: [
          { id: 'b3_1', label: 'Pointwise expansion', detail: 'Independent two-layer dense network with ReLU or GELU' }
        ]
      },
      {
        id: 'b4',
        label: 'Training at scale',
        detail: 'Why it powered modern foundation models',
        children: [
          { id: 'b4_1', label: 'Pre-training objective', detail: 'Masked language modeling and next token prediction' }
        ]
      }
    ]
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
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

/* ----------------------------- Maps ----------------------------- */

export function listMaps() {
  const maps = read(MAPS_KEY, null);
  if (!maps || !maps.length) {
    // Seed initial worked example map so library and workspace are never empty!
    write(MAPS_KEY, [DEFAULT_WORKED_MAP]);
    return [DEFAULT_WORKED_MAP];
  }
  return maps;
}

export function saveMap(map) {
  if (!map?.title || !map?.root) return null;

  const maps = listMaps();
  const record = {
    id: map.id || `map_${Date.now()}`,
    title: map.title,
    topic: map.topic || map.title,
    summary: map.summary || '',
    keyFacts: map.keyFacts || [],
    followUps: map.followUps || [],
    sources: map.sources || [],
    grounded: Boolean(map.grounded),
    root: map.root,
    isLensHandoff: Boolean(map.isLensHandoff),
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

  // Background sync with MongoDB if available
  try {
    fetch('/api/mindmaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(() => {});
  } catch (_) {}

  return record;
}

export function getMap(id) {
  return listMaps().find((map) => map.id === id) || null;
}

export function deleteMap(id) {
  const filtered = listMaps().filter((map) => map.id !== id);
  write(MAPS_KEY, filtered);

  // Background sync delete with MongoDB
  try {
    fetch(`/api/mindmaps/${id}`, { method: 'DELETE' }).catch(() => {});
  } catch (_) {}
}

export function clearAllMaps() {
  write(MAPS_KEY, []);
  try {
    fetch('/api/mindmaps', { method: 'DELETE' }).catch(() => {});
  } catch (_) {}
}

/* --------------------------- Preferences --------------------------- */

export const FONT_STACKS = {
  serif: '"Source Serif 4", Georgia, serif',
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  hyper: '"Atkinson Hyperlegible", Verdana, sans-serif',
  dyslexic: '"Atkinson Hyperlegible", Verdana, sans-serif'
};

export const SIZE_SCALE = {
  normal: 1,
  comfortable: 1.1,
  large: 1.22
};

export const DEFAULT_PREFS = {
  profile: [],
  font: 'serif', // 'serif' | 'system' | 'hyper' | 'dyslexic'
  textSize: 'normal', // 'normal' | 'comfortable' | 'large'
  motion: 'move', // 'move' | 'still'
  onboardingDone: false
};

export function getPrefs() {
  return { ...DEFAULT_PREFS, ...read(PREFS_KEY, {}) };
}

export function savePrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  write(PREFS_KEY, next);
  applyPrefs(next);

  // Background sync with MongoDB
  try {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    }).catch(() => {});
  } catch (_) {}

  return next;
}

/** Reflect reading preferences onto <html> so CSS variables and fonts act globally. */
export function applyPrefs(prefs = getPrefs()) {
  const root = document.documentElement;

  // Font classes
  root.classList.remove('font-serif', 'font-system', 'font-hyper', 'font-dyslexic');
  if (prefs.font === 'system') root.classList.add('font-system');
  else if (prefs.font === 'hyper' || prefs.font === 'dyslexic') root.classList.add('font-hyper');
  else root.classList.add('font-serif');

  // Text size classes
  root.classList.remove('text-normal', 'text-comfortable', 'text-large');
  if (prefs.textSize === 'comfortable') root.classList.add('text-comfortable');
  else if (prefs.textSize === 'large') root.classList.add('text-large');
  else root.classList.add('text-normal');

  // Motion class
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefs.motion === 'still' || prefersReduced) {
    root.classList.add('motion-still');
    root.style.setProperty('scroll-behavior', 'auto');
  } else {
    root.classList.remove('motion-still');
    root.style.removeProperty('scroll-behavior');
  }
}
