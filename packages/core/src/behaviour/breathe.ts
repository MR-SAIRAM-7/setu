import type { Intensity } from '../types';

/**
 * ⭐ THE BREATHE PROTOCOL (§34.3 / §42.2)
 *
 * Behavioural overwhelm detection. Every signal is computed from local pointer,
 * scroll and key events in a 30-second ring buffer. Nothing is stored. Nothing
 * is transmitted. No inference about the person is ever recorded.
 *
 * ETHICS RULES, HARD-CODED — these are not configuration, they are the feature:
 *   - Never fires in the first 20s on a page ("you look stressed" as a greeting).
 *   - Never more than once per 5 minutes, max 3 per hour.
 *   - Never while typing in a password field, or during video playback.
 *   - Two dismissals in a row drop sensitivity automatically.
 *   - Z-scores are against THIS user's own rolling baseline, never a population norm.
 *   - The word "detected" never appears in the UI. SETU comments on the PAGE
 *     ("this page looks intense"), never on the person. That wording distinction
 *     is the whole ethics of the feature.
 */

export interface BreatheConfig {
  sensitivity: Intensity;
  /** never fire twice inside this */
  cooldownMs: number;
  /** never fire in the first N ms on a page */
  minSessionMs: number;
  /** hard ceiling regardless of cooldown */
  maxPerHour: number;
}

export const DEFAULT_BREATHE: BreatheConfig = {
  sensitivity: 2,
  cooldownMs: 5 * 60_000,
  minSessionMs: 20_000,
  maxPerHour: 3,
};

export interface Signals {
  /** mean |d²position/dt²| of the pointer */
  jerk: number;
  /** direction changes per 10s */
  scrollReversals: number;
  /** clicks on the same target within 800ms */
  repeatClicks: number;
  /** starts and stops of activity */
  dwellFragments: number;
  /** scroll up then down over the same region */
  backtracks: number;
}

export const ZERO_SIGNALS: Signals = {
  jerk: 0,
  scrollReversals: 0,
  repeatClicks: 0,
  dwellFragments: 0,
  backtracks: 0,
};

const SIGNAL_KEYS: (keyof Signals)[] = [
  'jerk',
  'scrollReversals',
  'repeatClicks',
  'dwellFragments',
  'backtracks',
];

const WEIGHTS: Record<keyof Signals, number> = {
  jerk: 0.3,
  scrollReversals: 0.25,
  repeatClicks: 0.25,
  dwellFragments: 0.1,
  backtracks: 0.1,
};

/**
 * Welford's online mean/variance, per signal. Gives us a personal baseline
 * without storing any history — which is exactly the privacy property we want.
 */
export class RunningStats {
  private n = 0;
  private mean: Record<string, number> = {};
  private m2: Record<string, number> = {};

  update(s: Signals): Signals {
    this.n++;
    const z = { ...ZERO_SIGNALS };
    for (const k of SIGNAL_KEYS) {
      const x = s[k];
      const prevMean = this.mean[k] ?? 0;
      const delta = x - prevMean;
      const newMean = prevMean + delta / this.n;
      this.mean[k] = newMean;
      this.m2[k] = (this.m2[k] ?? 0) + delta * (x - newMean);

      // Need a real baseline before z-scores mean anything.
      if (this.n < 12) {
        z[k] = 0;
        continue;
      }
      const variance = (this.m2[k] ?? 0) / (this.n - 1);
      const sd = Math.sqrt(Math.max(variance, 1e-9));
      z[k] = (x - newMean) / sd;
    }
    return z;
  }

  get samples(): number {
    return this.n;
  }

  reset(): void {
    this.n = 0;
    this.mean = {};
    this.m2 = {};
  }
}

/** 0 = off (threshold Infinity, provably never fires). */
export const THRESHOLDS: Record<Intensity, number> = {
  0: Infinity,
  1: 2.6,
  2: 2.0,
  3: 1.5,
};

export interface BreatheState {
  ewma: number;
  armed: boolean;
  firesThisHour: number;
  lastFire: number;
}

export class BreatheDetector {
  private base = new RunningStats();
  private ewma = 0;
  private lastFire = 0;
  private armed = false;
  private fireTimes: number[] = [];
  private consecutiveDismissals = 0;
  private suspended = false;

  constructor(
    private cfg: BreatheConfig = { ...DEFAULT_BREATHE },
    private onFire: () => void = () => {},
  ) {}

  /** Called ~4×/second from a rAF-throttled listener. `now` is ms since page load. */
  tick(s: Signals, now: number): void {
    if (this.suspended) return;

    // Z-score each signal against THIS user's own baseline — not a population norm.
    const z = this.base.update(s);
    const raw = SIGNAL_KEYS.reduce((a, k) => a + WEIGHTS[k] * Math.max(0, z[k]), 0);

    // Exponentially weighted moving average: smooth out single spikes.
    this.ewma = 0.75 * this.ewma + 0.25 * raw;

    const thresh = THRESHOLDS[this.cfg.sensitivity];
    const release = thresh - 0.6; // hysteresis

    if (!this.armed && this.ewma > thresh) this.armed = true;
    if (this.armed && this.ewma < release) this.armed = false;

    if (!this.armed) return;
    if (now < this.cfg.minSessionMs) return;
    if (now - this.lastFire <= this.cfg.cooldownMs && this.lastFire !== 0) return;

    // max N per rolling hour
    const hourAgo = now - 3_600_000;
    this.fireTimes = this.fireTimes.filter((t) => t > hourAgo);
    if (this.fireTimes.length >= this.cfg.maxPerHour) return;

    this.lastFire = now;
    this.fireTimes.push(now);
    this.armed = false;
    this.ewma = 0;
    this.onFire();
  }

