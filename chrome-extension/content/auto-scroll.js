// Auto Scroll - Hands-free reading with adaptive speed
// Detects reading speed and adjusts scroll accordingly

class AutoScroll {
  constructor() {
    this.isEnabled = false;
    this.scrollSpeed = 50; // pixels per second
    this.baseSpeed = 50;
    this.isPaused = false;
    this.lastScrollTime = 0;
    this.animationId = null;
    
    // Reading speed detection
    this.wordsRead = 0;
    this.readingStartTime = null;
    this.estimatedWPM = 200;
    this.targetWPM = 200;
    
    // Viewport tracking
    this.viewportWords = [];
    this.visibleWordIndex = 0;
    
    // Controls overlay
    this.controlsOverlay = null;
    this.progressBar = null;
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    
    console.log('[AutoScroll] Enabled');
    
    this.readingStartTime = Date.now();
    this.analyzeContent();
    this.createControls();
    this.startScrolling();
    this.setupEventListeners();
    
    document.body.classList.add('setu-scroll-active');
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    
    console.log('[AutoScroll] Disabled');
    
    this.stopScrolling();
    this.removeControls();
    this.removeEventListeners();
    this.saveReadingStats();
    
    document.body.classList.remove('setu-scroll-active');
  }

  analyzeContent() {
    // Find all text content and split into words
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td');
    this.viewportWords = [];
    
    textElements.forEach(el => {
      const text = el.textContent.trim();
      if (text) {
        const words = text.split(/\s+/);
        words.forEach((word, index) => {
          this.viewportWords.push({
            word: word,
            element: el,
            wordIndex: index
          });
        });
      }
    });
    
    console.log(`Analyzed ${this.viewportWords.length} words`);
  }

  createControls() {
    this.controlsOverlay = document.createElement('div');
    this.controlsOverlay.id = 'setu-scroll-controls';
    this.controlsOverlay.innerHTML = `
      <div class="scroll-controls-panel">
        <button class="scroll-btn scroll-pause" title="Pause/Play (Space)">
          <span class="pause-icon">&#10074;&#10074;</span>
          <span class="play-icon" style="display: none;">&#9654;</span>
        </button>
        <div class="scroll-speed-control">
          <button class="scroll-btn scroll-slower" title="Slower">&minus;</button>
          <div class="speed-display">
            <span class="speed-value">200</span>
            <span class="speed-unit">WPM</span>
          </div>
          <button class="scroll-btn scroll-faster" title="Faster">+</button>
        </div>
        <button class="scroll-btn scroll-stop" title="Stop Auto Scroll">&times;</button>
      </div>
      <div class="scroll-progress-bar">
        <div class="scroll-progress-fill"></div>
      </div>
    `;
    
    document.body.appendChild(this.controlsOverlay);
    
    // Setup control buttons
    this.setupControlButtons();
    
    // Get progress bar
    this.progressBar = this.controlsOverlay.querySelector('.scroll-progress-fill');
  }

  setupControlButtons() {
    // Pause/Play
    const pauseBtn = this.controlsOverlay.querySelector('.scroll-pause');
    pauseBtn.addEventListener('click', () => this.togglePause());
    
    // Slower
    const slowerBtn = this.controlsOverlay.querySelector('.scroll-slower');
    slowerBtn.addEventListener('click', () => this.adjustSpeed(-20));
    
    // Faster
    const fasterBtn = this.controlsOverlay.querySelector('.scroll-faster');
    fasterBtn.addEventListener('click', () => this.adjustSpeed(20));
    
    // Stop
    const stopBtn = this.controlsOverlay.querySelector('.scroll-stop');
    stopBtn.addEventListener('click', () => this.disable());
  }

  removeControls() {
    if (this.controlsOverlay) {
      this.controlsOverlay.remove();
      this.controlsOverlay = null;
    }
  }

