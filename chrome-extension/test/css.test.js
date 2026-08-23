/**
 * Does every CSS custom property a stylesheet uses actually get defined
 * somewhere that stylesheet can see?
 *
 * This exists because of a real bug: the popup names its tokens `--color-accent`
 * and the options page names the same token `--accent`. A block copied between
 * them referenced `--color-accent` in options.css, where it does not exist.
 * `background: var(--color-accent)` is then invalid at computed-value time, so
 * the declaration is dropped and the element silently paints transparent —
 * while the neighbouring `color: var(--on-accent)` still worked, because that
 * one name happens to exist in both. The result was a selected button with no
 * fill and no error anywhere.
 *
 * The content scripts are checked too: their CSS lives in JS string arrays and
 * draws on the token set defined in setu-core's baseStyle.
 */

const fs = require('fs');
const path = require('path');

const EXT = path.join(__dirname, '..');

/** Properties the browser provides or that are set from inline style attributes. */
const AMBIENT = new Set(['--sw', '--sf']);

const read = (relative) => fs.readFileSync(path.join(EXT, relative), 'utf8');

const defined = (source) =>
  new Set([
    ...[...source.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
    // Set at runtime from script — the ruler colour is assigned this way.
    ...[...source.matchAll(/setProperty\(\s*['"](--[\w-]+)['"]/g)].map((m) => m[1])
  ]);

/**
 * Only references without a fallback can break. `var(--dim, .55)` is fine
 * however `--dim` is (or isn't) defined, so flagging it would be noise.
 */
const referenced = (source) =>
  new Set(
    [...source.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)]
      .filter((m) => m[2] === ')')
      .map((m) => m[1])
  );

let problems = 0;

function check(label, sources, extraDefinitions = []) {
  const combined = sources.map(read).join('\n');
  const available = new Set([...AMBIENT, ...defined(combined)]);
  for (const extra of extraDefinitions) {
    for (const name of defined(read(extra))) available.add(name);
  }

  const missing = [...referenced(combined)].filter((name) => !available.has(name)).sort();

  if (missing.length) {
    console.log(`  ${label}`);
    for (const name of missing) {
      console.log(`    MISSING  ${name} is used but never defined`);
      problems += 1;
    }
  } else {
    console.log(`  ok  ${label} — ${referenced(combined).size} properties all defined`);
  }
}

// Each page defines its own token set; its markup can contribute via inline style.
check('popup', ['popup/popup.css', 'popup/popup.html']);
check('options', ['options/options.css', 'options/options.html']);

// Content scripts inherit the shadow-root token set from setu-core's baseStyle.
const contentFiles = fs
  .readdirSync(path.join(EXT, 'content'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => `content/${f}`);

for (const file of contentFiles) {
  const source = read(file);
  if (!referenced(source).size) continue;
  check(file, [file], ['shared/setu-core.js']);
}

console.log(problems ? `\n${problems} undefined custom propert(ies)` : '\nevery custom property resolves');
process.exitCode = problems ? 1 : 0;
