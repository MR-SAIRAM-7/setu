/**
 * Static sweep over the content scripts: does every file that uses a SETU
 * runtime object actually pull it out of window.SETU?
 *
 * A missing one is a ReferenceError at feature-enable time — invisible until a
 * user turns that feature on, on some page, somewhere.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content');
const NAMES = ['Feature', 'UI', 'API', 'Text', 'Store'];

let problems = 0;

for (const file of fs.readdirSync(DIR).sort()) {
  if (!file.endsWith('.js')) continue;

  const source = fs.readFileSync(path.join(DIR, file), 'utf8');
  // Strip comments so prose like "Features driven by..." cannot register as use.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const destructured = new Set();
  const match = code.match(/const\s*\{([^}]+)\}\s*=\s*window\.SETU/);
  if (match) {
    for (const raw of match[1].split(',')) {
      destructured.add(raw.trim().split(':')[0].trim());
    }
  }

  for (const name of NAMES) {
    const used =
      new RegExp(`(?<![.\\w])${name}\\.`).test(code) ||
      new RegExp(`extends\\s+${name}\\b`).test(code);
    const viaWindow = new RegExp(`window\\.SETU\\.${name}`).test(code);

    if (used && !destructured.has(name) && !viaWindow) {
      console.log(`  MISSING  ${file} uses ${name} without importing it`);
      problems += 1;
    }
    if (destructured.has(name) && !used) {
      console.log(`  unused   ${file} imports ${name} but never uses it`);
    }
  }
}

console.log(problems ? `\n${problems} missing import(s)` : '\nno missing imports');
process.exitCode = problems ? 1 : 0;
