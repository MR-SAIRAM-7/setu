// NeuroRead Main Content Script
// Orchestrates all reading assistance features

class NeuroRead {
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
      sanctuary: null
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
      theme: 'default'
    };
    this.isInitialized = false;
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    
    console.log('🧠 NeuroRead initializing...');
    
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

    // Load saved state
    await this.loadState();
    
    // Setup message listener
    this.setupMessageListener();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Inject NeuroRead container
    this.injectContainer();
    
    this.isInitialized = true;
    console.log('✅ NeuroRead initialized successfully');
  }

  async loadState() {
    try {
      const result = await chrome.storage.sync.get('neuroreadState');
      if (result.neuroreadState) {
        this.state = { ...this.state, ...result.neuroreadState };
        
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
          this.features.sanctuary.save()
            .then((documentArtifact) => sendResponse({ success: true, id: documentArtifact.id }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
          return true;
          
        case 'resetAll':
          this.resetAll();
          sendResponse({ success: true });
          break;
          
        case 'getState':
          sendResponse({ state: this.state });
          break;
      }
      
      return true;
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt + B: Toggle Bionic Reading
      if (e.altKey && e.key === 'b') {
        e.preventDefault();
        this.toggleMode('bionic');
      }
      // Alt + F: Toggle Focus Mode
      if (e.altKey && e.key === 'f') {
        e.preventDefault();
        this.toggleMode('focus');
      }
      // Alt + S: Toggle Auto Scroll
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        this.toggleMode('scroll');
      }
      // Alt + T: Toggle Text to Speech
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        this.toggleFeature('tts');
      }
      // Alt + E: Toggle Eye Tracking
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        this.toggleMode('eye');
      }
      // Escape: Reset all
      if (e.key === 'Escape' && e.shiftKey) {
        e.preventDefault();
        this.resetAll();
      }
    });
  }

  injectContainer() {
    // Create floating indicator
    const indicator = document.createElement('div');
    indicator.id = 'neuroread-indicator';
    indicator.innerHTML = `
      <div class="neuroread-indicator-content">
        <span class="neuroread-logo">🧠</span>
        <span class="neuroread-status">NeuroRead Active</span>
      </div>
    `;
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      padding: 10px 16px;
      border-radius: 50px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 600;
      z-index: 999999;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
      cursor: pointer;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
      pointer-events: none;
    `;
    
    document.body.appendChild(indicator);
    
    // Show indicator when features are active
    this.updateIndicator();
  }

  updateIndicator() {
    const indicator = document.getElementById('neuroread-indicator');
    if (!indicator) return;
    
    const activeFeatures = Object.keys(this.state).filter(key => this.state[key]);
    
    if (activeFeatures.length > 0) {
      indicator.style.opacity = '1';
      indicator.style.transform = 'translateY(0)';
      indicator.querySelector('.neuroread-status').textContent = 
        `${activeFeatures.length} mode${activeFeatures.length > 1 ? 's' : ''} active`;
    } else {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(20px)';
    }
  }

  toggleMode(mode, enabled = null) {
    if (!this.features[mode]) return;
    
    const newState = enabled !== null ? enabled : !this.state[mode];
    this.state[mode] = newState;
    
    if (newState) {
      this.features[mode].enable();
    } else {
      this.features[mode].disable();
    }
    
    this.saveState();
    this.updateIndicator();
    
    // Show toast notification
    this.showToast(`${mode.charAt(0).toUpperCase() + mode.slice(1)} ${newState ? 'enabled' : 'disabled'}`);
  }

  toggleFeature(feature, enabled = null) {
    if (!this.features[feature]) return;
    
    const newState = enabled !== null ? enabled : !this.state[feature];
    this.state[feature] = newState;
    
    if (newState) {
      this.features[feature].enable();
    } else {
      this.features[feature].disable();
    }
    
    this.saveState();
    this.updateIndicator();
  }

  setTheme(theme) {
    this.state.theme = theme;
    this.features.dyslexia.setTheme(theme);
    this.saveState();
  }

  async saveState() {
    try {
      await chrome.storage.sync.set({ neuroreadState: this.state });
    } catch (error) {
      console.log('Could not save state');
    }
  }

  resetAll() {
    ['bionic', 'focus', 'eye', 'scroll', 'tts', 'highlight', 'dyslexia', 'breathe', 'chunking'].forEach(key => {
      if (this.state[key] && this.features[key]) {
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
    this.updateIndicator();
    this.showToast('All modes reset');
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'neuroread-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e293b;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999999;
      animation: neuroread-toast-in 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'neuroread-toast-out 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  async summarizePage() {
    // This will be handled by the popup
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
  @keyframes neuroread-toast-in {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes neuroread-toast-out {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(20px); }
  }
`;
document.head.appendChild(style);

// Initialize NeuroRead when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.neuroread = new NeuroRead();
  });
} else {
  window.neuroread = new NeuroRead();
}
