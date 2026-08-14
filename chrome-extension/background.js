/**
 * SETU Lens — service worker.
 *
 * Owns everything a content script cannot safely do itself:
 *  - Network calls to the SETU engine. Content scripts inherit the page's
 *    origin and CSP, so a direct fetch to localhost is blocked outright on many
 *    sites. Routing through here is what makes the AI features work everywhere.
 *  - Tab capture for the visual breakdown.
 *  - Injecting the content scripts into tabs that were already open when the
 *    extension was installed or reloaded.
 */

const DEFAULT_API = 'http://localhost:3000';
const SANCTUARY_URL = 'http://localhost:5173';

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      setuState: {
        bionic: false, focus: false, lineFocus: false, highlight: false,
        scroll: false, tts: false, eye: false, dyslexia: false,
        breathe: true, chunking: false, theme: 'default',
        settings: {
          bionicIntensity: 0.45, lineFocusHeight: 1, highlightColor: '#7c8cff',
          scrollWpm: 220, ttsRate: 1, ttsPitch: 1, ttsVoice: '',
          fontScale: 1, language: 'English'
        }
      },
      apiHost: DEFAULT_API,
      sanctuaryUrl: SANCTUARY_URL
    });
  }

  buildMenus();
  // Content scripts are not retroactive — inject into already-open tabs.
  reinjectOpenTabs();
});

chrome.runtime.onStartup.addListener(buildMenus);

/**
 * On install/update, existing tabs have no content script until reloaded.
 * Injecting manually means the extension works immediately.
 */
async function reinjectOpenTabs() {
  const manifest = chrome.runtime.getManifest();
  const { js } = manifest.content_scripts[0];

  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: false }, files: js });
    } catch (_) {
      // Restricted pages (Web Store, other extensions) reject injection.
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Context menus                                                              */
/* -------------------------------------------------------------------------- */

function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    const add = (id, title, contexts = ['all'], parentId = 'setu') =>
      chrome.contextMenus.create({ id, title, contexts, parentId });

    chrome.contextMenus.create({ id: 'setu', title: 'SETU Lens', contexts: ['all'] });

    add('cmd-commander', 'Ask SETU to do something…');
    add('cmd-explain-selection', 'Explain this in plain language', ['selection']);
    add('cmd-speak', 'Read this aloud', ['selection']);
    add('cmd-visual', 'Explain this chart or image');
    add('cmd-chunk', 'Break this page into 3 steps');
    add('cmd-sanctuary', 'Send page to my Sanctuary');
    chrome.contextMenus.create({ id: 'sep', type: 'separator', parentId: 'setu', contexts: ['all'] });
    add('cmd-bionic', 'Toggle Bionic Reading');
    add('cmd-focus', 'Toggle Focus Mode');
    add('cmd-linefocus', 'Toggle Line Focus');
    add('cmd-reset', 'Turn everything off');
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  const routes = {
    'cmd-commander': { action: 'openCommander' },
    'cmd-speak': { action: 'speakText', text: info.selectionText },
    'cmd-visual': { action: 'explainVisual' },
    'cmd-chunk': { action: 'toggleFeature', feature: 'chunking', enabled: true },
    'cmd-sanctuary': { action: 'sendToSanctuary' },
    'cmd-bionic': { action: 'toggleFeature', feature: 'bionic' },
    'cmd-focus': { action: 'toggleFeature', feature: 'focus' },
    'cmd-linefocus': { action: 'toggleFeature', feature: 'lineFocus' },
    'cmd-reset': { action: 'resetAll' }
  };

  if (info.menuItemId === 'cmd-explain-selection') {
    await send(tab.id, { action: 'openCommander', task: `Explain this in plain language: "${info.selectionText}"` });
    return;
  }

  const message = routes[info.menuItemId];
  if (message) await send(tab.id, message);
});

/* -------------------------------------------------------------------------- */
/* Keyboard commands                                                          */
/* -------------------------------------------------------------------------- */

