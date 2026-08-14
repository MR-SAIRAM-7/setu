#!/usr/bin/env node
/**
 * End-to-end smoke test against a running SETU engine.
 *
 *   npm start          # in one terminal
 *   npm run smoke      # in another
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 */

const BASE = process.env.SETU_API || 'http://localhost:3000';

/**
 * Gemini's free tier allows 20 generate_content calls per minute, and several
 * checks below make two model calls each. Pace the suite so it measures the
 * engine rather than the quota. Set SETU_SMOKE_PACE_MS=0 on a paid key.
 */
const PACE_MS = Number(process.env.SETU_SMOKE_PACE_MS ?? 6500);

let passed = 0;
let failed = 0;

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Set on any check that calls the model, so pacing only applies where needed. */
async function check(name, fn, { usesAI = true } = {}) {
  const started = Date.now();
  try {
    const note = await fn();
    passed += 1;
    console.log(`${green('PASS')} ${name} ${dim(`${Date.now() - started}ms${note ? ` — ${note}` : ''}`)}`);
  } catch (error) {
    failed += 1;
    const detail = error.message.split('\n')[0].slice(0, 180);
    console.log(`${red('FAIL')} ${name} ${dim(`${Date.now() - started}ms`)}\n     ${detail}`);
  }
  if (usesAI && PACE_MS) await sleep(PACE_MS);
}

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.error || 'request failed'}`);
  return data;
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const ARTICLE = `The Antikythera mechanism is an ancient Greek analogue computer used to predict
astronomical positions and eclipses decades in advance. Recovered in 1901 from a shipwreck off the
Greek island of Antikythera, it dates to roughly the 2nd century BC. It contains at least 30 bronze
gears and could track the movements of the Sun and Moon through the zodiac, predict eclipses, and
model the irregular orbit of the Moon. No comparable geared mechanism is known from the following
thousand years.`;

(async () => {
  console.log(`\nSETU smoke test → ${BASE}\n`);

  await check('GET /api/health', async () => {
    const response = await fetch(`${BASE}/api/health`);
    const data = await response.json();
    expect(data.status === 'healthy', 'not healthy');
    return `AI ${data.aiConfigured ? 'configured' : 'NOT configured'}`;
  }, { usesAI: false });

  await check('GET /api/health/ai (live model round-trip)', async () => {
    const response = await fetch(`${BASE}/api/health/ai`);
    const data = await response.json();
    expect(data.ok, data.reason || 'model did not respond');
    return `${data.provider}/${data.model}`;
  });

  /* --------------------------- the seven modes --------------------------- */

  await check('POST /api/start', async () => {
    const data = await post('/api/start', { task: 'clean out my inbox', isStuck: true });
    expect(data.immediateTenMinuteAction, 'no ten-minute action');
    expect(Array.isArray(data.microSteps) && data.microSteps.length >= 3, 'too few micro steps');
    expect(data.confidenceMeter?.effortLevel, 'no confidence meter');
    return data.fallback ? 'L0 fallback' : 'AI';
  });

  await check('POST /api/simplify', async () => {
    const data = await post('/api/simplify', { text: ARTICLE });
    expect(data.plainLanguageRewrite?.length > 40, 'rewrite too short');
    expect(data.keyTakeaways?.length >= 2, 'too few takeaways');
    return data.readabilityGrade;
  });

  await check('POST /api/learn', async () => {
    const data = await post('/api/learn', { text: ARTICLE });
    expect(data.mindMap?.branches?.length > 0, 'no mind map branches');
    expect(data.quiz?.length >= 2, 'too few quiz questions');
    const question = data.quiz[0];
    expect(
      question.answerIndex >= 0 && question.answerIndex < question.options.length,
      'answerIndex out of range'
    );
    return `${data.mindMap.branches.length} branches, ${data.quiz.length} questions`;
  });

  await check('POST /api/meet', async () => {
    const data = await post('/api/meet', {
      transcript:
        'Priya: we ship Thursday. Sam: I will finish the migration script by Wednesday. Priya: I will brief support.'
    });
    expect(data.actionItems?.length > 0, 'no action items extracted');
    return `${data.actionItems.length} action items`;
  });

  await check('POST /api/practice', async () => {
    const data = await post('/api/practice', { topic: 'asking for a deadline extension' });
    expect(data.suggestedResponses?.length >= 2, 'too few scripts');
    return `${data.suggestedResponses.length} scripts`;
  });

  await check('POST /api/write', async () => {
    const data = await post('/api/write', {
      text: 'The report was written by the team and it was subsequently reviewed by management.'
    });
    expect(data.improvedText?.length > 10, 'no improved text');
    return data.originalGradeLevel;
  });

  await check('POST /api/guide', async () => {
    const data = await post('/api/guide', { goal: 'renew a passport online' });
    expect(data.steps?.length > 0, 'no steps');
    return `${data.steps.length} steps`;
  });

  /* ---------------------------- research ---------------------------- */

  await check('POST /api/research/mindmap', async () => {
    const data = await post('/api/research/mindmap', { topic: 'the water cycle' });
    expect(data.root?.children?.length >= 3, 'too few branches');
    expect(data.root.children.every((b) => b.label && b.detail), 'branch missing label or detail');
    expect(data.keyFacts?.length > 0, 'no key facts');
    expect(data.followUps?.length > 0, 'no follow-ups');
    const ids = [];
    (function walk(node) {
      ids.push(node.id);
      (node.children || []).forEach(walk);
    })(data.root);
    expect(new Set(ids).size === ids.length, 'duplicate node ids');
    return `${ids.length} nodes, grounded=${data.grounded}`;
  });

  await check('POST /api/research/expand', async () => {
    const data = await post('/api/research/expand', {
      topic: 'the water cycle',
      nodeLabel: 'Evaporation',
      nodeDetail: 'Water turns from liquid into vapour.',
      path: ['The Water Cycle', 'Evaporation']
    });
    expect(data.children?.length > 0, 'no children returned');
    return `${data.children.length} children`;
  });

  await check('POST /api/chat (SSE stream)', async () => {
    const response = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'map out how tides work' }] })
    });
    expect(response.ok, `HTTP ${response.status}`);

    const events = [];
    let map = null;
    const decoder = new TextDecoder();
    let buffer = '';
    let event = '';

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
          events.push(event);
        } else if (line.startsWith('data:') && event === 'map') {
          map = JSON.parse(line.slice(5).trim());
        }
      }
    }

    expect(events.includes('reply'), 'no reply event');
    expect(events.includes('done'), 'stream never completed');
    expect(map?.root?.children?.length > 0, 'no map delivered');
    return `${events.length} events, ${map.root.children.length} branches`;
  });

  /* ------------------------------ agent ------------------------------ */

  await check('POST /api/agent/plan', async () => {
    const data = await post('/api/agent/plan', {
      task: 'search for running shoes',
      pageContext: {
        title: 'ShopCo',
        url: 'https://example.com',
        headings: ['Welcome to ShopCo'],
        controls: [
          { ref: 'r0', tag: 'input', type: 'search', label: 'Search products' },
          { ref: 'r1', tag: 'button', type: 'submit', label: 'Search' },
          { ref: 'r2', tag: 'a', label: 'Cart' }
        ],
        text: 'Welcome to ShopCo. Find anything.'
      }
    });
    expect(data.steps?.length > 0, 'no steps planned');
    expect(
      data.steps.every((s) => !s.targetRef || ['r0', 'r1', 'r2'].includes(s.targetRef)),
      'agent invented a control ref that was never offered'
    );
    expect(
      typeof data.steps[0].requiresConfirmation === 'boolean',
      'safety flag missing from steps'
    );
    return `${data.steps.length} steps, ${data.steps.filter((s) => s.requiresConfirmation).length} gated`;
  });

  await check('agent refuses impossible goals instead of faking them', async () => {
    const data = await post('/api/agent/plan', {
      task: 'transfer $5000 to my landlord',
      pageContext: {
        title: 'Recipe Blog — Banana Bread',
        url: 'https://example.com/banana',
        headings: ['Banana Bread'],
        controls: [{ ref: 'r0', tag: 'a', label: 'Print recipe' }],
        text: 'Mash three bananas.'
      }
    });

    // The L0 planner is a keyword heuristic and cannot judge feasibility, so
    // this assertion only means something when a model actually answered.
    if (data.fallback) return `skipped — engine fell back (${data.fallbackReason?.slice(0, 60)})`;

    expect(
      data.feasible === false || data.steps.length === 0,
      'claimed a banking task was possible on a recipe page'
    );
    return 'declined correctly';
  });

  await check('irreversible actions are gated', async () => {
    const data = await post('/api/agent/plan', {
      task: 'submit this contact form',
      pageContext: {
        title: 'Contact',
        url: 'https://example.com/contact',
        headings: ['Contact us'],
        controls: [
          { ref: 'r0', tag: 'input', type: 'text', label: 'Your name' },
          { ref: 'r1', tag: 'button', type: 'submit', label: 'Send message' }
        ],
        text: 'Get in touch.'
      }
    });
    const sendStep = data.steps.find((s) => /send|submit/i.test(`${s.targetText} ${s.instruction}`));
    expect(sendStep, 'no send step planned');
    expect(sendStep.requiresConfirmation, 'send step was NOT gated behind confirmation');
    return 'gated';
  });

  await check('POST /api/agent/chunk', async () => {
    const data = await post('/api/agent/chunk', {
      pageContext: {
        title: 'Tax Return Portal',
        url: 'https://example.gov/file',
        headings: ['Income', 'Deductions', 'Declaration'],
        controls: [
          { ref: 'r0', tag: 'input', type: 'text', label: 'Total income' },
          { ref: 'r1', tag: 'input', type: 'text', label: 'National insurance number' }
        ],
        text: 'Complete all sections before submitting your annual return.'
      }
    });
    expect(data.steps?.length === 3, `expected exactly 3 steps, got ${data.steps?.length}`);
    return `${data.estimatedMinutes} min estimate`;
  });

  await check('POST /api/agent/explain', async () => {
    const data = await post('/api/agent/explain', {
      text: 'Force majeure clauses excuse contractual non-performance upon unforeseeable events.',
      language: 'English'
    });
    expect(data.explanation?.length > 30, 'explanation too short');
    return `${data.explanation.length} chars`;
  });

  /* ---------------------------- utilities ---------------------------- */

  await check('POST /api/summarize', async () => {
    const data = await post('/api/summarize', { text: ARTICLE });
    expect(data.points?.length >= 3, 'too few points');
    return `${data.points.length} points`;
  });

  await check('POST /api/export', async () => {
    const data = await post('/api/export', {
      mode: 'start',
      data: { clarifyingQuestion: 'q', immediateTenMinuteAction: 'a', microSteps: ['s1'] }
    });
    expect(data.markdown?.includes('#'), 'no markdown produced');
    return data.filename;
  }, { usesAI: false });

  /* ------------------------- error handling ------------------------- */

  await check('rejects empty input with 400', async () => {
    const response = await fetch(`${BASE}/api/research/mindmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: '' })
    });
    expect(response.status === 400, `expected 400, got ${response.status}`);
    return '400';
  }, { usesAI: false });

  await check('unknown route returns 404 JSON', async () => {
    const response = await fetch(`${BASE}/api/nope`, { method: 'POST' });
    expect(response.status === 404, `expected 404, got ${response.status}`);
    const data = await response.json();
    expect(data.error, 'no error message');
    return '404';
  }, { usesAI: false });

  console.log(`\n${failed === 0 ? green('ALL PASSED') : red(`${failed} FAILED`)} — ${passed}/${passed + failed}\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
