import { describe, expect, it } from 'vitest';
import {
  BreatheDetector,
  CLS_WEIGHTS,
  DEFAULT_DNA,
  SCHEMA_BY_MODE,
  ZERO_SIGNALS,
  bionicTokens,
  buildTree,
  chooseTier,
  chunk,
  computeCLS,
  deterministicFallback,
  fixationLength,
  focusMode,
  fleschKincaidGrade,
  hasStrongTopic,
  luhn,
  parseTemporal,
  redactPII,
  rehydrate,
  resolveMode,
  rrf,
  sat,
  summariseDom,
  undoFocus,
} from '../src/index';
import type { Intensity } from '../src/types';

/* ─────────────────────────────────────────────────────────────────────────────
   Appendix D — the kernel tests. These are the ones that matter under time
   pressure. The focusMode form-control test in particular must never be
   deleted: without it, a regression silently hides the submit button on a
   government form, which is a catastrophic failure for exactly our user.
   ───────────────────────────────────────────────────────────────────────────── */

describe('fixationLength — boundary word lengths 1..20 at each intensity', () => {
  it('matches the verified table', () => {
    const table: Record<number, [number, number, number]> = {
      1: [0, 0, 0],
      2: [1, 1, 1],
      3: [1, 1, 2],
      4: [1, 2, 3],
      5: [1, 2, 3],
      6: [2, 3, 4],
      8: [2, 3, 4],
      10: [3, 4, 5],
      14: [5, 6, 7],
      20: [7, 8, 9],
    };
    for (const [len, expected] of Object.entries(table)) {
      const word = 'a'.repeat(Number(len));
      expect([1, 2, 3].map((i) => fixationLength(word, i as Intensity))).toEqual(expected);
    }
  });

  it('never returns n (would embolden the whole word)', () => {
    for (let n = 1; n <= 20; n++) {
      for (const i of [1, 2, 3] as Intensity[]) {
        expect(fixationLength('a'.repeat(n), i)).toBeLessThan(n);
      }
    }
  });

  it('never returns 0 for n >= 2 at any active intensity', () => {
    for (let n = 2; n <= 20; n++) {
      for (const i of [1, 2, 3] as Intensity[]) {
        expect(fixationLength('a'.repeat(n), i)).toBeGreaterThan(0);
      }
    }
  });

  it('intensity 0 is off', () => {
    expect(fixationLength('accessibility', 0)).toBe(0);
  });

  it('bionicTokens round-trips the original string exactly', () => {
    const src = 'The quick, brown fox — jumps over 42 lazy dogs.';
    expect(
      bionicTokens(src, 2)
        .map(([b, r]) => b + r)
        .join(''),
    ).toBe(src);
  });
});

