import {
  buildSystem,
  chooseTier,
  defaultContext,
  deterministicFallback,
  domainOf,
  isSetuError,
  newLedgerEntry,
  redactPII,
  rehydrate,
  toSetuError,
  type DNAProfile,
  type Mode,
  type Result,
  type TTransformArtifact,
} from '@setu/core';
import { callCommander, callTransform } from '../lib/api';
import { nanoAvailable, nanoPrompt } from '../lib/nano';
import {
  activeTab,
  notifyPanel,
  type ExtensionState,
  type ToBackground,
  type TransformRequest,
} from '../lib/messages';
import {
  appendLedger,
  clearLedger,
  getAlwaysAllow,
  getApiBase,
  getDNA,
  getDemoMode,
  getLedger,
  getToken,
  isOnboarded,
  setDNA,
  setDemoMode,
  setOnboarded,
  setPendingJob,
} from '../lib/storage';

/**
 * SETU LENS — service worker.
 *
 * This file is the extension's implementation of §11.1, the one-door rule.
 * Every AI request from every part of the extension converges here, where the
 * tier is chosen, the ledger is written, and consent is checked. Not because
 * it is elegant — because one door is the difference between a system you can
 * reason about and a system that surprises you on stage.
 */

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  /* older Chrome — the action still opens the panel via the click handler */
});

/* ── lifecycle ────────────────────────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'setu-explain',
      title: 'Explain this with SETU',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'setu-image',
      title: 'Describe this image with SETU',
      contexts: ['image'],
    });
    chrome.contextMenus.create({
      id: 'setu-rewrite',
      title: 'Rewrite this with SETU',
      contexts: ['editable', 'selection'],
    });
    chrome.contextMenus.create({
      id: 'setu-start',
      title: 'I am stuck — break this into steps',
      contexts: ['selection'],
    });
  });

  // First run: the DNA profile takes under 60 seconds and everything downstream
  // depends on it (§9.1). Open it once, never nag again.
  if (details.reason === 'install' && !(await isOnboarded())) {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html?onboarding=1') });
  }
});

/* ── content-script injection ─────────────────────────────────────────────────
   There is deliberately NO static `content_scripts` block in the manifest.
   A statically declared <all_urls> entry triggers Chrome's "read and change all
   your data on all websites" install warning, which directly undercuts the
   privacy story SETU is telling. Instead we inject on demand via activeTab
   when the user explicitly asks, and register persistently only for origins
   the user has granted.
   ─────────────────────────────────────────────────────────────────────────── */

async function ensureContent(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true; // already there
  } catch {
    /* not injected yet */
  }

  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return true;
  } catch (e) {
    // chrome:// pages, the Web Store, and PDF viewers are off-limits by design.
    console.warn('[SETU] cannot inject here:', e);
    return false;
  }
}

/** Persistent registration for an origin the user has explicitly granted. */
async function registerForOrigin(originPattern: string): Promise<void> {
  const id = `setu-${btoa(originPattern).replace(/[^a-zA-Z0-9]/g, '')}`;
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] }).catch(() => []);
  if (existing.length) return;

  await chrome.scripting.registerContentScripts([
    {
      id,
      matches: [originPattern],
      js: ['content.js'],
      css: ['content.css'],
      runAt: 'document_idle',
      persistAcrossSessions: true,
    },
  ]);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) await ensureContent(tab.id);
  if (tab.id) await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});

/* ── commands ─────────────────────────────────────────────────────────────── */

chrome.commands.onCommand.addListener(async (cmd) => {
  const tab = await activeTab();

  if (cmd === 'demo-mode') {
    const on = !(await getDemoMode());
    await setDemoMode(on);
    notifyPanel({ type: 'DEMO_MODE', on });
    await chrome.action.setBadgeText({ text: on ? 'DEMO' : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#A8600B' });
    return;
  }

  if (!tab?.id) return;
  if (!(await ensureContent(tab.id))) return;

  switch (cmd) {
    case 'toggle-focus':
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_FOCUS' });
      break;
    case 'panic':
      await chrome.tabs.sendMessage(tab.id, { type: 'PANIC' });
      break;
    case 'commander':
      await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      await chrome.tabs.sendMessage(tab.id, { type: 'VOICE_START' });
      break;
  }
});

/* ── context menus ────────────────────────────────────────────────────────── */

const MENU_MODE: Record<string, Mode> = {
  'setu-explain': 'EXPLAIN',
  'setu-image': 'EXPLAIN',
  'setu-rewrite': 'WRITE',
  'setu-start': 'START',
};

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const mode = MENU_MODE[String(info.menuItemId)];
  if (!mode) return;

  const payload = {
    text: info.selectionText ?? '',
    imageUrl: info.srcUrl,
    url: info.pageUrl,
    title: tab.title,
  };

  // Park the job first: the panel takes a moment to mount and would otherwise
  // miss a message sent immediately after open().
  await setPendingJob({ mode, payload, at: Date.now() });
  await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  notifyPanel({ type: 'RUN_MODE', mode, payload });
});

