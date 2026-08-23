/**
 * Loads the real chrome-extension/shared/setu-core.js under a minimal stub of
 * the extension environment and exercises the two classes the 3.1 fixes turn
 * on: Store (self-echo suppression) and Feature (async-safe enable/disable).
 *
 * Run: node core-test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT = path.join(__dirname, '..');

/* ---- environment stub ---------------------------------------------------- */

const syncStore = {};
const storageListeners = [];

const chrome = {
  storage: {
    sync: {
      async get(key) {
        if (key == null) return { ...syncStore };
        const keys = Array.isArray(key) ? key : [key];
        const out = {};
        for (const k of keys) if (k in syncStore) out[k] = syncStore[k];
        return out;
      },
      async set(patch) {
        const changes = {};
        for (const [k, v] of Object.entries(patch)) {
          changes[k] = { oldValue: syncStore[k], newValue: v };
          syncStore[k] = JSON.parse(JSON.stringify(v));
        }
        // Chrome fires onChanged in the context that made the write too — the
        // behaviour the echo suppression exists to survive.
        storageListeners.forEach((fn) => fn(changes, 'sync'));
      }
    },
    onChanged: { addListener: (fn) => storageListeners.push(fn) }
  },
  runtime: { sendMessage: async () => ({ ok: false, error: 'no worker in test' }) }
};

/**
 * Event listeners the runtime registers at load time.
 *
 * setu-core keeps hosts anchored to the viewport on scroll and re-flows the
 * dock on resize, both wired up the moment the file runs. The stub records
 * them rather than ignoring them, so a test can fire one.
 */
const documentListeners = new Map();

const sandbox = {
  console,
  chrome,
  structuredClone,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: (fn) => setTimeout(fn, 16),
  cancelAnimationFrame: clearTimeout,
  DOMException: globalThis.DOMException,
  addEventListener(type, handler) {
    if (!documentListeners.has(type)) documentListeners.set(type, new Set());
    documentListeners.get(type).add(handler);
  },
  removeEventListener(type, handler) {
    documentListeners.get(type)?.delete(handler);
  },
  scrollX: 0,
  scrollY: 0,
  innerWidth: 1280,
  innerHeight: 800
};

/**
 * The document scroller the arbiter falls back to when nothing has claimed a
 * surface. Modelled as a real element rather than as `window.scrollBy`,
 * because that is what the arbiter drives — going through the element is how
 * it stays immune to a page's `scroll-behavior: smooth`.
 */
sandbox.document = {
  scrollingElement: {
    scrollTop: 0,
    scrollHeight: 5000,
    clientHeight: 800,
    scrollTo({ top }) {
      this.scrollTop = top;
      sandbox.scrollY = top;
    }
  },
  documentElement: null,
  addEventListener() {},
  removeEventListener() {}
};
sandbox.document.documentElement = sandbox.document.scrollingElement;
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(EXT, 'shared', 'setu-config.js'), 'utf8'), sandbox, {
  filename: 'setu-config.js'
});
vm.runInContext(fs.readFileSync(path.join(EXT, 'shared', 'setu-core.js'), 'utf8'), sandbox, {
  filename: 'setu-core.js'
});

const { Store, Feature, Text, Scroll, Dock } = sandbox.window.SETU;

/* ---- tiny assertion harness --------------------------------------------- */

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ---- tests --------------------------------------------------------------- */

async function testStore() {
  console.log('\nStore');

  // Retired keys from an older install must not come back.
  syncStore.setuState = {
    bionic: true,
    chunking: true,
    dyslexia: true,
    theme: 'sepia',
    settings: { scrollWpm: 400 }
  };
  const loaded = await Store.load();

  check('load keeps live keys', loaded.bionic === true && loaded.theme === 'sepia');
  check('load merges missing settings defaults', loaded.settings.ttsRate === 1);
  check('load keeps stored settings', loaded.settings.scrollWpm === 400);
  check('load strips retired chunking flag', !('chunking' in loaded));
  check('load strips retired dyslexia flag', !('dyslexia' in loaded));

  // The regression that made themes unusable: our own write bounced back
  // through storage and the reconciler treated it as a remote change.
  let echoSeen = null;
  storageListeners.length = 0;
  storageListeners.push((changes, area) => {
    if (area === 'sync' && changes.setuState) {
      echoSeen = Store.isOwnEcho(changes.setuState.newValue);
    }
  });

  await Store.set({ theme: 'dyslexia' });
  check('own write is recognised as an echo', echoSeen === true);
  check('state kept the theme', Store.get().theme === 'dyslexia');

  // A genuine change from another tab must NOT be mistaken for our echo.
  const foreign = { ...Store.get(), theme: 'contrast' };
  check('foreign write is not an echo', Store.isOwnEcho(foreign) === false);

  Store.adopt(foreign);
  check('adopt applies the foreign state', Store.get().theme === 'contrast');

  // Subscribers see updates.
  let notified = 0;
  const off = Store.subscribe(() => (notified += 1));
  await Store.set({ bionic: false });
  off();
  await Store.set({ bionic: true });
  check('subscribers fire, and unsubscribe works', notified === 1, `notified=${notified}`);
}

