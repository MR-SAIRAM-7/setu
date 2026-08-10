// Focus Mode - Strip away distractions and show only the article content
// Creates a clean, readable environment for ADHD readers

class FocusMode {
  constructor() {
    this.isEnabled = false;
    this.originalStyles = new Map();
    this.focusOverlay = null;
    this.articleContent = null;
    this.scrollPosition = 0;
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    
    console.log('🎯 Focus Mode enabled');
    
    // Save scroll position
    this.scrollPosition = window.scrollY;
    
    // Find main content
    this.articleContent = this.findMainContent();
    
    if (this.articleContent) {
      this.createFocusOverlay();
      this.hideDistractions();
    } else {
      console.log('No main content found, using fallback');
      this.enableSimpleFocus();
    }
    
    document.body.classList.add('neuroread-focus-active');
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    
    console.log('🎯 Focus Mode disabled');
    
    // Remove focus overlay
    if (this.focusOverlay) {
      this.focusOverlay.remove();
      this.focusOverlay = null;
    }
    
    // Restore hidden elements
    this.restoreDistractions();
    
    // Remove body class
    document.body.classList.remove('neuroread-focus-active');
    
    // Restore scroll position
    window.scrollTo(0, this.scrollPosition);
  }

  findMainContent() {
    // Try to find the main article/content
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.article',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.post',
      '[itemprop="articleBody"]',
      '.story-body'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.length > 500) {
        return element;
      }
    }

    // Fallback: Find the element with the most text content
    const paragraphs = document.querySelectorAll('p');
    let bestElement = null;
    let maxTextLength = 0;

    paragraphs.forEach(p => {
      const parent = p.parentElement;
      if (parent) {
        const textLength = parent.textContent.length;
        if (textLength > maxTextLength && textLength > 1000) {
          maxTextLength = textLength;
          bestElement = parent;
        }
      }
    });

    return bestElement;
  }

  createFocusOverlay() {
    // Create the focus overlay container
    this.focusOverlay = document.createElement('div');
    this.focusOverlay.id = 'neuroread-focus-overlay';
    this.focusOverlay.innerHTML = `
      <div class="neuroread-focus-header">
        <button class="neuroread-focus-close" title="Close Focus Mode (Esc)">
          <span>✕</span>
        </button>
        <div class="neuroread-focus-controls">
          <button class="neuroread-focus-btn" data-action="decrease-font" title="Decrease Font Size">
            <span>A-</span>
          </button>
          <button class="neuroread-focus-btn" data-action="increase-font" title="Increase Font Size">
            <span>A+</span>
          </button>
          <button class="neuroread-focus-btn" data-action="toggle-theme" title="Toggle Theme">
            <span>🎨</span>
          </button>
          <button class="neuroread-focus-btn" data-action="tts" title="Read Aloud">
            <span>🔊</span>
          </button>
        </div>
      </div>
      <div class="neuroread-focus-content">
        ${this.articleContent.innerHTML}
      </div>
      <div class="neuroread-focus-progress">
        <div class="neuroread-progress-bar"></div>
      </div>
    `;

    document.body.appendChild(this.focusOverlay);

    // Setup controls
    this.setupFocusControls();
    
    // Setup progress tracking
    this.setupProgressTracking();
  }

  setupFocusControls() {
    // Close button
    this.focusOverlay.querySelector('.neuroread-focus-close').addEventListener('click', () => {
      this.disable();
    });

    // Font size controls
    let fontSize = 18;
    const content = this.focusOverlay.querySelector('.neuroread-focus-content');
    
    this.focusOverlay.querySelector('[data-action="decrease-font"]').addEventListener('click', () => {
      fontSize = Math.max(14, fontSize - 2);
      content.style.fontSize = `${fontSize}px`;
    });

    this.focusOverlay.querySelector('[data-action="increase-font"]').addEventListener('click', () => {
      fontSize = Math.min(32, fontSize + 2);
      content.style.fontSize = `${fontSize}px`;
    });

    // Theme toggle
    const themes = ['default', 'sepia', 'dark', 'high-contrast'];
    let currentThemeIndex = 0;
    
    this.focusOverlay.querySelector('[data-action="toggle-theme"]').addEventListener('click', () => {
      currentThemeIndex = (currentThemeIndex + 1) % themes.length;
      this.focusOverlay.setAttribute('data-theme', themes[currentThemeIndex]);
    });

    // TTS
    this.focusOverlay.querySelector('[data-action="tts"]').addEventListener('click', () => {
      if (window.neuroread && window.neuroread.features.tts) {
        window.neuroread.features.tts.speak(this.articleContent.textContent);
      }
    });

    // Keyboard shortcuts
    this.focusOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.disable();
      }
    });
  }

  setupProgressTracking() {
    const progressBar = this.focusOverlay.querySelector('.neuroread-progress-bar');
    const content = this.focusOverlay.querySelector('.neuroread-focus-content');

    const updateProgress = () => {
      const scrollTop = this.focusOverlay.scrollTop;
      const scrollHeight = content.scrollHeight - this.focusOverlay.clientHeight;
      const progress = (scrollTop / scrollHeight) * 100;
      progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    };

    this.focusOverlay.addEventListener('scroll', updateProgress);
    updateProgress();
  }

  hideDistractions() {
    // Elements to hide
    const hideSelectors = [
      'header:not(.neuroread-focus-header)',
      'nav',
      'aside',
      '.sidebar',
      '.advertisement',
      '.ad',
      '.popup',
      '.modal',
      '.newsletter',
      '.social-share',
      '.comments',
      '.related-posts',
      'footer',
      '.cookie-banner',
      '.notification',
      '[role="banner"]',
      '[role="complementary"]',
      '[role="navigation"]'
    ];

    hideSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!el.closest('#neuroread-focus-overlay') && !this.originalStyles.has(el)) {
          this.originalStyles.set(el, el.style.display);
          el.style.display = 'none';
        }
      });
    });

    // Hide body content except our overlay
    Array.from(document.body.children).forEach(child => {
      if (child !== this.focusOverlay && !child.id?.startsWith('neuroread')) {
        if (!this.originalStyles.has(child)) {
          this.originalStyles.set(child, child.style.display);
          child.style.display = 'none';
        }
      }
    });
  }

  restoreDistractions() {
    this.originalStyles.forEach((display, element) => {
      if (element && element.style) {
        element.style.display = display || '';
      }
    });
    this.originalStyles.clear();
  }

  enableSimpleFocus() {
    // Fallback: Just dim everything except main content area
    const style = document.createElement('style');
    style.id = 'neuroread-simple-focus';
    style.textContent = `
      body > *:not(#neuroread-focus-overlay):not([id^="neuroread"]) {
        opacity: 0.1 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    
    this.focusOverlay = { remove: () => style.remove() };
  }
}

// Make available globally
window.FocusMode = FocusMode;
