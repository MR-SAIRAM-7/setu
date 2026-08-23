/**
 * SETU — Deployment Configuration.
 * ================================
 *
 * THIS IS THE ONE FILE TO EDIT WHEN THE BACKEND OR WEB APP MOVES.
 *
 * It is loaded by the service worker (via importScripts), the popup, the
 * options page, and every content script, so there is a single source of truth
 * instead of four copies of a URL drifting apart.
 *
 * These are only the values a fresh install starts with. Users can override
 * both URLs at runtime from the options page, and doing so does not touch this
 * file — so a change here only reaches people who install fresh or who have
 * never edited their own settings. Ship a new version when you change it.
 */

(() => {
  const DEFAULTS = {
    /**
     * SETU engine (backend) base URL. No trailing slash.
     * Change this and `sanctuaryUrl` below when either service is redeployed.
     */
    apiHost: 'https://setu-37hl.onrender.com',

    /** SETU Sanctuary web app base URL. No trailing slash. */
    sanctuaryUrl: 'https://setu-amber.vercel.app',

    /**
     * How long to wait on an engine call before giving up.
     *
     * Deliberately generous. Two things stack here: the planner runs on
     * free-tier models that routinely take 30-45 seconds on a cold call, and
     * the engine itself sleeps after inactivity on a free hosting tier, which
     * adds up to a minute to the first request that wakes it. A timeout
     * shorter than that is just a guaranteed failure. The UI shows elapsed
     * time and a cancel button so the wait is legible rather than silent.
     */
    requestTimeoutMs: 120000,

    /**
     * Budget for calls that must feel interactive.
     *
     * The generous budget above exists for the planner, which genuinely needs
     * it. Applying the same budget to a one-paragraph explanation means a
     * wedged provider holds the panel hostage for two minutes before anything
     * else is tried. Interactive calls give up sooner and fall back — to the
     * streaming path, to the cache, or to the in-page engine — which is always
     * better than a longer silence.
     */
    fastTimeoutMs: 25000,

    /**
     * How often the service worker pokes the engine to keep it from
     * hibernating, in minutes.
     *
     * The free host sleeps after ~15 minutes idle and takes 30-60 seconds to
     * come back — a cost paid by the user's *first* request, which is the one
     * that most needs to be fast. A cheap GET every ten minutes while the
     * browser is open removes that cost entirely.
     */
    keepWarmMinutes: 10,

    /**
     * Budget for the status probe when the engine is expected to be awake.
     * Short, because this one runs on every popup open and must feel instant.
     */
    healthTimeoutMs: 6000,

    /**
     * Budget for the second probe, after the quick one fails.
     *
     * A sleeping free-tier instance takes roughly 30-60 seconds to come back.
     * Without this the popup would report "offline" for a service that is
     * merely asleep, and the user would go looking for a fault that is not
     * there.
     */
    wakeTimeoutMs: 75000
  };

  // Works in a service worker (self), a page (window), and a content script.
  const scope = typeof self !== 'undefined' ? self : globalThis;
  scope.SETU_DEFAULTS = DEFAULTS;

  /**
   * Paint the popup / options page in the chosen palette.
   *
   * `auto` is resolved here rather than with a CSS media query, so each
   * stylesheet needs one dark block instead of two and there is a single place
   * that decides. Light is the default — the Sanctuary web app is light unless
   * someone picks the velvet theme, and a dark OS must not silently override
   * the reading surface the user actually chose.
   *
   * Returns the resolved value, and keeps following the OS while set to `auto`.
   */
  scope.setuApplyAppearance = function setuApplyAppearance(chosen) {
    const root = document.documentElement;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');

    const resolve = () =>
      chosen === 'dark' ? 'dark' : chosen === 'auto' && media?.matches ? 'dark' : 'light';

    const paint = () => {
      root.dataset.appearance = resolve();
    };

    paint();

    // Re-bind rather than stack: the setting can change several times a session.
    if (media && scope.__setuAppearanceListener) {
      media.removeEventListener?.('change', scope.__setuAppearanceListener);
    }
    if (media && chosen === 'auto') {
      scope.__setuAppearanceListener = paint;
      media.addEventListener?.('change', paint);
    }

    return root.dataset.appearance;
  };
})();