describe('CLS', () => {
  it('sat() is correctly saturating', () => {
    expect(sat(0, 10)).toBe(0);
    expect(sat(10, 10)).toBe(50);
    expect(sat(100, 10)).toBe(91);
  });

  it('component weights sum to exactly 1.000 — score is bounded 0..100', () => {
    const total = Object.values(CLS_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
  });

  it('a calm document scores lower than a hostile one', () => {
    document.body.innerHTML = `<main><h1>A quiet page</h1><p>One short line. It is easy to read.</p></main>`;
    const calm = computeCLS(document, document.body.textContent ?? '');

    document.body.innerHTML =
      `<div>${'<div><span>x</span></div>'.repeat(500)}</div>` +
      `<div style="position:fixed;height:200px">cookie banner</div>` +
      Array.from({ length: 60 }, (_, i) => `<button>Option ${i}</button>`).join('') +
      `<p>${'Notwithstanding the aforementioned considerations regarding institutional accreditation frameworks, '.repeat(20)}</p>`;
    const hostile = computeCLS(document, document.body.textContent ?? '');

    expect(hostile.score).toBeGreaterThan(calm.score);
    expect(hostile.score).toBeLessThanOrEqual(100);
    expect(calm.score).toBeGreaterThanOrEqual(0);
  });
});

describe('focusMode', () => {
  it('NEVER hides an element containing a form control', () => {
    document.body.innerHTML = `
      <div class="ad-container">
        <form id="registration">
          <label for="roll">Roll number</label>
          <input id="roll" name="roll" required />
          <button type="submit">Submit application</button>
        </form>
      </div>
      <div class="cookie-banner">Accept cookies</div>
      <aside class="related">Related stories</aside>
    `;

    focusMode(document);

    const form = document.querySelector('#registration');
    const submit = document.querySelector('button[type="submit"]');
    const adWrapper = document.querySelector('.ad-container');

    expect(form?.hasAttribute('data-setu-hidden')).toBe(false);
    expect(submit?.hasAttribute('data-setu-hidden')).toBe(false);
    // the ad-classed wrapper is PROTECTED because it contains the form
    expect(adWrapper?.hasAttribute('data-setu-hidden')).toBe(false);
    // but genuine noise is hidden
    expect(document.querySelector('.cookie-banner')?.hasAttribute('data-setu-hidden')).toBe(true);
  });

  it('undo restores everything it hid', () => {
    document.body.innerHTML = `<div class="popup">x</div><p>content</p>`;
    focusMode(document);
    expect(document.querySelectorAll('[data-setu-hidden]').length).toBeGreaterThan(0);
    undoFocus(document);
    expect(document.querySelectorAll('[data-setu-hidden]').length).toBe(0);
    expect(document.documentElement.hasAttribute('data-setu-focus')).toBe(false);
  });
});

describe('PII redaction', () => {
  it('catches email, phone, Aadhaar-shaped, PAN-shaped, and Luhn-valid cards', () => {
    const src = [
      'Contact priya.sharma@example.com or call +91 98765 43210.',
      'Aadhaar 3675 9834 6012 and PAN ABCDE1234F.',
      'Card 4539 1488 0343 6467 expires soon.',
    ].join('\n');

    const { text, spans } = redactPII(src);
    const kinds = new Set(spans.map((s) => s.kind));

    expect(kinds.has('EMAIL')).toBe(true);
    expect(kinds.has('PHONE')).toBe(true);
    expect(kinds.has('AADHAAR')).toBe(true);
    expect(kinds.has('PAN')).toBe(true);
    expect(kinds.has('CARD')).toBe(true);

    expect(text).not.toContain('priya.sharma@example.com');
    expect(text).not.toContain('ABCDE1234F');
    expect(text).not.toContain('4539 1488 0343 6467');
  });

  it('rejects card-shaped digits that fail Luhn', () => {
    expect(luhn('4539148803436467')).toBe(true);
    expect(luhn('4539148803436468')).toBe(false);
  });

  it('gives identical values the same placeholder', () => {
    const { spans } = redactPII('a@b.com and again a@b.com');
    expect(new Set(spans.map((s) => s.placeholder)).size).toBe(1);
  });

  it('round-trips through rehydrate without corruption', () => {
    const src = 'Email me at priya@example.com about your PAN ABCDE1234F.';
    const { text, spans } = redactPII(src);
    const modelOutput = { mode: 'EXPLAIN', plain: `Write to ${text}`, nested: [{ x: text }] };
    const restored = rehydrate(modelOutput, spans);
    expect(restored.plain).toContain('priya@example.com');
    expect(restored.plain).toContain('ABCDE1234F');
    expect(restored.nested[0]?.x).toContain('priya@example.com');
  });

  it('is a no-op on clean text', () => {
    const { text, spans } = redactPII('There is nothing personal in this sentence.');
    expect(spans).toHaveLength(0);
    expect(text).toBe('There is nothing personal in this sentence.');
  });
});

describe('chunking', () => {
  it('prepends the heading path and overlaps chunks', () => {
    const doc = [
      '# Signals and Systems',
      '## Fourier Series',
      'A'.repeat(700),
      '',
      'B'.repeat(700),
      '',
      'C'.repeat(400),
    ].join('\n');

    const chunks = chunk(doc, { target: 800, overlap: 120 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.headingPath).toContain('Fourier Series');
    expect(chunks.every((c) => c.tokenCount > 0)).toBe(true);
  });

  it('returns nothing for empty input rather than an empty chunk', () => {
    expect(chunk('   ')).toEqual([]);
  });
});

describe('chooseTier — every branch of the ladder', () => {
  const base = {
    dna: DEFAULT_DNA,
    nanoAvailable: false,
    online: true,
    consentGranted: true,
  };

  it('FOCUS is always L0, regardless of anything else', () => {
    expect(chooseTier({ ...base, mode: 'FOCUS', online: false }).tier).toBe('L0');
  });

  it('cloudAI:never routes to L1 when Nano exists', () => {
    const dna = { ...DEFAULT_DNA, privacy: { cloudAI: 'never' as const, vaultSync: false } };
    expect(chooseTier({ ...base, mode: 'EXPLAIN', dna, nanoAvailable: true }).tier).toBe('L1');
  });

  it('cloudAI:never throws when Nano does not exist — it never silently escalates', () => {
    const dna = { ...DEFAULT_DNA, privacy: { cloudAI: 'never' as const, vaultSync: false } };
    expect(() => chooseTier({ ...base, mode: 'EXPLAIN', dna, nanoAvailable: false })).toThrow();
  });

  it('offline + Nano = L1; offline without Nano throws OFFLINE', () => {
    expect(chooseTier({ ...base, mode: 'START', online: false, nanoAvailable: true }).tier).toBe('L1');
    expect(() => chooseTier({ ...base, mode: 'START', online: false })).toThrow(/Offline/i);
  });

  it('small nano-capable jobs prefer L1 over L2', () => {
    const ex = { wordCount: 300 } as never;
    expect(chooseTier({ ...base, mode: 'EXPLAIN', ex, nanoAvailable: true }).tier).toBe('L1');
  });

  it('long LEARN documents escalate to L3', () => {
    const ex = { wordCount: 20_000 } as never;
    expect(chooseTier({ ...base, mode: 'LEARN', ex }).tier).toBe('L3');
  });

  it("cloudAI:'ask' without consent refuses rather than sending", () => {
    expect(() => chooseTier({ ...base, mode: 'MEET', consentGranted: false })).toThrow(/OK/i);
  });

  it('images never route on-device', () => {
    expect(
      chooseTier({ ...base, mode: 'EXPLAIN', nanoAvailable: true, hasImage: true }).tier,
    ).toBe('L2');
  });
});

describe('Breathe', () => {
  const burst = { jerk: 40, scrollReversals: 12, repeatClicks: 6, dwellFragments: 9, backtracks: 7 };

  function run(sensitivity: Intensity, ticks: Array<{ s: typeof burst; t: number }>) {
    let fires = 0;
    const d = new BreatheDetector(
      { sensitivity, cooldownMs: 300_000, minSessionMs: 20_000, maxPerHour: 3 },
      () => fires++,
    );
    for (const { s, t } of ticks) d.tick(s, t);
    return fires;
  }

  const calmTicks = (from: number, n: number, step = 250) =>
    Array.from({ length: n }, (_, i) => ({ s: ZERO_SIGNALS as typeof burst, t: from + i * step }));

  const burstTicks = (from: number, n: number, step = 250) =>
    Array.from({ length: n }, (_, i) => ({ s: burst, t: from + i * step }));

  it('sensitivity 0 provably never fires', () => {
    expect(run(0, [...calmTicks(0, 40), ...burstTicks(25_000, 60)])).toBe(0);
  });

  it('a burst inside the first 20s is suppressed by minSessionMs', () => {
    expect(run(3, [...calmTicks(0, 20, 100), ...burstTicks(2_000, 40, 100)])).toBe(0);
  });

  it('fires at most once for a sustained burst after the session floor', () => {
    const fires = run(3, [...calmTicks(0, 40), ...burstTicks(25_000, 40)]);
    expect(fires).toBeLessThanOrEqual(1);
  });

  it('two dismissals drop sensitivity one notch', () => {
    const d = new BreatheDetector({ ...{ sensitivity: 2 as Intensity, cooldownMs: 1, minSessionMs: 0, maxPerHour: 3 } });
    expect(d.dismissed()).toBe(2); // one dismissal changes nothing
    expect(d.dismissed()).toBe(1); // two in a row does
  });

  it('forceFire bypasses every gate — the demo-day escape hatch', () => {
    let fired = false;
    const d = new BreatheDetector(undefined, () => (fired = true));
    d.forceFire();
    expect(fired).toBe(true);
  });
});

describe('schemas', () => {
  it('every mode schema accepts its deterministic fallback', () => {
    for (const [mode, schema] of Object.entries(SCHEMA_BY_MODE)) {
      const fallback = deterministicFallback(mode as never, 'Apply for my exam re-evaluation');
      const parsed = schema.safeParse(fallback);
      expect(parsed.success, `${mode} fallback failed: ${JSON.stringify(parsed.error?.issues)}`).toBe(
        true,
      );
    }
  });

  it('rejects a known-bad payload', () => {
    expect(SCHEMA_BY_MODE.START.safeParse({ mode: 'START' }).success).toBe(false);
    expect(
      SCHEMA_BY_MODE.START.safeParse({
        mode: 'START',
        restated: 'x',
        clarifier: null,
        firstAction: { text: 'x', minutes: 99, why: 'x' }, // minutes out of range
        steps: [],
        encouragement: 'x',
      }).success,
    ).toBe(false);
  });

  it('buildTree survives a completely malformed node list', () => {
    const tree = buildTree([
      { id: 'a', parentId: 'ghost', label: 'orphan', depth: 1 },
      { id: 'b', parentId: 'ghost', label: 'orphan2', depth: 1 },
    ]);
    expect(tree).toBeTruthy();
    expect(tree.label.length).toBeGreaterThan(0);
  });

  it('buildTree enforces our fan-out limit even when the model ignores it', () => {
    const flat = [
      { id: 'r', parentId: null, label: 'root', depth: 0 },
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `c${i}`,
        parentId: 'r',
        label: `c${i}`,
        depth: 1,
      })),
    ];
    expect(buildTree(flat).children.length).toBeLessThanOrEqual(6);
  });
});

