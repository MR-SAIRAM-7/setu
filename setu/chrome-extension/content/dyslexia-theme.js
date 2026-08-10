// Dyslexia Theme - Accessibility themes and font options
// Includes OpenDyslexic font, color overlays, and spacing adjustments

class DyslexiaTheme {
  constructor() {
    this.isEnabled = false;
    this.currentTheme = 'default';
    this.styleElement = null;
    this.fontLoaded = false;
    
    // Theme configurations
    this.themes = {
      default: {
        background: '#ffffff',
        text: '#1e293b',
        link: '#6366f1',
        font: 'system-ui, -apple-system, sans-serif',
        lineHeight: 1.6,
        letterSpacing: '0',
        wordSpacing: '0'
      },
      sepia: {
        background: '#f4ecd8',
        text: '#5b4636',
        link: '#8b6914',
        font: 'Georgia, serif',
        lineHeight: 1.8,
        letterSpacing: '0.01em',
        wordSpacing: '0.05em'
      },
      dark: {
        background: '#1a1a2e',
        text: '#eaeaea',
        link: '#8b5cf6',
        font: 'system-ui, -apple-system, sans-serif',
        lineHeight: 1.7,
        letterSpacing: '0.01em',
        wordSpacing: '0.02em'
      },
      'high-contrast': {
        background: '#000000',
        text: '#ffffff',
        link: '#ffff00',
        font: 'Arial, sans-serif',
        lineHeight: 2,
        letterSpacing: '0.05em',
        wordSpacing: '0.1em'
      },
      dyslexia: {
        background: '#fff8e7',
        text: '#2d3748',
        link: '#3182ce',
        font: 'OpenDyslexic, Comic Sans MS, sans-serif',
        lineHeight: 2,
        letterSpacing: '0.05em',
        wordSpacing: '0.15em'
      }
    };
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    
    console.log('🔤 Dyslexia Theme enabled');
    
    // Load OpenDyslexic font
    this.loadDyslexicFont();
    
    // Apply current theme
    this.applyTheme(this.currentTheme);
    
    document.body.classList.add('neuroread-dyslexia-active');
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    
    console.log('🔤 Dyslexia Theme disabled');
    
    this.removeStyles();
    document.body.classList.remove('neuroread-dyslexia-active');
  }

  setTheme(themeName) {
    this.currentTheme = themeName;
    
    if (this.isEnabled) {
      this.applyTheme(themeName);
    }
    
    // Update body class
    document.body.classList.remove(
      'neuroread-theme-default',
      'neuroread-theme-sepia',
      'neuroread-theme-dark',
      'neuroread-theme-high-contrast',
      'neuroread-theme-dyslexia'
    );
    document.body.classList.add(`neuroread-theme-${themeName}`);
  }

  loadDyslexicFont() {
    if (this.fontLoaded) return;
    
    // Load OpenDyslexic font from CDN
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.0/open-dyslexic-regular.css';
    document.head.appendChild(fontLink);
    
    this.fontLoaded = true;
  }

