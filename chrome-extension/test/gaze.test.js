/**
 * The Gaze Scroll control law, exercised with synthetic head positions.
 *
 * There is no camera in a test run, and there does not need to be: the part
 * that was broken was never the camera. It was the loop that turns a head
 * position into scroll movement, and that is pure arithmetic over a head
 * offset and an elapsed time. Feeding it a held-still head, a tilted head, and
 * a jittering one is a faithful test of everything the user actually
 * complained about.
 *
 * Run: node test/gaze.test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT = path.join(__dirname, '..');

/* ---- environment stub ---------------------------------------------------- */

const scroller = {
  scrollTop: 0,
  scrollHeight: 12000,
  clientHeight: 800,
  scrollTo({ top }) {
    this.scrollTop = top;
  }
};

const sandbox = {
  console,
  structuredClone,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: (fn) => setTimeout(fn, 16),
  cancelAnimationFrame: clearTimeout,
  performance: { now: () => Date.now() },
  innerWidth: 1280,
  innerHeight: 800,
  scrollX: 0,
  scrollY: 0,
  addEventListener() {},
  removeEventListener() {},
  chrome: {
    storage: {
      sync: { get: async () => ({}), set: async () => {} },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage: async () => ({ ok: false }) }
  }
};

sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = {
  scrollingElement: scroller,
  documentElement: scroller,
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({ getContext: () => ({}), style: {}, setAttribute() {} })
};

vm.createContext(sandbox);
for (const file of [['shared', 'setu-config.js'], ['shared', 'setu-core.js'], ['content', 'eye-tracker.js']]) {
  vm.runInContext(fs.readFileSync(path.join(EXT, ...file), 'utf8'), sandbox, { filename: file[1] });
}

const { Scroll, features } = sandbox.window.SETU;
const GazeScroll = features.get('eye');

/* ---- harness -------------------------------------------------------------- */

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

const START = 4000;

/**
 * Hold a head at `offset` from neutral for `seconds`, and report how far the
 * page moved. Positive offset is a head below the calibrated rest position.
 */
function run(offset, { dt = 1 / 60, sensitivity = 1, invert = false, seconds = 2, jitter = 0 } = {}) {
  const gaze = new GazeScroll();
  gaze.enabled = true;
  gaze.sensitivity = sensitivity;
  gaze.invert = invert;
  gaze.confidence = 1;
  gaze.calibrated = true;
  gaze.neutralY = 0.5;
  gaze.paint = () => {};
  gaze.setStatus = () => {};

  scroller.scrollTop = START;
  Scroll.reset();

  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i += 1) {
    const noise = jitter ? (Math.sin(i * 7.3) * jitter) : 0;
    gaze.headY = 0.5 + offset + noise;

    // Stand in for the dwell the sampler would have accumulated.
    if (Math.abs(gaze.headY - gaze.neutralY) >= 0.045) {
      if (!gaze.outsideSince) gaze.outsideSince = sandbox.performance.now() - 500;
    } else {
      gaze.outsideSince = 0;
    }

    gaze.integrate(dt);
  }

  return Math.round(scroller.scrollTop - START);
}

/* ---- tests ---------------------------------------------------------------- */

console.log('\nGaze Scroll — direction');

const down = run(0.13);
const up = run(-0.13);
check('a head held down scrolls the page down', down > 200, `moved=${down}`);
check('a head held up scrolls the page back up', up < -200, `moved=${up}`);
check('the two directions are symmetric', Math.abs(down + up) < 40, `down=${down} up=${up}`);

console.log('\nGaze Scroll — stillness');

// The whole complaint: "when I'm still the webpage should be still."
const still = run(0);
check('a head held still does not scroll at all', still === 0, `moved=${still}`);

// Camera noise is a couple of percent of frame height, every frame, forever.
const noisy = run(0, { jitter: 0.012, seconds: 5 });
check('camera jitter inside the deadzone never scrolls', noisy === 0, `moved=${noisy}`);

// A head just outside the deadzone should creep, not lurch.
const gentle = run(0.06);
check('a small tilt moves gently', gentle > 0 && gentle < 200, `moved=${gentle}`);

console.log('\nGaze Scroll — response');

const slow = run(0.10, { sensitivity: 0.4 });
const normal = run(0.10, { sensitivity: 1 });
const fast = run(0.10, { sensitivity: 2 });
check('sensitivity scales the pace', slow < normal && normal < fast, `${slow} < ${normal} < ${fast}`);
check('sensitivity scales roughly linearly', Math.abs(fast / normal - 2) < 0.25, `ratio=${(fast / normal).toFixed(2)}`);

const inverted = run(0.13, { invert: true });
check('invert flips the mapping', inverted < 0 && Math.abs(inverted + down) < 40, `moved=${inverted}`);

console.log('\nGaze Scroll — frame rate');

// The old loop moved a fixed number of pixels per *frame*, so it ran at more
// than double speed on a 144Hz display and half speed on a throttled tab.
const at60 = run(0.10, { dt: 1 / 60 });
const at144 = run(0.10, { dt: 1 / 144 });
const at30 = run(0.10, { dt: 1 / 30 });
check('60Hz and 144Hz travel the same distance', Math.abs(at144 / at60 - 1) < 0.05, `${at60} vs ${at144}`);
check('60Hz and 30Hz travel the same distance', Math.abs(at30 / at60 - 1) < 0.08, `${at60} vs ${at30}`);

console.log('\nGaze Scroll — page limits');

// Sub-pixel carry means a frame often moves nothing. Reading that as "the page
// has ended" stalled the scroll forever at moderate speeds.
scroller.scrollTop = 0;
const fromTop = run(0.10);
check('a mid-speed scroll does not stall on sub-pixel frames', fromTop > 100, `moved=${fromTop}`);

const gaze = new GazeScroll();
gaze.enabled = true;
gaze.sensitivity = 1;
gaze.confidence = 1;
gaze.calibrated = true;
gaze.neutralY = 0.5;
gaze.paint = () => {};
gaze.setStatus = () => {};
gaze.headY = 0.63;
gaze.outsideSince = sandbox.performance.now() - 500;

scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
for (let i = 0; i < 120; i += 1) gaze.integrate(1 / 60);
check('reaching the bottom stops the run', gaze.velocity === 0, `velocity=${gaze.velocity}`);
check('it does not scroll past the end', scroller.scrollTop === 11200, `top=${scroller.scrollTop}`);

/* ---- report --------------------------------------------------------------- */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exitCode = 1;
}