describe('router', () => {
  it('explicit beats heuristic', () => {
    expect(
      resolveMode({ explicit: 'LEARN', artifact: { kind: 'task', text: 'do the thing' } }),
    ).toBe('LEARN');
  });

  it('utterance triggers before artifact shape', () => {
    expect(
      resolveMode({ utterance: 'what does this mean', artifact: { kind: 'task', text: 'x' } }),
    ).toBe('EXPLAIN');
  });

  it('a long page becomes LEARN, a short one FOCUS', () => {
    const mk = (n: number) => ({ kind: 'page' as const, url: '', title: '', html: '', text: 'x'.repeat(n) });
    expect(resolveMode({ artifact: mk(100) })).toBe('FOCUS');
    expect(resolveMode({ artifact: mk(10_000) })).toBe('LEARN');
  });
});

describe('retrieval', () => {
  it('parses temporal queries', () => {
    const now = new Date('2026-08-08T20:00:00');
    const y = parseTemporal('what was I reading yesterday afternoon?', now);
    expect(y).toBeTruthy();
    expect(y!.from.getDate()).toBe(7);
    expect(y!.from.getHours()).toBe(12);
    expect(parseTemporal('explain orthogonality', now)).toBeNull();
  });

  it('distinguishes pure-time queries from topic queries', () => {
    expect(hasStrongTopic('what was I reading yesterday')).toBe(false);
    expect(hasStrongTopic('what was I reading about Fourier yesterday')).toBe(true);
  });

  it('RRF promotes items present in both lists', () => {
    const semantic = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const lexical = [{ id: 'C' }, { id: 'A' }, { id: 'D' }];
    expect(rrf([semantic, lexical]).map((x) => x.id)).toEqual(['A', 'C', 'B', 'D']);
  });
});