  /** Two dismissals in a row => the user is telling us we're wrong. Listen. */
  dismissed(): Intensity {
    this.consecutiveDismissals++;
    if (this.consecutiveDismissals >= 2) {
      this.cfg.sensitivity = Math.max(0, this.cfg.sensitivity - 1) as Intensity;
      this.consecutiveDismissals = 0;
    }
    return this.cfg.sensitivity;
  }

  accepted(): void {
    this.consecutiveDismissals = 0;
  }

  /** "Don't do this again" — off for this session; the caller persists it to DNA. */
  disable(): void {
    this.cfg.sensitivity = 0;
    this.suspended = true;
  }

  /**
   * Suspend during password entry and video playback. Both are states where an
   * overlay would be actively harmful, not merely annoying.
   */
  suspend(): void {
    this.suspended = true;
  }
  resume(): void {
    this.suspended = false;
  }

  setSensitivity(s: Intensity): void {
    this.cfg.sensitivity = s;
    this.suspended = s === 0;
  }

  /** Demo-day escape hatch (Risk #3): fire on command, bypassing every gate. */
  forceFire(): void {
    this.lastFire = Date.now();
    this.onFire();
  }

  get state(): BreatheState {
    return {
      ewma: this.ewma,
      armed: this.armed,
      firesThisHour: this.fireTimes.length,
      lastFire: this.lastFire,
    };
  }
}

/**
 * Turns raw browser events into `Signals`. Kept separate from the detector so
 * the detector is pure and testable without a DOM.
 */
export class SignalCollector {
  private positions: Array<{ x: number; y: number; t: number }> = [];
  private scrollDirs: Array<{ dir: number; y: number; t: number }> = [];
  private clicks: Array<{ target: unknown; t: number }> = [];
  private activity: number[] = [];
  private lastScrollY = 0;

  onPointer(x: number, y: number, t: number): void {
    this.positions.push({ x, y, t });
    if (this.positions.length > 90) this.positions.shift();
    this.markActivity(t);
  }

  onScroll(y: number, t: number): void {
    const dir = Math.sign(y - this.lastScrollY);
    this.lastScrollY = y;
    if (dir !== 0) {
      this.scrollDirs.push({ dir, y, t });
      if (this.scrollDirs.length > 60) this.scrollDirs.shift();
    }
    this.markActivity(t);
  }

  onClick(target: unknown, t: number): void {
    this.clicks.push({ target, t });
    if (this.clicks.length > 20) this.clicks.shift();
    this.markActivity(t);
  }

  private markActivity(t: number): void {
    const last = this.activity[this.activity.length - 1];
    if (last === undefined || t - last > 400) this.activity.push(t);
    if (this.activity.length > 60) this.activity.shift();
  }

  /** Drain the 30s ring buffer into a Signals snapshot. */
  sample(now: number): Signals {
    const win = 30_000;
    const recent = this.positions.filter((p) => now - p.t < win);

    // jerk = mean |second derivative of position|
    let jerk = 0;
    if (recent.length >= 3) {
      let sum = 0;
      let n = 0;
      for (let i = 2; i < recent.length; i++) {
        const a = recent[i - 2]!;
        const b = recent[i - 1]!;
        const c = recent[i]!;
        const dt1 = Math.max(1, b.t - a.t);
        const dt2 = Math.max(1, c.t - b.t);
        const v1x = (b.x - a.x) / dt1;
        const v1y = (b.y - a.y) / dt1;
        const v2x = (c.x - b.x) / dt2;
        const v2y = (c.y - b.y) / dt2;
        sum += Math.hypot(v2x - v1x, v2y - v1y);
        n++;
      }
      jerk = n ? (sum / n) * 1000 : 0;
    }

    const scrolls = this.scrollDirs.filter((s) => now - s.t < 10_000);
    let scrollReversals = 0;
    for (let i = 1; i < scrolls.length; i++) {
      if (scrolls[i]!.dir !== scrolls[i - 1]!.dir) scrollReversals++;
    }

    const recentClicks = this.clicks.filter((c) => now - c.t < win);
    let repeatClicks = 0;
    for (let i = 1; i < recentClicks.length; i++) {
      const prev = recentClicks[i - 1]!;
      const cur = recentClicks[i]!;
      if (cur.target === prev.target && cur.t - prev.t < 800) repeatClicks++;
    }

    const acts = this.activity.filter((t) => now - t < win);
    const dwellFragments = Math.max(0, acts.length - 1);

    // backtracks: revisiting a scroll position band already visited
    const bands = new Set<number>();
    let backtracks = 0;
    for (const s of scrolls) {
      const band = Math.round(s.y / 400);
      if (bands.has(band)) backtracks++;
      else bands.add(band);
    }

    return { jerk, scrollReversals, repeatClicks, dwellFragments, backtracks };
  }
}
