import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_DNA, defaultContext, type Mode, type TTransformArtifact } from '../packages/core/src/index';
import { assertionsFor } from './assertions';

/**
 * `pnpm eval` → a table with the pass rate per mode.
 *
 * PUT THAT TABLE ON A SLIDE (§42.11). Two hours on top of the harness, and it
 * is a credibility multiplier on every other claim you make — because you will
 * be the only team in the room who measured their own AI, and the only one who
 * can name their failures without being caught out.
 *
 * Usage:
 *   pnpm eval                    run every case against the live edge
 *   pnpm eval -- --mode START    one mode only
 *   pnpm eval -- --runs 3        repeat each case, to measure determinism
 *   pnpm eval -- --base https://setu-edge.vercel.app
 */

interface GoldenCase {
  id: string;
  mode: Mode;
  input: string;
  notes?: string;
}

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
};

const BASE = flag('base', process.env.SETU_EVAL_BASE ?? 'http://localhost:3000')!;
const ONLY = flag('mode');
const RUNS = Number(flag('runs', '1'));

const cases: GoldenCase[] = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'golden/cases.json'), 'utf8'),
);

interface Row {
  id: string;
  mode: Mode;
  passed: number;
  total: number;
  failures: string[];
  latencyMs: number;
  errored?: string;
  stable?: boolean;
}

async function callEdge(c: GoldenCase): Promise<{ data?: TTransformArtifact; error?: string; ms: number }> {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}/api/transform`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-setu-client': 'eval-harness' },
      body: JSON.stringify({
        mode: c.mode,
        input: c.input,
        dna: { ...DEFAULT_DNA, privacy: { cloudAI: 'allow', vaultSync: false } },
        surface: 'sanctuary',
        consent: true,
        ...defaultContext('sanctuary'),
      }),
      signal: AbortSignal.timeout(40_000),
    });

    const body = (await res.json()) as { ok: boolean; data?: TTransformArtifact; error?: { message: string } };
    if (!body.ok) return { error: body.error?.message ?? `HTTP ${res.status}`, ms: Date.now() - started };
    return { data: body.data, ms: Date.now() - started };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), ms: Date.now() - started };
  }
}

/** Structural determinism: same input, same SHAPE. Not the same words. */
function shapeOf(o: TTransformArtifact): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return typeof v;
  };
  return JSON.stringify(walk(o));
}

async function main() {
  const selected = cases.filter((c) => !ONLY || c.mode === ONLY);
  console.log(`\nSETU eval — ${selected.length} golden cases against ${BASE}\n`);

  const rows: Row[] = [];

  for (const c of selected) {
    const assertions = assertionsFor(c.mode);
    const first = await callEdge(c);

    if (first.error || !first.data) {
      rows.push({
        id: c.id,
        mode: c.mode,
        passed: 0,
        total: assertions.length,
        failures: [],
        latencyMs: first.ms,
        errored: first.error ?? 'no data',
      });
      process.stdout.write(`  ✗ ${c.id.padEnd(24)} ${first.error}\n`);
      continue;
    }

    const failures = assertions.filter((a) => !safe(() => a.fn(first.data!, c.input))).map((a) => a.name);

    let stable: boolean | undefined;
    if (RUNS > 1) {
      const shapes = new Set([shapeOf(first.data)]);
      for (let i = 1; i < RUNS; i++) {
        const again = await callEdge(c);
        if (again.data) shapes.add(shapeOf(again.data));
      }
      stable = shapes.size === 1;
    }

    rows.push({
      id: c.id,
      mode: c.mode,
      passed: assertions.length - failures.length,
      total: assertions.length,
      failures,
      latencyMs: first.ms,
      stable,
    });

    const mark = failures.length === 0 ? '✓' : '·';
    process.stdout.write(
      `  ${mark} ${c.id.padEnd(24)} ${assertions.length - failures.length}/${assertions.length}  ${first.ms}ms` +
        (stable === false ? '  [unstable shape]' : '') +
        '\n',
    );
  }

  report(rows);
}

function report(rows: Row[]) {
  const byMode = new Map<Mode, Row[]>();
  for (const r of rows) byMode.set(r.mode, [...(byMode.get(r.mode) ?? []), r]);

  console.log('\n' + '─'.repeat(64));
  console.log('  MODE        CASES   ASSERTIONS   PASS RATE   MEDIAN LATENCY');
  console.log('─'.repeat(64));

  let totalPassed = 0;
  let totalAssertions = 0;

  for (const [mode, rs] of byMode) {
    const passed = rs.reduce((a, r) => a + r.passed, 0);
    const total = rs.reduce((a, r) => a + r.total, 0);
    totalPassed += passed;
    totalAssertions += total;
    const median = rs.map((r) => r.latencyMs).sort((a, b) => a - b)[Math.floor(rs.length / 2)] ?? 0;
    const rate = total ? Math.round((passed / total) * 100) : 0;
    console.log(
      `  ${mode.padEnd(11)} ${String(rs.length).padStart(5)}   ${String(total).padStart(10)}   ${String(rate + '%').padStart(9)}   ${String(median + 'ms').padStart(14)}`,
    );
  }

  console.log('─'.repeat(64));
  const overall = totalAssertions ? Math.round((totalPassed / totalAssertions) * 100) : 0;
  console.log(
    `  OVERALL     ${String(rows.length).padStart(5)}   ${String(totalAssertions).padStart(10)}   ${String(overall + '%').padStart(9)}`,
  );
  console.log('─'.repeat(64) + '\n');

  const failing = rows.filter((r) => r.failures.length || r.errored);
  if (failing.length) {
    console.log('KNOWN FAILURES — name these out loud before a judge finds them:\n');
    for (const r of failing) {
      console.log(`  ${r.id} (${r.mode})`);
      if (r.errored) console.log(`    · errored: ${r.errored}`);
      for (const f of r.failures) console.log(`    · ${f}`);
    }
    console.log('');
  } else {
    console.log('No failures. Re-read the assertions — a suite that never fails is a suite that\n' +
      'is not testing anything.\n');
  }

  // Non-zero exit on a hard schema failure, so CI can gate on it.
  const schemaBroken = rows.some((r) => r.failures.includes('schema valid'));
  if (schemaBroken) process.exitCode = 1;
}

function safe(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

void main();
