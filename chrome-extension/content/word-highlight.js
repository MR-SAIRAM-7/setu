// Word Highlight - Guide reading with a moving highlight
// Helps ADHD readers maintain focus on current word/line

class WordHighlight {
  constructor() {
    this.isEnabled = false;
    this.highlightElement = null;
    this.currentLine = null;
    this.isFollowingMouse = false;
    this.isAutoAdvance = false;
    
    // Settings
    this.highlightMode = 'line'; // 'line', 'word', 'paragraph'
    this.highlightColor = 'rgba(99, 102, 241, 0.2)';
    this.highlightHeight = 1.5; // em
    
    // Animation
    this.animationId = null;
    this.lastMouseY = 0;
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    
    console.log('✨ Word Highlight enabled');
    
    this.createHighlight();
    this.setupEventListeners();
    this.startFollowing();
    
    document.body.classList.add('setu-highlight-active');
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    
    console.log('✨ Word Highlight disabled');
    
    this.stopFollowing();
    this.removeEventListeners();
    this.removeHighlight();
    
    document.body.classList.remove('setu-highlight-active');
  }

  createHighlight() {
    // Create the highlight element
    this.highlightElement = document.createElement('div');
    this.highlightElement.id = 'setu-word-highlight';
    this.highlightElement.innerHTML = `
      <div class="highlight-line"></div>
      <div class="highlight-controls">
        <button class="highlight-btn" data-mode="line" title="Line Mode">≡</button>
        <button class="highlight-btn" data-mode="word" title="Word Mode">▪</button>
        <button class="highlight-btn" data-mode="paragraph" title="Paragraph Mode">¶</button>
      </div>
    `;
    
    document.body.appendChild(this.highlightElement);
    
    // Setup mode buttons
    this.highlightElement.querySelectorAll('.highlight-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    });
    
    // Set initial mode
    this.setMode(this.highlightMode);
  }

  removeHighlight() {
    if (this.highlightElement) {
      this.highlightElement.remove();
      this.highlightElement = null;
    }
  }

  setMode(mode) {
    this.highlightMode = mode;
    
    // Update button states
    this.highlightElement.querySelectorAll('.highlight-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Update highlight style
    const line = this.highlightElement.querySelector('.highlight-line');
    
    switch (mode) {
      case 'line':
        line.style.height = '1.6em';
        line.style.borderRadius = '4px';
        break;
      case 'word':
        line.style.height = '1.4em';
        line.style.borderRadius = '2px';
        break;
      case 'paragraph':
        line.style.height = 'auto';
        line.style.minHeight = '3em';
        line.style.borderRadius = '8px';
        break;
    }
  }

  setupEventListeners() {
    // Mouse tracking
    this.mouseHandler = (e) => {
      this.lastMouseY = e.clientY;
      this.updateHighlightPosition(e.clientY);
    };
    
    // Scroll tracking
    this.scrollHandler = () => {
      // Keep highlight in view during scroll
      if (this.lastMouseY > 0) {
        this.updateHighlightPosition(this.lastMouseY);
      }
    };
    
    // Keyboard navigation
    this.keyHandler = (e) => {
      if (e.key === 'ArrowDown') {
        this.moveHighlight(30);
      } else if (e.key === 'ArrowUp') {
        this.moveHighlight(-30);
      }
    };
    
    document.addEventListener('mousemove', this.mouseHandler);
    window.addEventListener('scroll', this.scrollHandler);
    document.addEventListener('keydown', this.keyHandler);
  }

  removeEventListeners() {
    document.removeEventListener('mousemove', this.mouseHandler);
    window.removeEventListener('scroll', this.scrollHandler);
    document.removeEventListener('keydown', this.keyHandler);
  }

  startFollowing() {
    this.isFollowingMouse = true;
  }

  stopFollowing() {
    this.isFollowingMouse = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  updateHighlightPosition(y) {
    if (!this.highlightElement) return;
    
    const line = this.highlightElement.querySelector('.highlight-line');
    
    // Get the element at this Y position
    const element = document.elementFromPoint(window.innerWidth / 2, y);
    
    if (element) {
      // Find the text line at this position
      const rect = this.getLineRect(element, y);
      
      if (rect) {
        line.style.top = `${rect.top + window.scrollY}px`;
        line.style.left = `${rect.left}px`;
        line.style.width = `${rect.width}px`;
        line.style.height = `${rect.height}px`;
      }
    }
  }

  getLineRect(element, y) {
    // Get the bounding rectangle of the text line
    const range = document.caretRangeFromPoint(window.innerWidth / 2, y);
    
    if (range) {
      const rect = range.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };
    }
    
    // Fallback to element rect
    const elemRect = element.getBoundingClientRect();
    return {
      top: elemRect.top,
      left: elemRect.left,
      width: elemRect.width,
      height: parseFloat(getComputedStyle(element).lineHeight) || 24
    };
  }

  moveHighlight(deltaY) {
    this.lastMouseY += deltaY;
    this.lastMouseY = Math.max(0, Math.min(window.innerHeight, this.lastMouseY));
    this.updateHighlightPosition(this.lastMouseY);
  }

  // Auto-advance mode for hands-free reading
  startAutoAdvance(wpm = 200) {
    this.isAutoAdvance = true;
    const msPerWord = 60000 / wpm;
    
    const advance = () => {
      if (!this.isAutoAdvance) return;
      
      this.moveHighlight(20);
      
      setTimeout(() => {
        requestAnimationFrame(advance);
      }, msPerWord);
    };
    
    advance();
  }

  stopAutoAdvance() {
    this.isAutoAdvance = false;
  }

  // Highlight specific word
  highlightWord(word) {
    // Find and highlight a specific word in the document
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      
      if (regex.test(text)) {
        // Create highlight
        const span = document.createElement('span');
        span.className = 'setu-word-highlight-static';
        
        const parts = text.split(regex);
        const match = text.match(regex);
        
        if (parts.length > 1 && match) {
          const before = document.createTextNode(parts[0]);
          span.textContent = match[0];
          const after = document.createTextNode(parts.slice(1).join(match[0]));
          
          const wrapper = document.createElement('span');
          wrapper.appendChild(before);
          wrapper.appendChild(span);
          wrapper.appendChild(after);
          
          node.parentNode.replaceChild(wrapper, node);
          
          // Scroll to word
          span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Remove highlight after delay
          setTimeout(() => {
            if (wrapper.parentNode) {
              const textNode = document.createTextNode(wrapper.textContent);
              wrapper.parentNode.replaceChild(textNode, wrapper);
            }
          }, 2000);
          
          return true;
        }
      }
    }
    
    return false;
  }
}

// Make available globally
window.WordHighlight = WordHighlight;