  setupEventListeners() {
    // Keyboard controls
    this.keyHandler = (e) => {
      if (e.code === 'Space' && !this.isInputFocused()) {
        e.preventDefault();
        this.togglePause();
      }
      if (e.code === 'ArrowUp') {
        this.adjustSpeed(10);
      }
      if (e.code === 'ArrowDown') {
        this.adjustSpeed(-10);
      }
    };
    
    // Click to pause
    this.clickHandler = (e) => {
      if (!e.target.closest('#setu-scroll-controls')) {
        this.togglePause();
      }
    };
    
    // Scroll detection for speed adjustment
    this.scrollHandler = () => {
      this.detectManualScroll();
    };
    
    document.addEventListener('keydown', this.keyHandler);
    document.addEventListener('click', this.clickHandler);
    window.addEventListener('scroll', this.scrollHandler);
  }

  removeEventListeners() {
    document.removeEventListener('keydown', this.keyHandler);
    document.removeEventListener('click', this.clickHandler);
    window.removeEventListener('scroll', this.scrollHandler);
  }

  isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );
  }

  startScrolling() {
    this.lastScrollTime = performance.now();
    this.scrollFrame();
  }

  stopScrolling() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  scrollFrame() {
    if (!this.isEnabled || this.isPaused) {
      this.animationId = requestAnimationFrame(() => this.scrollFrame());
      return;
    }
    
    const now = performance.now();
    const deltaTime = (now - this.lastScrollTime) / 1000; // seconds
    this.lastScrollTime = now;
    
    // Calculate scroll amount based on WPM
    // Average word length ~5 chars, average line ~60 chars = ~12 words per line
    // At 200 WPM, need to scroll ~17 lines per minute
    const pixelsPerWord = 20; // Approximate
    const scrollAmount = (this.targetWPM * pixelsPerWord / 60) * deltaTime;
    
    window.scrollBy(0, scrollAmount);
    
    // Update progress
    this.updateProgress();
    
    // Check if reached end
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 100) {
      this.pause();
    }
    
    this.animationId = requestAnimationFrame(() => this.scrollFrame());
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    
    const pauseIcon = this.controlsOverlay.querySelector('.pause-icon');
    const playIcon = this.controlsOverlay.querySelector('.play-icon');
    
    if (this.isPaused) {
      pauseIcon.style.display = 'none';
      playIcon.style.display = 'inline';
      this.controlsOverlay.classList.add('paused');
    } else {
      pauseIcon.style.display = 'inline';
      playIcon.style.display = 'none';
      this.controlsOverlay.classList.remove('paused');
      this.lastScrollTime = performance.now();
    }
  }

  pause() {
    this.isPaused = true;
    const pauseIcon = this.controlsOverlay.querySelector('.pause-icon');
    const playIcon = this.controlsOverlay.querySelector('.play-icon');
    pauseIcon.style.display = 'none';
    playIcon.style.display = 'inline';
    this.controlsOverlay.classList.add('paused');
  }

  adjustSpeed(delta) {
    this.targetWPM = Math.max(50, Math.min(800, this.targetWPM + delta));
    
    const speedValue = this.controlsOverlay.querySelector('.speed-value');
    speedValue.textContent = this.targetWPM;
    
    // Visual feedback
    speedValue.style.transform = 'scale(1.2)';
    setTimeout(() => {
      speedValue.style.transform = 'scale(1)';
    }, 150);
  }

  detectManualScroll() {
    // If user manually scrolls, adjust speed to match
    // This is a simplified version
  }

  updateProgress() {
    if (!this.progressBar) return;
    
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    this.progressBar.style.width = `${Math.min(100, Math.max(0, scrollPercent))}%`;
  }

  saveReadingStats() {
    if (!this.readingStartTime) return;
    
    const readingTime = (Date.now() - this.readingStartTime) / 60000; // minutes
    const wordsRead = Math.floor(readingTime * this.targetWPM);
    
    const stats = {
      wpm: this.targetWPM,
      time: Math.round(readingTime),
      words: wordsRead
    };
    
    // Send to background script
    chrome.runtime.sendMessage({
      action: 'updateStats',
      stats: stats
    });
  }

  // Word highlighting during scroll
  highlightCurrentWord() {
    // Find word at current scroll position
    const viewportCenter = window.scrollY + window.innerHeight / 2;
    
    // Simple word highlighting based on position
    // In full implementation, track exact word position
  }
}

// Make available globally
window.AutoScroll = AutoScroll;
