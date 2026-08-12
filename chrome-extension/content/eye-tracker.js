// Eye Tracker - Webcam-based gaze tracking for hands-free reading
// Uses lightweight face/eye detection without heavy dependencies

class EyeTracker {
  constructor() {
    this.isEnabled = false;
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.stream = null;
    this.trackingOverlay = null;
    this.gazeIndicator = null;
    
    // Tracking state
    this.isTracking = false;
    this.gazeY = 0.5; // Normalized Y position (0-1)
    this.smoothedGazeY = 0.5;
    this.lastFacePosition = null;
    this.calibrationPoints = [];
    this.isCalibrated = false;
    
    // Scroll control
    this.scrollSpeed = 0;
    this.targetScrollSpeed = 0;
    this.readingZone = { top: 0.3, bottom: 0.7 };
    
    // Animation frame
    this.animationId = null;
  }

  async enable() {
    if (this.isEnabled) return;
    
    console.log('[EyeTracker] Enabled');
    
    // Request camera permission first
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      console.log('[EyeTracker] Camera permission denied');
      this.showPermissionMessage();
      return;
    }
    
    this.isEnabled = true;
    this.createOverlay();
    await this.startCamera();
    this.startTracking();
    
    document.body.classList.add('setu-eye-active');
  }

  disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    
    console.log('[EyeTracker] Disabled');
    
    this.stopTracking();
    this.stopCamera();
    this.removeOverlay();
    
    document.body.classList.remove('setu-eye-active');
  }

  async requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user'
        } 
      });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera permission error:', error);
      return false;
    }
  }

  showPermissionMessage() {
    const message = document.createElement('div');
    message.className = 'setu-permission-message';
    message.innerHTML = `
      <div class="permission-content">
        <span class="permission-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        </span>
        <h3>Camera Access Required</h3>
        <p>Eye tracking needs camera access to follow your gaze.</p>
        <button class="permission-btn" onclick="this.parentElement.parentElement.remove()">
          Got it
        </button>
      </div>
    `;
    message.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999999;
    `;
    document.body.appendChild(message);
    
    setTimeout(() => message.remove(), 5000);
  }

  createOverlay() {
    // Create tracking overlay
    this.trackingOverlay = document.createElement('div');
    this.trackingOverlay.id = 'setu-eye-overlay';
    this.trackingOverlay.innerHTML = `
      <div class="setu-eye-panel">
        <video id="setu-eye-video" autoplay playsinline muted></video>
        <canvas id="setu-eye-canvas"></canvas>
        <div class="setu-eye-status">
          <span class="eye-status-dot"></span>
          <span class="eye-status-text">Initializing...</span>
        </div>
        <button class="setu-eye-close" title="Close">&times;</button>
      </div>
      <div class="setu-reading-zone">
        <div class="reading-zone-indicator"></div>
      </div>
    `;
    
    document.body.appendChild(this.trackingOverlay);
    
    // Create gaze indicator
    this.gazeIndicator = document.createElement('div');
    this.gazeIndicator.id = 'setu-gaze-indicator';
    this.gazeIndicator.innerHTML = '<span class="gaze-dot-ring"></span>';
    document.body.appendChild(this.gazeIndicator);
    
    // Setup close button
    this.trackingOverlay.querySelector('.setu-eye-close').addEventListener('click', () => {
      this.disable();
    });
    
    // Get video and canvas elements
    this.video = document.getElementById('setu-eye-video');
    this.canvas = document.getElementById('setu-eye-canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  removeOverlay() {
    if (this.trackingOverlay) {
      this.trackingOverlay.remove();
      this.trackingOverlay = null;
    }
    if (this.gazeIndicator) {
      this.gazeIndicator.remove();
      this.gazeIndicator = null;
    }
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user'
        }
      });
      
      this.video.srcObject = this.stream;
      
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.canvas.width = this.video.videoWidth;
          this.canvas.height = this.video.videoHeight;
          resolve();
        };
      });
      
      this.updateStatus('Camera active - Look at the page');
    } catch (error) {
      console.error('Failed to start camera:', error);
      this.updateStatus('Camera error');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  startTracking() {
    this.isTracking = true;
    this.trackFrame();
  }

  stopTracking() {
    this.isTracking = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  trackFrame() {
    if (!this.isTracking) return;
    
    // Draw video frame to canvas for processing
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Detect face/eyes position
    const facePosition = this.detectFace(imageData);
    
    if (facePosition) {
      this.lastFacePosition = facePosition;
      
      // Estimate gaze position based on face/head position
      this.estimateGaze(facePosition);
      
      // Update UI
      this.updateGazeIndicator();
      this.controlScroll();
      
      this.updateStatus('Tracking active');
      this.trackingOverlay.querySelector('.eye-status-dot').classList.add('active');
    } else {
      this.updateStatus('No face detected');
      this.trackingOverlay.querySelector('.eye-status-dot').classList.remove('active');
    }
    
    // Draw debug overlay
    this.drawDebugOverlay(facePosition);
    
    this.animationId = requestAnimationFrame(() => this.trackFrame());
  }

  detectFace(imageData) {
    const { width, height, data } = imageData;
    
    // Simple skin color detection as proxy for face detection
    // In production, use a proper face detection library like MediaPipe
    
    let skinPixels = [];
    const skinThreshold = 30;
    
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Simple skin color detection
        if (r > 60 && g > 40 && b > 20 && 
            r > g && r > b && 
            Math.abs(r - g) > 10) {
          skinPixels.push({ x, y });
        }
      }
    }
    
    if (skinPixels.length < 50) return null;
    
    // Calculate bounding box of skin pixels
    const minX = Math.min(...skinPixels.map(p => p.x));
    const maxX = Math.max(...skinPixels.map(p => p.x));
    const minY = Math.min(...skinPixels.map(p => p.y));
    const maxY = Math.max(...skinPixels.map(p => p.y));
    
    // Calculate center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Estimate eye position (upper third of face)
    const eyeY = minY + (maxY - minY) * 0.35;
    
    return {
      x: centerX,
      y: centerY,
      eyeY: eyeY,
      width: maxX - minX,
      height: maxY - minY,
      confidence: skinPixels.length / (width * height / 16)
    };
  }

  estimateGaze(facePosition) {
    // Estimate gaze based on head position
    // This is a simplified version - real eye tracking would use pupil position
    
    const canvasHeight = this.canvas.height;
    
    // Normalize face Y position (0 = top, 1 = bottom)
    const faceY = facePosition.eyeY / canvasHeight;
    
    // Head tilt estimation (simplified)
    const headTilt = (facePosition.y - facePosition.eyeY) / facePosition.height;
    
    // Combine for gaze estimation
    let estimatedGazeY = faceY + headTilt * 0.2;
    
    // Smooth the gaze position
    const smoothingFactor = 0.1;
    this.smoothedGazeY += (estimatedGazeY - this.smoothedGazeY) * smoothingFactor;
    this.gazeY = this.smoothedGazeY;
  }

  updateGazeIndicator() {
    if (!this.gazeIndicator) return;
    
    const viewportHeight = window.innerHeight;
    const indicatorY = this.gazeY * viewportHeight;
    
    this.gazeIndicator.style.top = `${indicatorY}px`;
    this.gazeIndicator.style.left = '50%';
    this.gazeIndicator.style.transform = 'translateX(-50%)';
  }

  controlScroll() {
    const zoneTop = this.readingZone.top;
    const zoneBottom = this.readingZone.bottom;
    
    // Determine scroll direction based on gaze position
    if (this.gazeY < zoneTop) {
      // Looking above reading zone - scroll up
      this.targetScrollSpeed = -5 * (zoneTop - this.gazeY) / zoneTop;
    } else if (this.gazeY > zoneBottom) {
      // Looking below reading zone - scroll down
      this.targetScrollSpeed = 5 * (this.gazeY - zoneBottom) / (1 - zoneBottom);
    } else {
      // In reading zone - stop scrolling
      this.targetScrollSpeed = 0;
    }
    
    // Smooth scroll speed transition
    this.scrollSpeed += (this.targetScrollSpeed - this.scrollSpeed) * 0.1;
    
    // Apply scroll
    if (Math.abs(this.scrollSpeed) > 0.5) {
      window.scrollBy(0, this.scrollSpeed);
    }
  }

  drawDebugOverlay(facePosition) {
    if (!facePosition) return;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw video frame
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // Draw face bounding box
    this.ctx.strokeStyle = '#00ff00';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      facePosition.x - facePosition.width / 2,
      facePosition.y - facePosition.height / 2,
      facePosition.width,
      facePosition.height
    );
    
    // Draw eye position
    this.ctx.fillStyle = '#ff0000';
    this.ctx.beginPath();
    this.ctx.arc(facePosition.x, facePosition.eyeY, 5, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw gaze direction
    this.ctx.strokeStyle = '#ffff00';
    this.ctx.beginPath();
    this.ctx.moveTo(facePosition.x, facePosition.eyeY);
    this.ctx.lineTo(
      facePosition.x,
      facePosition.eyeY + (this.gazeY - 0.5) * 100
    );
    this.ctx.stroke();
  }

  updateStatus(text) {
    const statusText = this.trackingOverlay?.querySelector('.eye-status-text');
    if (statusText) {
      statusText.textContent = text;
    }
  }

  calibrate() {
    // Simple calibration - user looks at different points
    this.calibrationPoints = [];
    this.isCalibrated = false;
    
    // Show calibration UI
    const calibrationUI = document.createElement('div');
    calibrationUI.id = 'setu-calibration';
    calibrationUI.innerHTML = `
      <div class="calibration-point" style="top: 20%; left: 50%;"></div>
      <div class="calibration-instruction">Look at the dot and click</div>
    `;
    document.body.appendChild(calibrationUI);
    
    // Handle calibration clicks
    const points = [
      { y: 0.2 }, { y: 0.5 }, { y: 0.8 }
    ];
    let currentPoint = 0;
    
    calibrationUI.addEventListener('click', () => {
      if (this.lastFacePosition) {
        this.calibrationPoints.push({
          screenY: points[currentPoint].y,
          faceY: this.lastFacePosition.eyeY
        });
      }
      
      currentPoint++;
      if (currentPoint >= points.length) {
        this.isCalibrated = true;
        calibrationUI.remove();
        this.updateStatus('Calibration complete');
      } else {
        const dot = calibrationUI.querySelector('.calibration-point');
        dot.style.top = `${points[currentPoint].y * 100}%`;
      }
    });
  }
}

// Make available globally
window.EyeTracker = EyeTracker;
