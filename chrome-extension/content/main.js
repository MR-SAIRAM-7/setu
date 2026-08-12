// SETU Main Content Script
// Orchestrates all reading and cognitive assistance features

class Setu {
  constructor() {
    this.features = {
      bionic: null,
      focus: null,
      eye: null,
      scroll: null,
      tts: null,
      highlight: null,
      dyslexia: null,
      breathe: null,
      chunking: null,
      commander: null,
      visual: null,
      sanctuary: null,
      lineFocus: null
    };
    this.state = {
      bionic: false,
      focus: false,
      eye: false,
      scroll: false,
      tts: false,
      highlight: false,
      dyslexia: false,
      breathe: false,
      chunking: false,
      lineFocus: false,
      theme: 'default'
    };
    this.isInitialized = false;
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    
    console.log('[NeuroRead] Initializing...');
    
    // Initialize feature modules
    this.features.bionic = new BionicReading();
    this.features.focus = new FocusMode();
    this.features.eye = new EyeTracker();
    this.features.scroll = new AutoScroll();
    this.features.tts = new TextToSpeech();
    this.features.highlight = new WordHighlight();
    this.features.dyslexia = new DyslexiaTheme();
    this.features.breathe = new BreatheProtocol();
    this.features.chunking = new TaskChunker();
    this.features.commander = new SetuCommander();
    this.features.visual = new VisualBreakdown();
    this.features.sanctuary = new SanctuaryBridge();
    this.features.lineFocus = new LineFocus();

    // Load saved state
    await this.loadState();
    
    // Setup message listener
    this.setupMessageListener();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Inject SETU container
    this.injectContainer();
    
    this.isInitialized = true;
    console.log('[NeuroRead] Initialized successfully');
  }

  async loadState() {
    try {
      const result = await chrome.storage.sync.get(['setuState', 'setuState']);
      const stateData = result.setuState || result.setuState;
      if (stateData) {
        this.state = { ...this.state, ...stateData };
        
        // Apply saved states
        Object.keys(this.state).forEach(key => {
          if (this.state[key] && this.features[key]) {
            this.features[key].enable();
          }
        });
      }
    } catch (error) {
      console.log('Storage not available, using defaults');
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Message received:', request.action);
      
      switch (request.action) {
        case 'toggleMode':
          this.toggleMode(request.mode, request.enabled);
          sendResponse({ success: true });
          break;
          
        case 'toggleFeature':
          this.toggleFeature(request.feature, request.enabled);
          sendResponse({ success: true });
          break;

        case 'toggleSensoryMode':
          if (request.enabled) {
            document.documentElement.classList.add('nb-sensory-calm-page');
          } else {
            document.documentElement.classList.remove('nb-sensory-calm-page');
          }
          sendResponse({ success: true });
          break;
          
        case 'setTheme':
          this.setTheme(request.theme);
          sendResponse({ success: true });
          break;
          
        case 'speakText':
          this.features.tts.speak(request.text);
          sendResponse({ success: true });
          break;
          
        case 'summarizePage':
          this.summarizePage();
          sendResponse({ success: true });
          break;
          
        case 'requestCamera':
          this.features.eye.requestCameraPermission();
          sendResponse({ success: true });
          break;

        case 'openCommander':
          this.features.commander.open();
          sendResponse({ success: true });
          break;

        case 'explainVisual':
          this.features.visual.open();
          sendResponse({ success: true });
          break;

        case 'getPageContent': {
          const text = this.features.sanctuary.getPageText(10000);
          sendResponse({ text, localSummary: this.features.sanctuary.summarize(text) });
          break;
        }

        case 'saveToSanctuary':
          this.features.sanctuary.save().then((data) => sendResponse({ success: true, data })).catch((error) => sendResponse({ success: false, error: error.message }));
          return true;

        case 'activateSupportPath':
          this.activateSupportPath();
          sendResponse({ success: true });
          break;

        case 'resetAll':
          this.resetAll();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
      return true;
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            this.toggleMode('bionic', !this.state.bionic);
            break;
          case 'f':
            e.preventDefault();
            this.toggleMode('focus', !this.state.focus);
            break;
          case 's':
            e.preventDefault();
            this.toggleMode('scroll', !this.state.scroll);
            break;
          case 't':
            e.preventDefault();
            this.toggleFeature('tts', !this.state.tts);
            break;
          case 'l':
            e.preventDefault();
            this.toggleMode('lineFocus', !this.state.lineFocus);
            break;
        }
      }
    });
  }

  injectContainer() {
    if (document.getElementById('setu-container')) return;
    
    const container = document.createElement('div');
    container.id = 'setu-container';
    container.style.cssText = 'position: fixed; z-index: 2147483647; pointer-events: none;';
    document.body.appendChild(container);
  }

  toggleMode(mode, enabled) {
    if (this.features[mode]) {
      const targetState = (typeof enabled === 'boolean') ? enabled : !this.state[mode];
      this.state[mode] = targetState;
      if (targetState) {
        this.features[mode].enable();
      } else {
        this.features[mode].disable();
      }
      this.saveState();
      this.showToast(`${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode ${targetState ? 'enabled' : 'disabled'}`);
    }
  }

  toggleFeature(feature, enabled) {
    if (this.features[feature]) {
      const targetState = (typeof enabled === 'boolean') ? enabled : !this.state[feature];
      this.state[feature] = targetState;
      if (targetState) {
        this.features[feature].enable();
      } else {
        this.features[feature].disable();
      }
      this.saveState();
      this.showToast(`${feature.charAt(0).toUpperCase() + feature.slice(1)} ${targetState ? 'enabled' : 'disabled'}`);
    }
  }

  setTheme(theme) {
    this.state.theme = theme;
    if (this.features.dyslexia) {
      this.features.dyslexia.setTheme(theme);
    }
    this.saveState();
    this.showToast(`Theme changed to ${theme}`);
  }

  async saveState() {
    try {
      await chrome.storage.sync.set({ setuState: this.state, setuState: this.state });
    } catch (error) {
      console.log('Storage not available');
    }
  }

  resetAll() {
    Object.keys(this.features).forEach(key => {
      if (this.features[key] && typeof this.features[key].disable === 'function') {
        this.features[key].disable();
      }
    });

    this.state = {
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
    };

    this.saveState();
    this.showToast('All features reset');
  }

  showToast(message) {
    const existing = document.getElementById('setu-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'setu-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0f172a;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: setu-toast-in 0.3s ease;
    `;

    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'setu-toast-out 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  async summarizePage() {
    chrome.runtime.sendMessage({ action: 'openSettings' });
  }

  activateSupportPath() {
    this.toggleMode('focus', true);
    this.toggleFeature('highlight', true);
    this.showToast('The page is simplified and your reading line is highlighted.');
  }
}

// Add toast animations
const style = document.createElement('style');
style.textContent = `
  @keyframes setu-toast-in {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes setu-toast-out {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(20px); }
  }
`;
document.head.appendChild(style);

// Initialize SETU when DOM is ready
const initSetu = () => {
  const instance = new Setu();
  window.setu = instance;
  window.setu = instance; // backward compatibility
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSetu);
} else {
  initSetu();
}