async function testFeature() {
  console.log('\nFeature');

  class Ok extends Feature {
    static key = 'ok';
    onEnable() {
      this.built = true;
      this.cleanup(() => (this.built = false));
    }
  }

  const ok = new Ok();
  await ok.enable();
  check('sync feature enables', ok.enabled === true && ok.built === true);
  ok.disable();
  check('sync feature tears down', ok.enabled === false && ok.built === false);

  // Gaze Scroll's shape: an async start that can be rejected by the user.
  class Camera extends Feature {
    static key = 'camera';
    constructor() {
      super();
      this.panelUp = false;
      this.streamStopped = false;
    }
    async onEnable() {
      this.panelUp = true; // builds its panel first, like the real feature
      this.cleanup(() => {
        this.panelUp = false;
        this.streamStopped = true;
      });
      await new Promise((r) => setTimeout(r, 5));
      throw new Error('Camera access was blocked.');
    }
    onDisable() {
      this.disableCalls = (this.disableCalls || 0) + 1;
    }
  }

  const camera = new Camera();
  let raised = null;
  try {
    await camera.enable();
  } catch (error) {
    raised = error;
  }

  check('async failure propagates to the caller', raised?.message === 'Camera access was blocked.');
  check('failed start leaves the feature off', camera.enabled === false);
  check('failed start tears its panel down', camera.panelUp === false);
  check('failed start releases resources', camera.streamStopped === true);

  // The stranded-panel bug: disable() after a failed start must be safe.
  let threw = false;
  try {
    camera.disable();
  } catch (_) {
    threw = true;
  }
  check('disable after a failed start does not throw', threw === false);
  check('disable after teardown does not re-run onDisable', camera.disableCalls === 1, `calls=${camera.disableCalls}`);

  // Partial start: cleanups registered before the throw must still run, even
  // though `enabled` never settled true from the caller's point of view.
  class Stranded extends Feature {
    static key = 'stranded';
    onEnable() {
      this.cleanup(() => (this.torn = true));
      throw new Error('boom');
    }
  }
  const stranded = new Stranded();
  await stranded.enable().catch(() => {});
  check('cleanups registered before a throw still run', stranded.torn === true);

  // Double-enable must not build twice.
  class Counter extends Feature {
    static key = 'counter';
    constructor() {
      super();
      this.builds = 0;
    }
    async onEnable() {
      this.builds += 1;
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  const counter = new Counter();
  await Promise.all([counter.enable(), counter.enable(), counter.enable()]);
  check('concurrent enables build once', counter.builds === 1, `builds=${counter.builds}`);

  // Named intervals replace rather than stack — the agent's ring-timer leak.
  class Ticker extends Feature {
    static key = 'ticker';
    onEnable() {}
  }
  const ticker = new Ticker();
  await ticker.enable();
  for (let i = 0; i < 5; i += 1) ticker.every('ring', 1000, () => {});
  check('named interval keeps exactly one timer', ticker._timers.size === 1, `size=${ticker._timers.size}`);
  check('named interval registers no per-call cleanup', ticker._cleanups.length === 0, `cleanups=${ticker._cleanups.length}`);
  ticker.disable();
  check('disable clears named timers', ticker._timers.size === 0);

  // toggle() is async and reports the settled state.
  const toggled = new Ok();
  check('toggle on returns true', (await toggled.toggle(true)) === true);
  check('toggle off returns false', (await toggled.toggle(false)) === false);
}

/** A stand-in for a scroll container, matching what the arbiter drives. */
function makeScroller({ scrollHeight = 5000, clientHeight = 800, smooth = false } = {}) {
  return {
    isConnected: true,
    scrollTop: 0,
    scrollHeight,
    clientHeight,
    scrollTo({ top }) {
      // A page with `scroll-behavior: smooth` animates instead of jumping, so
      // the offset has NOT changed by the time the caller reads it back. The
      // arbiter must not mistake that for having reached the bottom.
      if (smooth) return;
      this.scrollTop = top;
    }
  };
}

function testScroll() {
  console.log('\nScroll arbiter');

  const doc = sandbox.document.scrollingElement;
  doc.scrollTop = 0;
  sandbox.scrollY = 0;
  Scroll.reset();

  // The bug this exists for: sub-pixel velocities were dropped on the floor,
  // so slow reading paces and gentle head movement scrolled nothing at all.
  let moved = 0;
  for (let i = 0; i < 10; i += 1) moved += Scroll.by(0.4);
  check('sub-pixel steps accumulate into real movement', moved === 4, `moved=${moved}`);
  check('document scrolled by the same amount', doc.scrollTop === 4, `top=${doc.scrollTop}`);

  Scroll.reset();
  doc.scrollTop = 0;
  check('a single sub-pixel step moves nothing yet', Scroll.by(0.4) === 0);
  check('reset drops the carry', (Scroll.reset(), Scroll.by(0.4)) === 0);

  // Focus Mode owns its own scroller; Auto Scroll and Gaze Scroll must follow
  // it there rather than silently scrolling the document behind it.
  const reader = makeScroller();
  const release = Scroll.claim(reader, 10);
  Scroll.reset();
  doc.scrollTop = 0;

  Scroll.by(120);
  check('a claimed surface receives the scroll', reader.scrollTop === 120, `top=${reader.scrollTop}`);
  check('the document is left alone while claimed', doc.scrollTop === 0, `top=${doc.scrollTop}`);
  check('max() reports the claimed surface range', Scroll.max() === 4200, `max=${Scroll.max()}`);

  // Reaching the end reports zero, and does not overshoot the content.
  Scroll.reset();
  reader.scrollTop = 4190;
  const tail = Scroll.by(100);
  check('a move past the end is clamped', reader.scrollTop === 4200, `top=${reader.scrollTop}`);
  check('the clamped move reports what it really did', tail === 10, `moved=${tail}`);
  Scroll.reset();
  check('a move at the very end reports zero', Scroll.by(100) === 0);

  release();
  Scroll.reset();
  doc.scrollTop = 0;
  Scroll.by(50);
  check('releasing hands the document back', doc.scrollTop === 50, `top=${doc.scrollTop}`);

  // A claim whose element left the DOM must not strand every scrolling tool.
  const stale = { isConnected: false, scrollTop: 0 };
  Scroll.claim(stale, 10);
  Scroll.reset();
  doc.scrollTop = 0;
  Scroll.by(30);
  check('a disconnected claim is skipped', doc.scrollTop === 30, `top=${doc.scrollTop}`);
  Scroll._claims.length = 0;

  // The regression that broke every site with `scroll-behavior: smooth`:
  // the offset does not update synchronously, and reading it back made the
  // scrollers conclude they had hit the bottom on their very first frame.
  const animated = makeScroller({ smooth: true });
  const releaseAnimated = Scroll.claim(animated, 10);
  Scroll.reset();
  const reported = Scroll.by(120);
  check(
    'a smooth-scrolling page still reports real movement',
    reported === 120,
    `moved=${reported}`
  );
  releaseAnimated();
  Scroll.reset();
}

function testDock() {
  console.log('\nDock');

  // Six tools can be on at once. Before the dock they all pinned themselves to
  // the same 20px of one corner, and whichever mounted last hid the rest.
  const bar = (height) => ({
    isConnected: true,
    offsetHeight: height,
    style: {}
  });

  const first = bar(40);
  const second = bar(60);
  const third = bar(50);

  const releaseFirst = Dock.register('a', 'bottom-left', first);
  Dock.register('b', 'bottom-left', second);
  Dock.register('c', 'bottom-right', third);

  check('first bar sits at the base inset', first.style.bottom === '20px', first.style.bottom);
  check('second bar clears the first', second.style.bottom === '72px', second.style.bottom);
  check('bars stack along the correct edge', first.style.left === '20px' && second.style.left === '20px');
  check('the opposite edge is released', first.style.right === 'auto' && first.style.top === 'auto');
  check('a different corner starts its own stack', third.style.bottom === '20px' && third.style.right === '20px');

  releaseFirst();
  check('releasing one re-flows the rest', second.style.bottom === '20px', second.style.bottom);

  // A bar torn down without releasing (a crashed teardown) must not leave a gap.
  second.isConnected = false;
  Dock.layout();
  check('a detached bar is dropped from the stack', Dock.entries.has('b') === false);

  Dock.release('c');
}

function testText() {
  console.log('\nText');
  check(
    'escape neutralises markup',
    Text.escape('<img src=x onerror="alert(1)">') ===
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
  );
  check('escape handles apostrophes', Text.escape("it's") === 'it&#39;s');
}

/* ---- run ----------------------------------------------------------------- */

(async () => {
  await testStore();
  await testFeature();
  testScroll();
  testDock();
  testText();

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
})();
