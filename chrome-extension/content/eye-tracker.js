/**
 * Gaze Scroll — hands-free scrolling driven by head position.
 *
 * Honest description of the technique: this tracks *head position*, not pupil
 * gaze. Tilt or move your head down and the page scrolls down; move it back up
 * and the page scrolls up; hold still and the page holds still. That is
 * achievable without shipping a multi-megabyte CV model, and the UI says so
 * rather than implying medical-grade eye tracking.
 *
 * Video never leaves the machine: frames are read into a canvas and discarded.
 *
 * The previous version was unusable for three separate reasons, and all three
 * had to be fixed before any of it worked:
 *
 *  1. It averaged every skin-coloured pixel in the frame. Hands, neck, a wooden
 *     door, and warm lighting all pulled on that average, so the signal barely
 *     moved when the head did. This finds the face *band* — the longest run of
 *     rows that actually look like a face — and ignores everything else.
 *  2. It smoothed with a fixed coefficient, which forces a choice between
 *     jitter when still and lag when moving. A one-euro filter adapts: heavy
 *     smoothing at rest, light smoothing during real movement. This is what
 *     makes "when I'm still, the page is still" true rather than aspirational.
 *  3. Velocity was measured in pixels per *frame* and fed to `scrollBy` as a
 *     fraction, so it ran at double speed on a 120Hz display and rounded to
 *     zero at slow speeds. It is now pixels per second, integrated against real
 *     elapsed time, through the shared scroll arbiter that carries the
 *     remainder — and that arbiter is also why it now works inside Focus Mode.
 */

