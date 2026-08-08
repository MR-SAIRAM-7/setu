import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Run a script across every workspace package.
 *
 * Why this exists rather than `turbo run <script>` or a nested `pnpm -r`:
 * both of those shell out to a `pnpm` binary on PATH. When pnpm is being used
 * through corepack's shim — which is the normal situation on a locked-down
 * Windows machine, because `corepack enable` needs administrator rights — there
 * IS no pnpm on PATH, and every root script fails with a confusing
 * "'pnpm' is not recognized" that looks nothing like the actual problem.
 *
 * `npm_execpath` is set by whichever package manager invoked us and points at
 * its own entry script, so re-invoking through Node always works.
 *
 * Usage: node scripts/workspace.mjs <script> [--parallel]
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [script, ...rest] = process.argv.slice(2);

if (!script) {
  console.error('Usage: node scripts/workspace.mjs <script> [--parallel]');
  process.exit(1);
}

const execpath = process.env.npm_execpath;
if (!execpath) {
  console.error(
    '✗ npm_execpath is not set. Run this through a package manager:\n' +
      '    corepack pnpm run ' + script,
  );
  process.exit(1);
}

const args = ['-r', ...rest, 'run', script];

const child = spawn(process.execPath, [execpath, ...args], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (e) => {
  console.error(`✗ Could not run "${script}" across the workspace:`, e.message);
  process.exit(1);
});
