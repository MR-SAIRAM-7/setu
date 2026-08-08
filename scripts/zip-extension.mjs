import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Package the built extension for Chrome Web Store submission.
 *
 * §43.3 — submit for the story ("it's in review", with a screenshot), but
 * ALWAYS demo the local unpacked build. Never depend on a store listing on
 * demo day.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'apps/extension/dist');
const out = resolve(root, 'setu-lens.zip');

if (!existsSync(dist)) {
  console.error('✗ apps/extension/dist not found. Run `pnpm ext:build` first.');
  process.exit(1);
}

if (existsSync(out)) rmSync(out);

try {
  if (platform() === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Compress-Archive -Path "${dist}\\*" -DestinationPath "${out}" -Force`],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('zip', ['-r', out, '.'], { cwd: dist, stdio: 'inherit' });
  }
  console.log(`\n✓ ${out}`);
  console.log('  Upload at https://chrome.google.com/webstore/devconsole');
  console.log('  Justify every permission in the listing — vague justifications get rejected,');
  console.log('  and writing them forces you to check you are not over-requesting.\n');
} catch (e) {
  console.error('✗ Could not create the zip.', e.message);
  process.exit(1);
}
