// Text to Speech - Read content aloud with word highlighting
// Uses Web Speech API for natural voice synthesis

class TextToSpeech {
  constructor() {
    this.isEnabled = false;
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.currentUtterance = null;
    this.isSpeaking = false;
    this.isPaused = false;
    
    // Settings
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.selectedVoice = null;
    
    // Word highlighting
    this.currentWordIndex = 0;
    this.words = [];
    this.highlightElements = [];
    
    // Controls
    this.ttsOverlay = null;
    
    this.init();
  }

  init() {
    // Load voices when available
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
    this.loadVoices();
  }

  loadVoices() {
    this.voices = this.synth.getVoices();
    
    // Prefer natural-sounding voices
    const preferredVoices = [
      'Google US English',
      'Microsoft David',
      'Microsoft Zira',
      'Samantha',
      'Alex'
    ];
    
    for (const voiceName of preferredVoices) {
      const voice = this.voices.find(v => v.name.includes(voiceName));
      if (voice) {
        this.selectedVoice = voice;
        break;
      }
    }
    
    // Fallback to first English voice
    if (!this.selectedVoice) {
      this.selectedVoice = this.voices.find(v => v.lang.startsWith('en')) || this.voices[0];
    }
  }

  enable() {
    this.isEnabled = true;
    console.log('🔊 Text to Speech enabled');
    this.createControls();
  }

  disable() {
    this.isEnabled = false;
    this.stop();
    this.removeControls();
    console.log('🔊 Text to Speech disabled');
  }

  createControls() {
    this.ttsOverlay = document.createElement('div');
    this.ttsOverlay.id = 'neuroread-tts-controls';
    this.ttsOverlay.innerHTML = `
      <div class="tts-panel">
        <button class="tts-btn tts-play" title="Play">
          <span>▶</span>
        </button>
        <button class="tts-btn tts-pause" title="Pause" style="display: none;">
          <span>⏸</span>
        </button>
        <button class="tts-btn tts-stop" title="Stop">
          <span>⏹</span>
        </button>
        <div class="tts-speed">
          <button class="tts-btn tts-speed-down" title="Slower">−</button>
          <span class="tts-rate">1.0x</span>
          <button class="tts-btn tts-speed-up" title="Faster">+</button>
        </div>
        <button class="tts-btn tts-close" title="Close">✕</button>
      </div>
      <div class="tts-progress">
        <div class="tts-progress-bar"></div>
      </div>
    `;
    
    document.body.appendChild(this.ttsOverlay);
    this.setupControls();
  }

  setupControls() {
    // Play
    this.ttsOverlay.querySelector('.tts-play').addEventListener('click', () => {
      this.resume();
    });
    
    // Pause
    this.ttsOverlay.querySelector('.tts-pause').addEventListener('click', () => {
      this.pause();
    });
    
    // Stop
    this.ttsOverlay.querySelector('.tts-stop').addEventListener('click', () => {
      this.stop();
    });
    
    // Speed controls
    this.ttsOverlay.querySelector('.tts-speed-down').addEventListener('click', () => {
      this.setRate(this.rate - 0.1);
    });
    
    this.ttsOverlay.querySelector('.tts-speed-up').addEventListener('click', () => {
      this.setRate(this.rate + 0.1);
    });
    
    // Close
    this.ttsOverlay.querySelector('.tts-close').addEventListener('click', () => {
      this.disable();
    });
  }

  removeControls() {
    if (this.ttsOverlay) {
      this.ttsOverlay.remove();
      this.ttsOverlay = null;
    }
  }

  updateControls() {
    if (!this.ttsOverlay) return;
    
    const playBtn = this.ttsOverlay.querySelector('.tts-play');
    const pauseBtn = this.ttsOverlay.querySelector('.tts-pause');
    const rateDisplay = this.ttsOverlay.querySelector('.tts-rate');
    
    if (this.isSpeaking && !this.isPaused) {
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'flex';
    } else {
      playBtn.style.display = 'flex';
      pauseBtn.style.display = 'none';
    }
    
    rateDisplay.textContent = `${this.rate.toFixed(1)}x`;
  }

  speak(text) {
    if (!text) return;
    
    // Stop any current speech
    this.stop();
    
    // Prepare text
    this.words = text.split(/\s+/);
    this.currentWordIndex = 0;
    
    // Create utterance
    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance.voice = this.selectedVoice;
    this.currentUtterance.rate = this.rate;
    this.currentUtterance.pitch = this.pitch;
    this.currentUtterance.volume = this.volume;
    
    // Event handlers
    this.currentUtterance.onstart = () => {
      this.isSpeaking = true;
      this.isPaused = false;
      this.updateControls();
      document.body.classList.add('neuroread-tts-speaking');
    };
    
    this.currentUtterance.onend = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      this.updateControls();
      this.clearHighlight();
      document.body.classList.remove('neuroread-tts-speaking');
    };
    
