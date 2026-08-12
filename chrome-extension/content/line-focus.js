/**
 * NeuroRead Line Focus Mode
 * 
 * Completely transforms the page into an accessible, distraction-free reading view.
 * Focuses strictly on ONE line of text while blurring & dimming the rest of the webpage.
 * Smoothly follows cursor movement, scroll, and arrow key navigation.
 */

class LineFocus {
  constructor() {
    this.isEnabled = false;
    this.overlay = null;
    this.topMask = null;
    this.bottomMask = null;
    this.spotlightBand = null;
    this.controlPill = null;
    
    // Config state
    this.bandHeight = 44; // Default ~1 line height (px)
    this.blurAmount = 8;  // Backdrop blur (px)
    this.opacity = 0.75;  // Backdrop darkness opacity
    this.currentY = window.innerHeight / 3;
    this.targetY = window.innerHeight / 3;
    this.rafId = null;
    
    // Event handlers
    this.mouseHandler = null;
    this.scrollHandler = null;
    this.keyHandler = null;
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    
    console.log('[LineFocus] Enabling webpage line focus transformation');
    
    this.createOverlay();
    this.attachEventListeners();
    this.startAnimationLoop();
    
    document.documentElement.classList.add('nb-line-focus-active');
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    
    console.log('[LineFocus] Disabling line focus');
    
    this.stopAnimationLoop();
    this.detachEventListeners();
    this.removeOverlay();
    
    document.documentElement.classList.remove('nb-line-focus-active');
  }

