// SETU Lens Background Service Worker
// Handles extension lifecycle, context menu, and cross-tab communication

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('setu installed - Welcome!');
    
    // Initialize default settings
    chrome.storage.sync.set({
      setuState: {
        bionic: false,
        focus: false,
        eye: false,
        scroll: false,
        tts: false,
        highlight: false,
        dyslexia: false,
        breathe: false,
        chunking: false,
        theme: 'default'
      },
      settings: {
        bionicIntensity: 0.5,
        scrollSpeed: 100,
        fontSize: 16,
        lineHeight: 1.6,
        letterSpacing: 0.5,
        highlightColor: '#6366f1',
        ttsRate: 1.0,
        ttsVoice: 'default'
      }
    });

  }
});

// Context menu for quick actions
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'setu-parent',
      title: 'NeuroRead',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'toggle-bionic',
      parentId: 'setu-parent',
      title: 'Toggle Bionic Reading',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'toggle-focus',
      parentId: 'setu-parent',
      title: 'Toggle Focus Mode',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'toggle-linefocus',
      parentId: 'setu-parent',
      title: 'Toggle Line Focus',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'toggle-tts',
      parentId: 'setu-parent',
      title: 'Read Selected Text',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'summarize-page',
      parentId: 'setu-parent',
      title: 'Save to NeuroRead Sanctuary',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'open-commander',
      parentId: 'setu-parent',
      title: 'Open NeuroRead Commander',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'task-path',
      parentId: 'setu-parent',
      title: 'Create a task path',
      contexts: ['all']
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  const sendMessageSafely = (msg, callback) => {
    chrome.tabs.sendMessage(tab.id, msg, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.debug('[NeuroRead Background] Context menu message suppressed:', err.message);
        return;
      }
      if (callback) callback(response);
    });
  };

  switch (info.menuItemId) {
    case 'toggle-bionic':
      sendMessageSafely({ action: 'toggleMode', mode: 'bionic' });
      break;
    case 'toggle-focus':
      sendMessageSafely({ action: 'toggleMode', mode: 'focus' });
      break;
    case 'toggle-linefocus':
      sendMessageSafely({ action: 'toggleMode', mode: 'lineFocus' });
      break;
    case 'toggle-tts':
      sendMessageSafely({ 
        action: 'speakText', 
        text: info.selectionText 
      });
      break;
    case 'summarize-page':
      sendMessageSafely({ action: 'saveToSanctuary' }, (response) => {
        if (response?.success) chrome.tabs.create({ url: chrome.runtime.getURL('sanctuary.html') });
      });
      break;
    case 'open-commander':
      sendMessageSafely({ action: 'openCommander' });
      break;
    case 'task-path':
      sendMessageSafely({ action: 'toggleMode', mode: 'chunking', enabled: true });
      break;
  }
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getState':
      chrome.storage.sync.get('setuState').then(result => {
        sendResponse(result.setuState);
      });
      return true;

    case 'updateStats':
      updateReadingStats(request.stats);
      break;

    case 'captureTab':
      if (sender.tab?.windowId !== undefined) {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
          .then(dataUrl => sendResponse({ success: true, dataUrl }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      }
      sendResponse({ success: false, error: 'No tab window available' });
      break;

    case 'openSettings':
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
      break;

    case 'openSanctuary':
      chrome.tabs.create({ url: chrome.runtime.getURL('sanctuary.html') });
      break;
  }
});

// Update reading statistics
async function updateReadingStats(newStats) {
  const result = await chrome.storage.local.get(['readingStats']);
  const currentStats = result.readingStats || {
    wpm: 0,
    time: 0,
    words: 0,
    sessions: 0
  };

  const updatedStats = {
    wpm: Math.round((currentStats.wpm * currentStats.sessions + newStats.wpm) / (currentStats.sessions + 1)),
    time: currentStats.time + newStats.time,
    words: currentStats.words + newStats.words,
    sessions: currentStats.sessions + 1,
    lastSession: new Date().toISOString()
  };

  await chrome.storage.local.set({ readingStats: updatedStats });
}

// Track active reading sessions
const readingSessions = new Map();

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url && !tab.url.startsWith('chrome://')) {
      readingSessions.set(tabId, {
        startTime: Date.now(),
        url: tab.url
      });
    }
  } catch (_) {}
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (readingSessions.has(tabId)) {
    const session = readingSessions.get(tabId);
    const duration = Math.round((Date.now() - session.startTime) / 60000);
    
    updateReadingStats({
      wpm: 200,
      time: duration,
      words: duration * 200
    });
    
    readingSessions.delete(tabId);
  }
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  let targetTabId = tab?.id;
  if (!targetTabId) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTabId = activeTab?.id;
  }
  if (!targetTabId) return;

  const sendMessageSafely = (msg) => {
    chrome.tabs.sendMessage(targetTabId, msg).catch((err) => {
      console.debug('[NeuroRead Background] Could not send command message to tab:', err.message);
    });
  };

  switch (command) {
    case 'toggle-bionic':
      sendMessageSafely({ action: 'toggleMode', mode: 'bionic' });
      break;
    case 'toggle-focus':
      sendMessageSafely({ action: 'toggleMode', mode: 'focus' });
      break;
    case 'toggle-linefocus':
      sendMessageSafely({ action: 'toggleMode', mode: 'lineFocus' });
      break;
    case 'toggle-tts':
      sendMessageSafely({ action: 'toggleFeature', feature: 'tts' });
      break;
    case 'toggle-scroll':
      sendMessageSafely({ action: 'toggleMode', mode: 'scroll' });
      break;
    case 'open-commander':
      sendMessageSafely({ action: 'openCommander' });
      break;
  }
});

console.log('SETU Lens background service worker initialized');