/* ── the one door ─────────────────────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((msg: ToBackground, _sender, respond) => {
  handle(msg)
    .then(respond)
    .catch((e) => respond({ ok: false, error: toSetuError(e) }));
  return true; // keep the channel open for the async reply
});

async function handle(msg: ToBackground): Promise<unknown> {
  switch (msg.type) {
    case 'TRANSFORM':
      return runTransform(msg.req);

    case 'COMMAND': {
      const dna = await getDNA();
      const result = await callCommander(msg.utterance, msg.dom, dna);
      await writeLedger({
        mode: 'COMMANDER',
        tier: result.ok ? (result.meta?.tier ?? 'L2') : 'L2',
        leftDevice: result.meta?.leftDevice ?? true,
        bytesSent: result.meta?.bytesSent ?? msg.utterance.length,
        redactions: 0,
        purpose: 'plan browser actions',
        url: msg.dom.url,
      });
      return result;
    }

    case 'CLS_REPORT': {
      await chrome.storage.session
        ?.set({ 'setu.lastCLS': { cls: msg.cls, url: msg.url } })
        .catch(() => {});
      await setBadge(msg.cls.score);
      notifyPanel({ type: 'CLS_UPDATE', cls: msg.cls, url: msg.url });
      return { ok: true };
    }

    case 'CLS_DELTA': {
      await setBadge(msg.after);
      await writeLedger({
        mode: 'FOCUS',
        tier: 'L0',
        leftDevice: false,
        bytesSent: 0,
        redactions: 0,
        purpose: `focus mode: load ${msg.before} → ${msg.after}`,
        url: msg.url,
      });
      return { ok: true };
    }

    case 'BREATHE_FIRED':
      // Deliberately NOT logged with any page content, and never with a label
      // about the person. The ledger row says what SETU did, not what it thinks.
      await writeLedger({
        mode: 'FOCUS',
        tier: 'L0',
        leftDevice: false,
        bytesSent: 0,
        redactions: 0,
        purpose: 'offered a pause on a high-load page',
        url: msg.url,
      });
      return { ok: true };

    case 'BREATHE_OUTCOME': {
      if (msg.outcome === 'disabled') {
        const dna = await getDNA();
        await setDNA({ ...dna, breathe: { ...dna.breathe, enabled: false } });
      }
      return { ok: true };
    }

    case 'GET_STATE':
      return getState();

    case 'GET_DNA':
      return getDNA();

    case 'SET_DNA': {
      await setDNA(msg.dna);
      await setOnboarded(true);
      await broadcastDNA(msg.dna);
      return { ok: true };
    }

    case 'GET_LEDGER':
      return getLedger();

    case 'CLEAR_LEDGER':
      await clearLedger();
      return { ok: true };

    case 'SET_DEMO_MODE':
      await setDemoMode(msg.on);
      await chrome.action.setBadgeText({ text: msg.on ? 'DEMO' : '' });
      notifyPanel({ type: 'DEMO_MODE', on: msg.on });
      return { ok: true };

    case 'OPEN_PANEL': {
      const tab = await activeTab();
      if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      return { ok: true };
    }

    case 'REQUEST_SITE_ACCESS': {
      const granted = await chrome.permissions.request({ origins: [msg.origin] });
      if (granted) await registerForOrigin(msg.origin);
      return { granted };
    }
  }
}

/* ── the transform pipeline ───────────────────────────────────────────────── */

