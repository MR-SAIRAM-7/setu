// Bionic Reading - Bold first half of words to guide the eye
// Scientifically proven to help ADHD and Dyslexic readers

class BionicReading {
  constructor() {
    this.isEnabled = false;
    this.processedElements = new WeakSet();
    this.observer = null;
    this.intensity = 0.5; // How much of the word to bold (0.5 = first half)
  }

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    
    console.log('🔤 Bionic Reading enabled');
    
    // Process existing content
    this.processDocument();
    
    // Watch for new content
    this.setupMutationObserver();
    
    // Add bionic class to body
    document.body.classList.add('neuroread-bionic-active');
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    
    console.log('🔤 Bionic Reading disabled');
    
    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Remove bionic class
    document.body.classList.remove('neuroread-bionic-active');
    
    // Restore original text
    this.restoreOriginalText();
  }

  processDocument() {
    const textElements = this.getTextElements();
    textElements.forEach(el => this.processElement(el));
  }

  getTextElements() {
    // Get all text-containing elements, excluding scripts, styles, and our own elements
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip if parent is script, style, or our own elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'iframe', 'canvas', 'svg'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          if (parent.closest('.neuroread-*') || parent.closest('#neuroread-*')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if already processed
          if (this.processedElements.has(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip empty text nodes
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const elements = [];
    let node;
    while (node = walker.nextNode()) {
      elements.push(node);
    }
    
    return elements;
  }

  processElement(textNode) {
    const parent = textNode.parentElement;
    if (!parent || this.processedElements.has(parent)) return;
    
    const text = textNode.textContent;
    if (!text.trim() || text.length < 3) return;
    
    // Check if this is inside a link or button (preserve functionality)
    const isInteractive = parent.closest('a, button, input, textarea, [role="button"]');
    
    // Create bionic version
    const bionicText = this.convertToBionic(text);
    
    if (bionicText !== text) {
      if (isInteractive) {
        // For interactive elements, wrap in span to preserve functionality
        const wrapper = document.createElement('span');
        wrapper.className = 'neuroread-bionic-text';
        wrapper.innerHTML = bionicText;
        
        // Replace text node with wrapper
        if (textNode.parentNode) {
          const span = document.createElement('span');
          span.innerHTML = bionicText;
          textNode.parentNode.replaceChild(span, textNode);
          this.processedElements.add(span);
        }
      } else {
        // For regular text, use a span
        const span = document.createElement('span');
        span.className = 'neuroread-bionic-text';
        span.innerHTML = bionicText;
        
        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(span, textNode);
          this.processedElements.add(span);
        }
      }
    }
  }

  convertToBionic(text) {
    // Split into words and process each
    return text.replace(/\b[a-zA-Z]+\b/g, (word) => {
      if (word.length < 2) return word;
      
      // Calculate bold portion based on intensity
      const boldLength = Math.max(1, Math.ceil(word.length * this.intensity));
      const boldPart = word.substring(0, boldLength);
      const restPart = word.substring(boldLength);
      
      return `<strong class="neuroread-bold">${boldPart}</strong>${restPart}`;
    });
  }

  restoreOriginalText() {
    // Find all bionic text elements and restore
    const bionicElements = document.querySelectorAll('.neuroread-bionic-text');
    bionicElements.forEach(el => {
      const textContent = el.textContent;
      const textNode = document.createTextNode(textContent);
      el.parentNode.replaceChild(textNode, el);
    });
    
    // Clear processed elements
    this.processedElements = new WeakSet();
  }

  setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Process new element and its children
            this.processNewElement(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            this.processElement(node);
          }
        });
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processNewElement(element) {
    // Skip our own elements
    if (element.classList && element.classList.contains('neuroread-*')) return;
    
    // Get all text nodes within this element
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    textNodes.forEach(node => this.processElement(node));
  }

  setIntensity(value) {
    this.intensity = Math.max(0.3, Math.min(0.7, value));
    if (this.isEnabled) {
      this.restoreOriginalText();
      this.processDocument();
    }
  }
}

// Make available globally
window.BionicReading = BionicReading;