  applyTheme(themeName) {
    const theme = this.themes[themeName];
    if (!theme) return;
    
    this.removeStyles();
    
    // Create style element
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'neuroread-dyslexia-styles';
    
    const css = `
      /* NeuroRead Dyslexia Theme: ${themeName} */
      
      body.neuroread-dyslexia-active,
      body.neuroread-dyslexia-active *,
      body.neuroread-dyslexia-active *::before,
      body.neuroread-dyslexia-active *::after {
        background-color: ${theme.background} !important;
        color: ${theme.text} !important;
        font-family: ${theme.font} !important;
        line-height: ${theme.lineHeight} !important;
        letter-spacing: ${theme.letterSpacing} !important;
        word-spacing: ${theme.wordSpacing} !important;
      }
      
      body.neuroread-dyslexia-active a,
      body.neuroread-dyslexia-active a:visited {
        color: ${theme.link} !important;
        text-decoration: underline !important;
      }
      
      body.neuroread-dyslexia-active a:hover {
        opacity: 0.8 !important;
      }
      
      /* Improve readability */
      body.neuroread-dyslexia-active p {
        max-width: 70ch !important;
        margin-bottom: 1.5em !important;
      }
      
      /* Larger clickable areas */
      body.neuroread-dyslexia-active a,
      body.neuroread-dyslexia-active button {
        min-height: 44px !important;
        min-width: 44px !important;
        padding: 8px 16px !important;
      }
      
      /* Better focus indicators */
      body.neuroread-dyslexia-active *:focus {
        outline: 3px solid ${theme.link} !important;
        outline-offset: 2px !important;
      }
      
      /* Remove justified text */
      body.neuroread-dyslexia-active * {
        text-align: left !important;
      }
      
      /* Improve form elements */
      body.neuroread-dyslexia-active input,
      body.neuroread-dyslexia-active textarea,
      body.neuroread-dyslexia-active select {
        font-size: 16px !important;
        padding: 12px !important;
        border: 2px solid ${theme.text} !important;
        border-radius: 4px !important;
      }
      
      /* Headings */
      body.neuroread-dyslexia-active h1,
      body.neuroread-dyslexia-active h2,
      body.neuroread-dyslexia-active h3 {
        font-weight: 700 !important;
        margin-top: 1.5em !important;
        margin-bottom: 0.5em !important;
      }
      
      /* Lists */
      body.neuroread-dyslexia-active ul,
      body.neuroread-dyslexia-active ol {
        padding-left: 2em !important;
      }
      
      body.neuroread-dyslexia-active li {
        margin-bottom: 0.5em !important;
      }
      
      /* Code blocks */
      body.neuroread-dyslexia-active code,
      body.neuroread-dyslexia-active pre {
        font-family: 'Courier New', monospace !important;
        background: rgba(0,0,0,0.05) !important;
        padding: 2px 6px !important;
        border-radius: 3px !important;
      }
      
      /* Images */
      body.neuroread-dyslexia-active img {
        max-width: 100% !important;
        height: auto !important;
      }
      
      /* Tables */
      body.neuroread-dyslexia-active table {
        border-collapse: collapse !important;
        width: 100% !important;
      }
      
      body.neuroread-dyslexia-active th,
      body.neuroread-dyslexia-active td {
        border: 1px solid ${theme.text} !important;
        padding: 12px !important;
      }
      
      /* Ruler line for reading */
      body.neuroread-dyslexia-active p {
        position: relative !important;
      }
      
      /* Hide distracting elements */
      body.neuroread-dyslexia-active .advertisement,
      body.neuroread-dyslexia-active .ad,
      body.neuroread-dyslexia-active .popup,
      body.neuroread-dyslexia-active .modal:not([aria-modal="true"]) {
        display: none !important;
      }
    `;
    
    this.styleElement.textContent = css;
    document.head.appendChild(this.styleElement);
  }

  removeStyles() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }

  // Quick settings adjustment
  setLineHeight(value) {
    if (this.styleElement) {
      const theme = this.themes[this.currentTheme];
      theme.lineHeight = value;
      this.applyTheme(this.currentTheme);
    }
  }

  setLetterSpacing(value) {
    if (this.styleElement) {
      const theme = this.themes[this.currentTheme];
      theme.letterSpacing = value;
      this.applyTheme(this.currentTheme);
    }
  }

  setWordSpacing(value) {
    if (this.styleElement) {
      const theme = this.themes[this.currentTheme];
      theme.wordSpacing = value;
      this.applyTheme(this.currentTheme);
    }
  }

  // Create a reading ruler
  createReadingRuler() {
    const ruler = document.createElement('div');
    ruler.id = 'neuroread-reading-ruler';
    ruler.innerHTML = `
      <div class="ruler-line"></div>
      <div class="ruler-overlay top"></div>
      <div class="ruler-overlay bottom"></div>
    `;
    
    ruler.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 9998;
    `;
    
    document.body.appendChild(ruler);
    
    // Update ruler position on mouse move
    const updateRuler = (e) => {
      const lineHeight = 40;
      const y = e.clientY;
      
      ruler.querySelector('.ruler-line').style.cssText = `
        position: absolute;
        top: ${y}px;
        left: 0;
        right: 0;
        height: ${lineHeight}px;
        background: rgba(99, 102, 241, 0.1);
        border-top: 2px solid rgba(99, 102, 241, 0.5);
        border-bottom: 2px solid rgba(99, 102, 241, 0.5);
      `;
      
      ruler.querySelector('.ruler-overlay.top').style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: ${y}px;
        background: rgba(0, 0, 0, 0.3);
      `;
      
      ruler.querySelector('.ruler-overlay.bottom').style.cssText = `
        position: absolute;
        top: ${y + lineHeight}px;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
      `;
    };
    
    document.addEventListener('mousemove', updateRuler);
    
    // Return cleanup function
    return () => {
      ruler.remove();
      document.removeEventListener('mousemove', updateRuler);
    };
  }
}

// Make available globally
window.DyslexiaTheme = DyslexiaTheme;