(() => {
  const { Feature, UI, Store, Scroll, Dock, icon } = window.SETU;

  /** Detector resolution. Small on purpose — this runs next to a live page. */
  const SAMPLE_W = 80;
  const SAMPLE_H = 60;

  /** Detection rate. 60fps of getImageData buys nothing a head can express. */
  const DETECT_HZ = 24;

  /** Neutral-relative drift, as a fraction of frame height. */
  const DEADZONE = 0.045;
  const FULL_TILT = 0.16;

  /** Peak scroll speed in CSS pixels per second, before sensitivity. */
  const MAX_SPEED = 820;

  /** How long drift must stay outside the deadzone before scrolling starts. */
  const DWELL_MS = 130;

  /** How long the head must sit inside the deadzone before neutral re-centres. */
  const RECENTRE_AFTER_MS = 2200;

  /* ---------------------------------------------------------------------- */
  /* One-euro filter                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Adaptive low-pass filter.
   *
   * The whole problem with a fixed smoothing coefficient is that jitter and
   * intent look identical to it. This one widens its own bandwidth in
   * proportion to how fast the signal is genuinely changing, so a still head
   * is filtered hard (no creep) and a deliberate movement is barely filtered
   * at all (no lag).
   *
   * Casiez, Roussel & Vogel, CHI 2012.
   */
  class OneEuro {
    constructor({ minCutoff = 0.55, beta = 0.4, dCutoff = 1 } = {}) {
      this.minCutoff = minCutoff;
      this.beta = beta;
      this.dCutoff = dCutoff;
      this.x = null;
      this.dx = 0;
      this.at = 0;
    }

    static alpha(cutoff, dt) {
      const tau = 1 / (2 * Math.PI * cutoff);
      return 1 / (1 + tau / dt);
    }

    reset(value = null) {
      this.x = value;
      this.dx = 0;
      this.at = 0;
    }

    filter(value, now) {
      if (this.x === null) {
        this.x = value;
        this.at = now;
        return value;
      }

      const dt = Math.max(1 / 120, (now - this.at) / 1000);
      this.at = now;

      const rawDx = (value - this.x) / dt;
      this.dx = this.dx + OneEuro.alpha(this.dCutoff, dt) * (rawDx - this.dx);

      const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
      this.x = this.x + OneEuro.alpha(cutoff, dt) * (value - this.x);
      return this.x;
    }
  }

  /* ---------------------------------------------------------------------- */

  class GazeScroll extends Feature {
    static key = 'eye';

    constructor() {
      super();
      this.stream = null;
      this.video = null;
      this.canvas = null;
      this.ctx = null;

      this.filter = new OneEuro();
      this.headY = 0.5;
      this.neutralY = 0.5;
      this.confidence = 0;

      this.calibrated = false;
      this.velocity = 0;
      this.lastFrame = 0;
      this.lastDetect = 0;
      this.outsideSince = 0;
      this.insideSince = 0;
      this.paused = false;
      this.resumeTimer = null;
    }

    async onEnable() {
      this.build();

      // Registered before the camera is requested, so a stream that arrives
      // after a failure elsewhere is still shut down.
      this.cleanup(() => {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
      });

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This page does not allow camera access.');
        }
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
          audio: false
        });
      } catch (error) {
        // Throwing (rather than quietly clearing `enabled`) is what lets the
        // base class roll the whole feature back. The old code left a panel on
        // the page whose own close button could no longer tear it down.
        throw new Error(this.explainCameraFailure(error));
      }

      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});

      this.applySettings();
      this.bind();

      this.setStatus('Sit as you normally read, and hold still for a moment.', 'info');
      this.lastFrame = performance.now();
      this.loop((now) => this.tick(now));

      // Calibrate itself rather than demanding a button press first. The
      // manual control stays for anyone who moves before it settles.
      this.autoCalibrateAt = performance.now() + 1400;
    }

    onDisable() {
      clearTimeout(this.resumeTimer);
      this.releaseDock?.();
      this.releaseDock = null;
      UI.destroyHost('gaze');
      Scroll.reset();
      this.calibrated = false;
      this.confidence = 0;
      this.velocity = 0;
      this.scope = null;
    }

    onSettings() {
      this.applySettings();
    }

    applySettings() {
      this.sensitivity = Math.max(0.3, Math.min(2.5, Store.getSetting('gazeSensitivity') || 1));
      this.invert = Boolean(Store.getSetting('gazeInvert'));

      const slider = this.scope?.querySelector('[data-act="sensitivity"]');
      if (slider) slider.value = String(Math.round(this.sensitivity * 10));
      const readout = this.scope?.querySelector('.sens-value');
      if (readout) readout.textContent = `${this.sensitivity.toFixed(1)}×`;
      const invert = this.scope?.querySelector('[data-act="invert"]');
      if (invert) invert.setAttribute('aria-pressed', String(this.invert));
    }

    /**
     * Turn a getUserMedia rejection into something the user can act on.
     * "NotAllowedError" is not an instruction.
     */
    explainCameraFailure(error) {
      switch (error.name) {
        case 'NotAllowedError':
          return 'Camera access was blocked. Allow the camera for this site in the address bar, then turn Gaze Scroll on again.';
        case 'NotFoundError':
        case 'OverconstrainedError':
          return 'No camera was found on this device, so Gaze Scroll cannot run.';
        case 'NotReadableError':
          return 'The camera is already in use by another app. Close it and try again.';
        case 'SecurityError':
          return 'This site does not permit camera access, so Gaze Scroll cannot run here.';
        default:
          return `Gaze Scroll could not start the camera: ${error.message}`;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Detection                                                          */
    /* ------------------------------------------------------------------ */

    /**
     * Locate the face and return its vertical centre as a 0..1 fraction,
     * or null when there is no face to be found.
     *
     * Works on the *row profile* rather than on individual pixels. Counting
     * skin-like pixels per row and then taking the longest contiguous run of
     * well-populated rows finds the head and rejects almost everything else: a
     * hand at the edge of frame occupies too few rows, a wooden background
     * occupies too many, and neither forms a band of the right size in the
     * right place. A plain centroid could not tell any of them apart.
     */
    detectHead() {
      if (!this.video || this.video.readyState < 2) return null;

      this.ctx.drawImage(this.video, 0, 0, SAMPLE_W, SAMPLE_H);
      let frame;
      try {
        frame = this.ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
      } catch (_) {
        // A cross-origin frame taints the canvas. Nothing to be done here.
        return null;
      }

      const { data } = frame;
      const rows = new Uint16Array(SAMPLE_H);
      let total = 0;

      for (let y = 0; y < SAMPLE_H; y += 1) {
        let count = 0;
        for (let x = 0; x < SAMPLE_W; x += 1) {
          const i = (y * SAMPLE_W + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // YCbCr, not RGB. The chroma plane separates skin from lighting far
          // better than raw channel comparisons, which is why this survives a
          // warm lamp or a dim room where the old RGB envelope did not.
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luma < 45 || luma > 245) continue;

          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

          if (cb >= 77 && cb <= 130 && cr >= 133 && cr <= 177) count += 1;
        }
        rows[y] = count;
        total += count;
      }

      // Nothing, or the camera is looking at a wall of skin tone.
      const fraction = total / (SAMPLE_W * SAMPLE_H);
      if (fraction < 0.012 || fraction > 0.62) return null;

      // Longest contiguous run of rows carrying a plausible amount of face.
      const threshold = Math.max(3, SAMPLE_W * 0.1);
      let bestStart = -1;
      let bestLength = 0;
      let runStart = -1;

      for (let y = 0; y <= SAMPLE_H; y += 1) {
        const populated = y < SAMPLE_H && rows[y] >= threshold;
        if (populated && runStart === -1) {
          runStart = y;
        } else if (!populated && runStart !== -1) {
          const length = y - runStart;
          if (length > bestLength) {
            bestLength = length;
            bestStart = runStart;
          }
          runStart = -1;
        }
      }

      // A band that is a few rows tall is noise; one that fills the frame is
      // the background, not a head.
      if (bestLength < SAMPLE_H * 0.08 || bestLength > SAMPLE_H * 0.85) return null;

      // Weighted centre within the band, so the estimate moves smoothly rather
      // than jumping a whole row at a time.
      let weight = 0;
      let sum = 0;
      for (let y = bestStart; y < bestStart + bestLength; y += 1) {
        weight += rows[y];
        sum += rows[y] * y;
      }
      if (!weight) return null;

      this.confidence = Math.min(1, bestLength / (SAMPLE_H * 0.45));
      return sum / weight / SAMPLE_H;
    }

    /* ------------------------------------------------------------------ */
    /* Control loop                                                       */
    /* ------------------------------------------------------------------ */

    tick(now) {
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;

      // Detection is throttled; the scroll integration is not, so movement
      // stays smooth at whatever rate the display actually runs.
      if (now - this.lastDetect >= 1000 / DETECT_HZ) {
        this.lastDetect = now;
        this.sample(now);
      }

      this.integrate(dt);
    }

    sample(now) {
      const raw = this.detectHead();

      if (raw === null) {
        this.confidence = 0;
        this.filter.reset();
        // Coast to a stop rather than stopping dead — a single dropped frame
        // during a blink should not feel like a jolt.
        this.velocity *= 0.82;
        this.outsideSince = 0;
        if (this.calibrated) this.setStatus('Face lost — move back into frame.', 'error');
        this.paint();
        return;
      }

      this.headY = this.filter.filter(raw, now);

      if (!this.calibrated) {
        if (this.autoCalibrateAt && now >= this.autoCalibrateAt) this.calibrate();
        this.paint();
        return;
      }

      const drift = this.headY - this.neutralY;
      const magnitude = Math.abs(drift);

      if (magnitude < DEADZONE) {
        this.outsideSince = 0;
        if (!this.insideSince) this.insideSince = now;

        // Slow posture drift is the single most common reason head tracking
        // "stops working" after a minute: the neutral point silently becomes
        // wrong and the page creeps. Re-centre once the head has genuinely
        // settled, so the rest position follows the reader.
        if (now - this.insideSince > RECENTRE_AFTER_MS) {
          this.neutralY += (this.headY - this.neutralY) * 0.06;
        }
        this.setStatus('Ready — tilt down to scroll, up to go back.', 'ok');
      } else {
        this.insideSince = 0;
        if (!this.outsideSince) this.outsideSince = now;
        this.setStatus(
          (drift > 0) !== this.invert ? 'Scrolling down…' : 'Scrolling back up…',
          'ok'
        );
      }

      this.paint();
    }

    /** Turn the current head position into motion. */
    integrate(dt) {
      let target = 0;

      if (this.calibrated && this.confidence > 0.15 && !this.paused) {
        const drift = this.headY - this.neutralY;
        const magnitude = Math.abs(drift);
        const dwelled = this.outsideSince && performance.now() - this.outsideSince >= DWELL_MS;

        if (magnitude >= DEADZONE && dwelled) {
          // Squared response: small movements stay gentle and controllable,
          // and only a deliberate tilt reaches full speed.
          const reach = Math.min(1, (magnitude - DEADZONE) / (FULL_TILT - DEADZONE));
          const speed = reach * reach * MAX_SPEED * this.sensitivity;
          const direction = Math.sign(drift) * (this.invert ? -1 : 1);
          target = speed * direction;
        }
      }

      // Exponential approach, framed in real time so it feels identical on a
      // 60Hz and a 144Hz display.
      const responsiveness = 1 - Math.exp(-dt / 0.14);
      this.velocity += (target - this.velocity) * responsiveness;

      if (Math.abs(this.velocity) < 1.5) {
        // Snap to a genuine stop. Left to decay asymptotically, the page
        // creeps for several seconds after the reader has stopped moving —
        // which is exactly the complaint this feature exists to avoid.
        this.velocity = 0;
        Scroll.reset();
        return;
      }

      const moved = Scroll.by(this.velocity * dt);

      // A zero here usually means the sub-pixel carry has not yet reached a
      // whole pixel, which is the normal state at moderate speeds — at 45px/s
      // and 60fps each frame only asks for 0.75px. Treating that as "the page
      // will not move" zeroed the velocity every time it climbed past the
      // threshold, so the scroll ramped up and stalled, forever, without ever
      // moving. Only the real limit ends a run.
      if (moved === 0) {
        const atEnd =
          this.velocity > 0 ? Scroll.position() >= Scroll.max() - 1 : Scroll.position() <= 0;
        if (atEnd) {
          this.velocity = 0;
          Scroll.reset();
        }
      }
    }

    calibrate() {
      this.autoCalibrateAt = 0;

      if (this.confidence <= 0.15) {
        this.setStatus('No face detected yet. Make sure your face is lit and centred.', 'error');
        return;
      }

      this.neutralY = this.headY;
      this.calibrated = true;
      this.insideSince = 0;
      this.outsideSince = 0;
      this.velocity = 0;
      Scroll.reset();
      this.setStatus('Calibrated. Tilt your head down to scroll, up to go back.', 'ok');
      UI.toast('Gaze Scroll calibrated', { tone: 'success' });
    }

    /**
     * Manual scrolling wins.
     *
     * If the reader reaches for the wheel, they want to be somewhere specific,
     * and fighting them for the scroll position is worse than doing nothing.
     */
    bind() {
      const nudge = () => {
        this.paused = true;
        this.velocity = 0;
        Scroll.reset();
        clearTimeout(this.resumeTimer);
        this.resumeTimer = setTimeout(() => {
          this.paused = false;
          // Wherever they have settled is the new rest position.
          this.insideSince = performance.now();
        }, 1500);
      };

      this.listen(window, 'wheel', nudge, { passive: true });
      this.listen(window, 'touchstart', nudge, { passive: true });

      // A hidden tab still runs its rAF loop at a reduced rate on some
      // platforms; scrolling a page nobody is looking at is never wanted.
      this.listen(document, 'visibilitychange', () => {
        this.paused = document.visibilityState !== 'visible';
        if (this.paused) {
          this.velocity = 0;
          Scroll.reset();
        }
      });
    }

    /* ------------------------------------------------------------------ */
    /* Panel                                                              */
    /* ------------------------------------------------------------------ */

    build() {
      const root = UI.host('gaze', { layer: 'control' });

      const style = document.createElement('style');
      style.textContent = `
        .panel {
          position: fixed; width: 232px;
          padding: 12px; background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--radius-lg);
          box-shadow: var(--shadow); font-family: var(--font); color: var(--text);
        }
        .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
        .title { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--accent-700); }
        .close {
          background:none; border:1px solid transparent; color:var(--text-dim);
          cursor:pointer; padding:3px; border-radius:var(--radius); display:grid; place-items:center;
        }
        .close:hover { color:var(--accent-2-700); background:var(--accent-2-100); border-color:var(--accent-2); }
        .close:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

        .stage { position:relative; border-radius:var(--radius); overflow:hidden; background:#000; aspect-ratio:4/3; }
        video { width:100%; height:100%; object-fit:cover; transform:scaleX(-1); display:block; }
        .neutral {
          position:absolute; left:0; right:0; height:0;
          border-top:1px dashed rgba(255,255,255,.5); pointer-events:none;
        }
        .zone {
          position:absolute; left:0; right:0; pointer-events:none;
          background: color-mix(in srgb, var(--accent) 20%, transparent);
          border-top:1px solid color-mix(in srgb, var(--accent) 55%, transparent);
          border-bottom:1px solid color-mix(in srgb, var(--accent) 55%, transparent);
        }
        .reticle {
          position:absolute; left:6%; right:6%; height:2px;
          background:var(--accent-2); box-shadow:0 0 9px var(--accent-2);
          pointer-events:none;
        }
        .lost {
          position:absolute; inset:0; display:none; place-items:center;
          background:rgba(0,0,0,.55); color:#fff; font-size:12px; font-weight:700;
        }
        .stage[data-lost="true"] .lost { display:grid; }

        .status { margin-top:9px; font-size:11.5px; line-height:1.45; color:var(--text-dim); min-height:32px; }
        .status[data-tone="error"] { color:var(--danger); }
        .status[data-tone="ok"] { color:var(--accent-700); }

        .speed { height:4px; background:var(--bg); border-radius:3px; overflow:hidden; margin-top:8px; position:relative; }
        .speed-fill {
          position:absolute; top:0; bottom:0; left:50%; width:0;
          background:var(--accent-2); transition:none;
        }
        .speed-mid { position:absolute; top:0; bottom:0; left:50%; width:1px; background:var(--border); }

        .row { display:flex; gap:6px; margin-top:9px; align-items:center; }
        .row .setu-btn { flex:1; min-height:32px; font-size:12px; padding:6px 8px; }
        .toggle {
          display:inline-flex; align-items:center; gap:5px; flex-shrink:0;
          border:1px solid var(--border); border-radius:999px; padding:4px 10px;
          background:transparent; color:var(--text-dim); cursor:pointer;
          font-family:var(--font); font-size:11px; font-weight:700;
        }
        .toggle[aria-pressed="true"] { background:var(--accent-100); border-color:var(--accent); color:var(--accent-900); }
        .toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

        .sens { margin-top:10px; }
        .sens-head { display:flex; justify-content:space-between; font-size:11px; color:var(--text-dim); margin-bottom:4px; }
        .sens-value { font-weight:700; color:var(--text); font-variant-numeric:tabular-nums; }
        input[type="range"] { width:100%; accent-color: var(--accent); }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="panel" role="region" aria-label="Gaze scroll">
          <div class="head">
            <span class="title">GAZE SCROLL</span>
            <button class="close" aria-label="Close gaze scroll">${icon('x', { size: 16 })}</button>
          </div>
          <div class="stage" data-lost="false">
            <video playsinline muted></video>
            <div class="zone"></div>
            <div class="neutral"></div>
            <div class="reticle" style="top:50%"></div>
            <div class="lost">no face in frame</div>
          </div>
          <div class="speed"><div class="speed-mid"></div><div class="speed-fill"></div></div>
          <p class="status" role="status" aria-live="polite"></p>
          <div class="row">
            <button class="setu-btn" data-variant="primary" data-act="calibrate">Recalibrate</button>
            <button class="toggle" data-act="invert" aria-pressed="false" title="Swap which way your head scrolls the page">Invert</button>
          </div>
          <div class="sens">
            <div class="sens-head"><span>Sensitivity</span><span class="sens-value">1.0×</span></div>
            <input type="range" data-act="sensitivity" min="3" max="25" step="1" value="10"
                   aria-label="Gaze scroll sensitivity" />
          </div>
        </div>
      `;
      root.appendChild(scope);

      this.scope = scope;
      this.video = scope.querySelector('video');
      this.reticle = scope.querySelector('.reticle');
      this.zone = scope.querySelector('.zone');
      this.neutralLine = scope.querySelector('.neutral');
      this.speedFill = scope.querySelector('.speed-fill');
      this.stage = scope.querySelector('.stage');

      this.canvas = document.createElement('canvas');
      this.canvas.width = SAMPLE_W;
      this.canvas.height = SAMPLE_H;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      scope.querySelector('.close').onclick = () => window.setuLens?.toggle('eye', false);
      scope.querySelector('[data-act="calibrate"]').onclick = () => this.calibrate();

      scope.querySelector('[data-act="invert"]').onclick = (event) => {
        const next = event.currentTarget.getAttribute('aria-pressed') !== 'true';
        event.currentTarget.setAttribute('aria-pressed', String(next));
        this.invert = next;
        Store.set({ settings: { gazeInvert: next } });
      };

      scope.querySelector('[data-act="sensitivity"]').addEventListener('input', (event) => {
        this.sensitivity = Number(event.target.value) / 10;
        const readout = scope.querySelector('.sens-value');
        if (readout) readout.textContent = `${this.sensitivity.toFixed(1)}×`;
      });
      scope.querySelector('[data-act="sensitivity"]').addEventListener('change', (event) => {
        Store.set({ settings: { gazeSensitivity: Number(event.target.value) / 10 } });
      });

      const panel = scope.querySelector('.panel');
      this.releaseDock = Dock.register('gaze', 'top-right', panel);
      Dock.observe(panel);
    }

    setStatus(message, tone = 'info') {
      const el = this.scope?.querySelector('.status');
      if (!el || el.textContent === message) return;
      el.textContent = message;
      el.dataset.tone = tone;
    }

    /**
     * Draw where the head is against where neutral is.
     *
     * The band is the deadzone made visible. Without it, "hold still" is an
     * instruction with no feedback — the reader cannot tell whether they are
     * inside the tolerance or one twitch away from the page moving.
     */
    paint() {
      if (!this.scope) return;

      const lost = this.confidence <= 0.15;
      this.stage.dataset.lost = String(lost);

      if (!lost) {
        this.reticle.style.top = `${(this.headY * 100).toFixed(1)}%`;
      }

      const neutralPct = this.neutralY * 100;
      this.neutralLine.style.top = `${neutralPct.toFixed(1)}%`;
      this.zone.style.top = `${(neutralPct - DEADZONE * 100).toFixed(1)}%`;
      this.zone.style.height = `${(DEADZONE * 200).toFixed(1)}%`;
      this.zone.style.display = this.calibrated ? 'block' : 'none';
      this.neutralLine.style.display = this.calibrated ? 'block' : 'none';

      // Speed bar grows out from the centre, in the direction of travel.
      const fraction = Math.max(-1, Math.min(1, this.velocity / MAX_SPEED));
      const width = Math.abs(fraction) * 50;
      this.speedFill.style.width = `${width}%`;
      this.speedFill.style.left = fraction >= 0 ? '50%' : `${50 - width}%`;
    }
  }

  window.SETU.features.set('eye', GazeScroll);
})();