describe('DOM summariser — the agent safety rail', () => {
  it('withholds password, OTP and payment fields before the model sees them', () => {
    document.body.innerHTML = `
      <form>
        <input name="username" aria-label="Username" />
        <input type="password" name="password" aria-label="Password" />
        <input name="otp" aria-label="One time code" />
        <input name="cardNumber" aria-label="Card number" />
        <button>Sign in</button>
      </form>`;

    const dom = summariseDom(document);
    const names = dom.elements.map((e) => e.name.toLowerCase()).join(' ');

    expect(dom.withheld).toBeGreaterThanOrEqual(3);
    expect(names).not.toContain('password');
    expect(names).not.toContain('one time code');
    expect(names).not.toContain('card number');
    expect(names).toContain('username');
  });

  it('assigns opaque handles, not CSS selectors', () => {
    document.body.innerHTML = `<button class="submit-btn">Go</button>`;
    const dom = summariseDom(document);
    expect(dom.elements[0]?.id).toMatch(/^e\d+$/);
  });
});

describe('readability grade', () => {
  it('scores simple text lower than dense text', () => {
    const simple = 'The cat sat on the mat. It was warm. The sun was out.';
    const dense =
      'Notwithstanding the aforementioned institutional accreditation requirements, candidates must demonstrate substantive procedural compliance with the applicable regulatory framework prior to consideration.';
    expect(fleschKincaidGrade(simple)).toBeLessThan(fleschKincaidGrade(dense));
  });
});