async function runTransform(req: TransformRequest): Promise<Result<TTransformArtifact>> {
  const dna = await getDNA();
  const ctx = defaultContext('lens');
  const always = await getAlwaysAllow();
  const consentGranted = req.consent === true || always.includes(req.mode) || dna.privacy.cloudAI === 'allow';

  // Stage 3 — ROUTE. Pick the cheapest rung that can satisfy the contract.
  let tier: { tier: 'L0' | 'L1' | 'L2' | 'L3'; reason: string };
  try {
    tier = chooseTier({
      mode: req.mode,
      dna,
      ex: req.extracted
        ? ({ wordCount: req.extracted.wordCount } as never)
        : undefined,
      nanoAvailable: await nanoAvailable(),
      online: navigator.onLine,
      consentGranted,
      hasImage: !!req.imageDataUrl,
    });
  } catch (e) {
    // A refused tier is a designed outcome, not a crash. Return the fallback
    // so the user still gets an artifact (Axiom 2) plus an honest reason.
    return {
      ok: false,
      error: isSetuError(e) ? e.toJSON?.() ?? toSetuError(e) : toSetuError(e),
      fallback: deterministicFallback(req.mode, req.input),
    };
  }

  const started = Date.now();

  /* L1 — stays on device. Nothing to redact, because nothing is transmitted. */
  if (tier.tier === 'L1') {
    const system = buildSystem(req.mode, dna, { ...ctx, tier: 'L1' });
    const nano = await nanoPrompt({ mode: req.mode, input: req.input, system });

    if (nano.ok) {
      await writeLedger({
        mode: req.mode,
        tier: 'L1',
        leftDevice: false,
        bytesSent: 0,
        redactions: 0,
        purpose: `${req.mode} on this device`,
        url: req.url,
      });
      return {
        ok: true,
        data: nano.data as TTransformArtifact,
        meta: {
          tier: 'L1',
          model: 'gemini-nano',
          latencyMs: nano.latencyMs,
          cached: false,
          leftDevice: false,
        },
      };
    }
    // Fall through to L2. The degradation ladder never dead-ends (§17).
    if (!navigator.onLine || dna.privacy.cloudAI === 'never') {
      return {
        ok: false,
        error: {
          code: 'ON_DEVICE_UNAVAILABLE',
          message: nano.error ?? 'The on-device model could not answer.',
          nextAction: 'Focus Mode and saved items still work offline.',
        },
        fallback: deterministicFallback(req.mode, req.input),
      };
    }
  }

  /* L2/L3 — cloud, through our edge only.
     Redact BEFORE anything leaves this process, and count the redactions so
     the Trust Ledger can show them. The edge redacts again (defence in depth),
     but doing it here means the extension itself never transmits the raw text. */
  const { text: safe, spans } = redactPII(req.input);

  const result = await callTransform({ ...req, input: safe, consent: consentGranted }, dna);

  if (result.ok) {
    // Put the real values back locally. The model never saw them.
    result.data = rehydrate(result.data, spans);
  }

  await writeLedger({
    mode: req.mode,
    tier: result.meta?.tier ?? tier.tier,
    leftDevice: result.meta?.leftDevice ?? true,
    bytesSent: safe.length,
    redactions: spans.length,
    purpose: `${req.mode} transform`,
    url: req.url,
  });

  if (!result.ok) {
    return { ...result, fallback: deterministicFallback(req.mode, req.input) };
  }

  return {
    ...result,
    meta: { ...result.meta, latencyMs: result.meta?.latencyMs || Date.now() - started },
  };
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

async function writeLedger(e: {
  mode: Mode;
  tier: 'L0' | 'L1' | 'L2' | 'L3';
  leftDevice: boolean;
  bytesSent: number;
  redactions: number;
  purpose: string;
  url?: string;
}): Promise<void> {
  await appendLedger(
    newLedgerEntry({
      surface: 'lens',
      mode: e.mode,
      tier: e.tier,
      provider: e.leftDevice ? 'google' : 'none',
      bytesSent: e.bytesSent,
      redactions: e.redactions,
      purpose: e.purpose,
      leftDevice: e.leftDevice,
      domain: domainOf(e.url),
    }),
  );
  notifyPanel({ type: 'LEDGER_UPDATE' });
}

/**
 * The CLS badge. This is the number you point at on stage — 84 before, 19
 * after — so it must be legible and it must update instantly.
 */
async function setBadge(score: number): Promise<void> {
  if (await getDemoMode()) return; // demo badge takes precedence
  const colour = score >= 70 ? '#A8600B' : score >= 40 ? '#4E535C' : '#2E7D6B';
  await chrome.action.setBadgeText({ text: String(score) });
  await chrome.action.setBadgeBackgroundColor({ color: colour });
  await chrome.action.setTitle({ title: `SETU — this page scores ${score}/100 for cognitive load` });
}

async function broadcastDNA(dna: DNAProfile): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (!t.id) continue;
    chrome.tabs.sendMessage(t.id, { type: 'APPLY_DNA', dna }).catch(() => {
      /* no content script on that tab — expected and fine */
    });
  }
}

async function getState(): Promise<ExtensionState> {
  const session = await chrome.storage.session?.get('setu.lastCLS').catch(() => ({}));
  return {
    dna: await getDNA(),
    demoMode: await getDemoMode(),
    apiBase: await getApiBase(),
    signedIn: !!(await getToken()),
    nanoAvailable: await nanoAvailable(),
    online: navigator.onLine,
    lastCLS: (session as Record<string, ExtensionState['lastCLS']>)?.['setu.lastCLS'],
    ledger: await getLedger(),
  };
}

/* ── auth handoff from Sanctuary (§38) ────────────────────────────────────── */

chrome.runtime.onMessageExternal?.addListener(async (msg, sender, respond) => {
  // Only the configured edge origin may hand us a session token.
  const base = await getApiBase();
  if (!sender.origin || !base.startsWith(sender.origin)) {
    respond({ ok: false });
    return;
  }
  if (typeof msg?.token === 'string') {
    await chrome.storage.session?.set({ 'setu.token': msg.token });
    respond({ ok: true });
    return;
  }
  respond({ ok: false });
});