    this.currentUtterance.onpause = () => {
      this.isPaused = true;
      this.updateControls();
    };
    
    this.currentUtterance.onresume = () => {
      this.isPaused = false;
      this.updateControls();
    };
    
    this.currentUtterance.onboundary = (event) => {
      // Highlight current word
      if (event.name === 'word') {
        this.highlightWordAtPosition(event.charIndex);
        this.updateProgress(event.charIndex / text.length);
      }
    };
    
    // Speak
    this.synth.speak(this.currentUtterance);
  }

  pause() {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.synth.paused) {
      this.synth.resume();
    } else if (!this.synth.speaking) {
      // Restart if stopped
      const selection = window.getSelection().toString();
      if (selection) {
        this.speak(selection);
      } else {
        // Get article content
        const article = document.querySelector('article, main, .article');
        if (article) {
          this.speak(article.textContent);
        }
      }
    }
  }

  stop() {
    this.synth.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
    this.clearHighlight();
    this.updateControls();
    document.body.classList.remove('neuroread-tts-speaking');
  }

  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(3, rate));
    
    // Update current utterance if speaking
    if (this.currentUtterance && this.isSpeaking) {
      // Need to restart with new rate
      const wasPaused = this.isPaused;
      this.stop();
      
      // Reconstruct remaining text
      const remainingText = this.words.slice(this.currentWordIndex).join(' ');
      setTimeout(() => this.speak(remainingText), 100);
      
      if (wasPaused) {
        setTimeout(() => this.pause(), 200);
      }
    }
    
    this.updateControls();
  }

  highlightWordAtPosition(charIndex) {
    this.clearHighlight();
    
    // Find the word at this character position
    let currentIndex = 0;
    let wordIndex = 0;
    
    for (let i = 0; i < this.words.length; i++) {
      if (currentIndex >= charIndex) {
        wordIndex = i;
        break;
      }
      currentIndex += this.words[i].length + 1; // +1 for space
    }
    
    this.currentWordIndex = wordIndex;
    
    // Highlight in DOM
    this.highlightWordInDOM(this.words[wordIndex]);
  }

  highlightWordInDOM(word) {
    if (!word || word.length < 2) return;
    
    // Find text nodes containing this word
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanWord.length < 2) return;
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      const regex = new RegExp(`\\b${cleanWord}\\b`, 'i');
      
      if (regex.test(text)) {
        const parent = node.parentElement;
        if (parent && !parent.closest('#neuroread-*')) {
          // Create highlight
          const span = document.createElement('span');
          span.className = 'neuroread-tts-highlight';
          
          const parts = text.split(regex);
          const match = text.match(regex);
          
          if (parts.length > 1 && match) {
            span.textContent = match[0];
            
            const before = document.createTextNode(parts[0]);
            const after = document.createTextNode(parts.slice(1).join(match[0]));
            
            const wrapper = document.createElement('span');
            wrapper.appendChild(before);
            wrapper.appendChild(span);
            wrapper.appendChild(after);
            
            node.parentNode.replaceChild(wrapper, node);
            
            // Scroll to highlighted word
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            this.highlightElements.push(span);
            break;
          }
        }
      }
    }
  }

  clearHighlight() {
    this.highlightElements.forEach(el => {
      const wrapper = el.parentElement;
      if (wrapper && wrapper.parentNode) {
        const text = wrapper.textContent;
        const textNode = document.createTextNode(text);
        wrapper.parentNode.replaceChild(textNode, wrapper);
      }
    });
    this.highlightElements = [];
  }

  updateProgress(percent) {
    if (!this.ttsOverlay) return;
    
    const progressBar = this.ttsOverlay.querySelector('.tts-progress-bar');
    progressBar.style.width = `${percent * 100}%`;
  }

  // Read selected text
  speakSelection() {
    const selection = window.getSelection().toString();
    if (selection) {
      this.speak(selection);
    }
  }

  // Read article
  speakArticle() {
    const article = document.querySelector('article, main, .article, .post-content, .entry-content');
    if (article) {
      this.speak(article.textContent);
    } else {
      // Fallback to main content
      this.speak(document.body.textContent.substring(0, 5000));
    }
  }
}

// Make available globally
window.TextToSpeech = TextToSpeech;
