/**
 * Gaze Scroll — hands-free scrolling driven by the webcam.
 *
 * Honest description of the technique: this tracks *head position*, not true
 * pupil gaze. It locates the face by skin-tone density in the frame, tracks its
 * vertical centroid against a calibrated neutral point, and scrolls when the
 * user's head drifts down (as it does when reading toward the bottom of a page).
 * That is achievable without shipping a multi-megabyte CV model, and the UI says
 * so rather than implying medical-grade eye tracking.
 *
 * Video never leaves the machine: frames are read into a canvas and discarded.
 */

(() => {
  const { Feature, UI } = window.SETU;

  const SAMPLE_W = 96;
  const SAMPLE_H = 72;

  class GazeScroll extends Feature {
    static key = 'eye';

    constructor() {
      super();
      this.stream = null;
      this.video = null;
      this.canvas = null;
      this.ctx = null;
      this.neutralY = 0.5;
      this.smoothedY = 0.5;
      this.calibrated = false;
      this.velocity = 0;
      this.faceFound = false;
    }

    async onEnable() {
      this.build();

      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
          audio: false
        });
      } catch (error) {
        this.setStatus(
          error.name === 'NotAllowedError'
            ? 'Camera blocked. Allow camera access in the address bar, then turn this on again.'
            : `Camera unavailable: ${error.message}`,
          'error'
        );
        UI.toast('Gaze Scroll needs camera permission.', { tone: 'error', duration: 4200 });
        // Leave the panel up so the user can read why it failed, then bail.
        this.enabled = false;
        return;
      }

      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});

      this.cleanup(() => {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
      });

      this.setStatus('Look at the middle of your screen, then press Calibrate.', 'info');
      this.loop(() => this.tick());
      UI.toast('Gaze Scroll on — calibrate to begin', { tone: 'success' });
    }

    onDisable() {
      UI.destroyHost('gaze');
      this.calibrated = false;
    }

    /* ------------------------------------------------------------------ */

    build() {
      const root = UI.host('gaze', { layer: 'control', interactive: true });

      const style = document.createElement('style');
      style.textContent = `
        .panel {
          position: fixed; top: 20px; right: 20px; width: 224px;
          padding: 12px; background: var(--bg-soft);
          border: 1px solid var(--border); border-radius: var(--radius);
          box-shadow: var(--shadow); pointer-events: auto;
        }
        .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
        .title { font-size:11px; font-weight:800; letter-spacing:.07em; color:var(--accent); }
        .close { background:none; border:none; color:var(--text-dim); font-size:17px; cursor:pointer; line-height:1; }
        .close:hover { color:var(--danger); }
        .stage { position:relative; border-radius:9px; overflow:hidden; background:#000; aspect-ratio:4/3; }
        video { width:100%; height:100%; object-fit:cover; transform:scaleX(-1); display:block; }
        .reticle {
          position:absolute; left:8%; right:8%; height:2px;
          background:var(--accent-2); box-shadow:0 0 9px var(--accent-2);
          transition:top .1s linear;
        }
        .zone { position:absolute; left:0; right:0; border:1px dashed rgba(255,255,255,.28); pointer-events:none; }
        .status { margin-top:9px; font-size:11.5px; line-height:1.45; color:var(--text-dim); min-height:32px; }
        .status[data-tone="error"] { color:var(--danger); }
        .status[data-tone="ok"] { color:var(--accent-2); }
        .row { display:flex; gap:6px; margin-top:9px; }
        .row .setu-btn { flex:1; min-height:32px; font-size:12px; padding:6px 8px; }
        .meter { height:4px; background:var(--surface); border-radius:3px; overflow:hidden; margin-top:8px; }
        .meter-fill { height:100%; width:50%; background:var(--accent); transition:width .12s linear, background .2s ease; }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="panel" role="region" aria-label="Gaze scroll">
          <div class="head">
            <span class="title">GAZE SCROLL</span>
            <button class="close" aria-label="Close gaze scroll">×</button>
          </div>
          <div class="stage">
            <video playsinline muted></video>
            <div class="zone" style="top:62%; bottom:0;"></div>
            <div class="reticle" style="top:50%;"></div>
          </div>
          <div class="meter"><div class="meter-fill"></div></div>
          <p class="status" role="status" aria-live="polite"></p>
          <div class="row">
            <button class="setu-btn" data-variant="primary" data-act="calibrate">Calibrate</button>
          </div>
        </div>
      `;
      root.appendChild(scope);

      this.scope = scope;
      this.video = scope.querySelector('video');
      this.reticle = scope.querySelector('.reticle');
      this.meter = scope.querySelector('.meter-fill');

      this.canvas = document.createElement('canvas');
      this.canvas.width = SAMPLE_W;
      this.canvas.height = SAMPLE_H;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      scope.querySelector('.close').onclick = () => window.setuLens?.toggle('eye', false);
      scope.querySelector('[data-act="calibrate"]').onclick = () => this.calibrate();
    }

    setStatus(message, tone = 'info') {
      const el = this.scope?.querySelector('.status');
      if (el) {
        el.textContent = message;
        el.dataset.tone = tone;
      }
    }

    calibrate() {
      if (!this.faceFound) {
        this.setStatus('No face detected yet. Make sure your face is lit and centred.', 'error');
        return;
      }
      this.neutralY = this.smoothedY;
      this.calibrated = true;
      this.setStatus('Calibrated. Look toward the lower part of the screen to scroll down.', 'ok');
    }

    /**
     * Estimate the vertical centre of the face by weighting skin-tone pixels.
     * Cheap, dependency-free, and good enough for a coarse up/down signal.
     */
    detectFaceY() {
      if (!this.video || this.video.readyState < 2) return null;

      this.ctx.drawImage(this.video, 0, 0, SAMPLE_W, SAMPLE_H);
      const { data } = this.ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);

      let weightSum = 0;
      let ySum = 0;

      for (let y = 0; y < SAMPLE_H; y += 1) {
        for (let x = 0; x < SAMPLE_W; x += 1) {
          const i = (y * SAMPLE_W + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Standard RGB skin-tone envelope.
          const isSkin =
            r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            Math.max(r, g, b) - Math.min(r, g, b) > 15;

          if (isSkin) {
            weightSum += 1;
            ySum += y;
          }
        }
      }

      // Too few skin pixels means no face in frame.
      if (weightSum < SAMPLE_W * SAMPLE_H * 0.015) return null;
      return ySum / weightSum / SAMPLE_H;
    }

    tick() {
      const y = this.detectFaceY();
      this.faceFound = y !== null;

      if (!this.faceFound) {
        this.velocity *= 0.9;
        if (this.calibrated) this.setStatus('Face lost — move back into frame.', 'error');
        return;
      }

      // Heavy smoothing: raw centroid is jittery frame to frame.
      this.smoothedY = this.smoothedY * 0.82 + y * 0.18;

      this.reticle.style.top = `${(this.smoothedY * 100).toFixed(1)}%`;
      this.meter.style.width = `${(this.smoothedY * 100).toFixed(1)}%`;

      if (!this.calibrated) return;

      const drift = this.smoothedY - this.neutralY;
      const DEADZONE = 0.055;

      let target = 0;
      if (drift > DEADZONE) {
        target = Math.min(1, (drift - DEADZONE) / 0.18) * 9; // look down -> scroll down
      } else if (drift < -DEADZONE) {
        target = Math.max(-1, (drift + DEADZONE) / 0.18) * 6; // look up -> scroll back
      }

      this.velocity += (target - this.velocity) * 0.12;
      this.meter.style.background = Math.abs(this.velocity) > 0.4 ? 'var(--accent-2)' : 'var(--accent)';

      if (Math.abs(this.velocity) > 0.35) {
        window.scrollBy(0, this.velocity);
      }
    }
  }

  window.SETU.features.set('eye', GazeScroll);
})();