  createOverlay() {
    this.removeOverlay();

    this.overlay = document.createElement('div');
    this.overlay.id = 'nb-line-focus-root';
    
    // Top blurred mask
    this.topMask = document.createElement('div');
    this.topMask.id = 'nb-line-focus-top';

    // Bottom blurred mask
    this.bottomMask = document.createElement('div');
    this.bottomMask.id = 'nb-line-focus-bottom';

    // Clear focused line spotlight band
    this.spotlightBand = document.createElement('div');
    this.spotlightBand.id = 'nb-line-focus-band';

    // Control bar pill
    this.controlPill = document.createElement('div');
    this.controlPill.id = 'nb-line-focus-pill';
    this.controlPill.innerHTML = `
      <div class="nb-pill-brand">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20M2 6h20M2 18h20"/></svg>
        <span>Line Focus</span>
      </div>
      <div class="nb-pill-divider"></div>
      <div class="nb-pill-buttons">
        <button class="nb-pill-btn active" data-lines="1" title="1 Line Focus">1 Line</button>
        <button class="nb-pill-btn" data-lines="2" title="2 Lines Focus">2 Lines</button>
        <button class="nb-pill-btn" data-lines="3" title="3 Lines Focus">Paragraph</button>
      </div>
      <div class="nb-pill-divider"></div>
      <button class="nb-pill-close-btn" title="Close Line Focus (Alt+L)">&times;</button>
    `;

    this.applyStyles();

    this.overlay.appendChild(this.topMask);
    this.overlay.appendChild(this.bottomMask);
    this.overlay.appendChild(this.spotlightBand);
    this.overlay.appendChild(this.controlPill);

    document.body.appendChild(this.overlay);

    // Event listeners on pill buttons
    this.controlPill.querySelectorAll('.nb-pill-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const lines = parseInt(btn.dataset.lines, 10);
        this.setLines(lines, btn);
      };
    });

    this.controlPill.querySelector('.nb-pill-close-btn').onclick = (e) => {
      e.stopPropagation();
      this.disable();
      if (window.setu) {
        window.setu.state.lineFocus = false;
        window.setu.saveState();
      }
    };

    this.updatePositions();
  }

  applyStyles() {
    const styleId = 'nb-line-focus-styles';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        #nb-line-focus-root {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 2147483630;
          pointer-events: none;
        }
        #nb-line-focus-top, #nb-line-focus-bottom {
          position: fixed;
          left: 0;
          right: 0;
          z-index: 2147483631;
          pointer-events: none;
          backdrop-filter: blur(${this.blurAmount}px) brightness(0.35);
          -webkit-backdrop-filter: blur(${this.blurAmount}px) brightness(0.35);
          background-color: rgba(15, 23, 42, ${this.opacity});
          transition: background-color 0.2s ease, backdrop-filter 0.2s ease;
        }
        #nb-line-focus-top {
          top: 0;
        }
        #nb-line-focus-bottom {
          bottom: 0;
        }
        #nb-line-focus-band {
          position: fixed;
          left: 0;
          right: 0;
          z-index: 2147483632;
          pointer-events: none;
          border-top: 2px solid rgba(99, 102, 241, 0.9);
          border-bottom: 2px solid rgba(99, 102, 241, 0.9);
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.35), inset 0 0 15px rgba(99, 102, 241, 0.15);
          background: transparent;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          transition: height 0.15s ease-out;
        }
        #nb-line-focus-pill {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2147483640;
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          background: #0f172a;
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 9999px;
          padding: 8px 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(99, 102, 241, 0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 500;
          user-select: none;
        }
        .nb-pill-brand {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #818cf8;
          font-weight: 600;
        }
        .nb-pill-divider {
          width: 1px;
          height: 16px;
          background: rgba(255, 255, 255, 0.2);
        }
        .nb-pill-buttons {
          display: flex;
          gap: 4px;
        }
        .nb-pill-btn {
          background: transparent;
          color: #94a3b8;
          border: none;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .nb-pill-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }
        .nb-pill-btn.active {
          background: #6366f1;
          color: #ffffff;
          font-weight: 600;
        }
        .nb-pill-close-btn {
          background: transparent;
          color: #94a3b8;
          border: none;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          padding: 0 4px;
          border-radius: 50%;
          transition: color 0.15s ease;
        }
        .nb-pill-close-btn:hover {
          color: #f43f5e;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  setLines(lineCount, buttonEl) {
    this.controlPill.querySelectorAll('.nb-pill-btn').forEach(btn => btn.classList.remove('active'));
    if (buttonEl) buttonEl.classList.add('active');

    switch (lineCount) {
      case 1:
        this.bandHeight = 44;
        break;
      case 2:
        this.bandHeight = 76;
        break;
      case 3:
        this.bandHeight = 120;
        break;
      default:
        this.bandHeight = 44;
    }
    this.updatePositions();
  }

  attachEventListeners() {
    this.mouseHandler = (e) => {
      this.targetY = e.clientY;
    };

    this.scrollHandler = () => {
      this.updatePositions();
    };

    this.keyHandler = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        this.targetY = Math.min(window.innerHeight - 50, this.targetY + 28);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        this.targetY = Math.max(50, this.targetY - 28);
      }
    };

    window.addEventListener('mousemove', this.mouseHandler, { passive: true });
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('keydown', this.keyHandler);
  }

  detachEventListeners() {
    if (this.mouseHandler) window.removeEventListener('mousemove', this.mouseHandler);
    if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler);
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
  }

  startAnimationLoop() {
    const loop = () => {
      if (!this.isEnabled) return;

      // Smooth interpolation for 60fps tracking
      const dy = this.targetY - this.currentY;
      if (Math.abs(dy) > 0.5) {
        this.currentY += dy * 0.25;
        this.updatePositions();
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopAnimationLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  updatePositions() {
    if (!this.topMask || !this.bottomMask || !this.spotlightBand) return;

    const bandTop = Math.max(0, Math.min(window.innerHeight - this.bandHeight, this.currentY - (this.bandHeight / 2)));
    const bandBottom = bandTop + this.bandHeight;

    // Top mask covers from 0 to bandTop
    this.topMask.style.height = `${bandTop}px`;

    // Bottom mask covers from bandBottom to bottom of window
    const bottomHeight = Math.max(0, window.innerHeight - bandBottom);
    this.bottomMask.style.top = `${bandBottom}px`;
    this.bottomMask.style.height = `${bottomHeight}px`;

    // Spotlight band positioned exactly between top and bottom mask
    this.spotlightBand.style.top = `${bandTop}px`;
    this.spotlightBand.style.height = `${this.bandHeight}px`;
  }
}

// Global registry
if (typeof window !== 'undefined') {
  window.LineFocus = LineFocus;
}