chrome.commands.onCommand.addListener(async (command, tab) => {
  const tabId = tab?.id || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (!tabId) return;

  const routes = {
    'toggle-bionic': { action: 'toggleFeature', feature: 'bionic' },
    'toggle-focus': { action: 'toggleFeature', feature: 'focus' },
    'toggle-linefocus': { action: 'toggleFeature', feature: 'lineFocus' },
    'toggle-tts': { action: 'toggleFeature', feature: 'tts' },
    'open-commander': { action: 'openCommander' }
  };

  if (routes[command]) await send(tabId, routes[command]);
});

/** Send a message to a tab, injecting the content script if it isn't there. */
async function send(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_) {
    try {
      const { js } = chrome.runtime.getManifest().content_scripts[0];
      await chrome.scripting.executeScript({ target: { tabId }, files: js });
      // Give the boot sequence a moment before retrying.
      await new Promise((resolve) => setTimeout(resolve, 260));
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.debug('[SETU] tab unreachable:', error.message);
      return null;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Message hub                                                                */
/* -------------------------------------------------------------------------- */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'apiFetch':
          return sendResponse(await apiFetch(request));

        case 'captureTab': {
          const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
          const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
          return sendResponse({ success: true, dataUrl });
        }

        case 'sendToSanctuary':
          return sendResponse(await stashForSanctuary(request.payload));

        case 'openSanctuary': {
          const { sanctuaryUrl } = await chrome.storage.sync.get('sanctuaryUrl');
          await chrome.tabs.create({ url: request.path
            ? `${sanctuaryUrl || SANCTUARY_URL}${request.path}`
            : (sanctuaryUrl || SANCTUARY_URL) });
          return sendResponse({ ok: true });
        }

        default:
          return sendResponse({ ok: false, error: `Unknown action "${request.action}"` });
      }
    } catch (error) {
      console.error('[SETU worker]', error);
      sendResponse({ ok: false, success: false, error: error.message });
    }
  })();

  return true;
});

/**
 * Proxy a JSON POST to the SETU engine.
 * Runs here rather than in the page so the request carries the extension's
 * origin and is not subject to the host page's Content-Security-Policy.
 */
async function apiFetch({ path, body, timeoutMs = 60000 }) {
  const { apiHost } = await chrome.storage.sync.get('apiHost');
  const base = (apiHost || DEFAULT_API).replace(/\/+$/, '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      let message = `Engine returned ${response.status}`;
      try {
        message = JSON.parse(detail).error || message;
      } catch (_) {
        /* keep the status line */
      }
      return { ok: false, error: message };
    }

    return { ok: true, data: await response.json() };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { ok: false, error: 'The SETU engine took too long to respond.' };
    }
    return {
      ok: false,
      error: `Cannot reach the SETU engine at ${base}. Is it running? (npm start in /backend)`
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Park captured page content where the Sanctuary can pick it up, then open it. */
async function stashForSanctuary(payload) {
  const { sanctuaryUrl } = await chrome.storage.sync.get('sanctuaryUrl');
  const base = sanctuaryUrl || SANCTUARY_URL;

  const { sanctuaryInbox = [] } = await chrome.storage.local.get('sanctuaryInbox');
  const inbox = [{ id: `cap_${Date.now()}`, ...payload }, ...sanctuaryInbox].slice(0, 25);
  await chrome.storage.local.set({ sanctuaryInbox: inbox });

  // The web app reads the handoff from the URL fragment, which never reaches
  // a server or appears in history the way a query string does.
  const handoff = encodeURIComponent(
    JSON.stringify({ title: payload.title, url: payload.url, text: payload.text.slice(0, 100000) })
  );

  await chrome.tabs.create({ url: `${base}/#/mindmap?import=${handoff}` });
  return { ok: true };
}

console.log('[SETU Lens] service worker ready');
