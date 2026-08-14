/**
 * Reading Themes — typography and colour adjustments applied to the live page.
 *
 * Unlike the overlay features this must reach into the page's own cascade, so
 * it works by injecting one stylesheet and setting a data attribute on <html>.
 * Everything is scoped under that attribute and removed cleanly on disable.
 *
 * Care is taken not to restyle SETU's own hosts, form controls the user is
 * typing in, or code blocks where letter-spacing would corrupt alignment.
 */

(() => {
  const { Feature, UI, Store } = window.SETU;

  const THEMES = {
    default: null,
    sepia: { bg: '#f6ecd9', text: '#3b3226', link: '#8a5a1f', border: 'rgba(0,0,0,.14)' },
    dark: { bg: '#12151c', text: '#dfe3ea', link: '#8ab4ff', border: 'rgba(255,255,255,.12)' },
    contrast: { bg: '#000000', text: '#ffffff', link: '#ffe600', border: '#ffffff' },
    dyslexia: { bg: '#fffbf0', text: '#2b2b2b', link: '#0f5c8c', border: 'rgba(0,0,0,.18)', dyslexic: true },
    calm: { bg: '#eef4f2', text: '#26332f', link: '#0f6f5c', border: 'rgba(0,0,0,.12)' }
  };

  class ReadingTheme extends Feature {
    static key = 'dyslexia';

    constructor() {
      super();
      this.theme = 'dyslexia';
    }

    onEnable() {
      const stored = window.SETU.Store.get().theme;
      this.theme = stored && stored !== 'default' ? stored : 'dyslexia';
      this.apply(this.theme);
      UI.toast(`Reading theme: ${this.theme}`, { tone: 'success' });
    }

    onDisable() {
      this.clear();
    }

    /** Public entry point used by the popup's theme picker. */
    setTheme(theme) {
      this.theme = theme;
      if (theme === 'default') {
        this.clear();
        // A theme of "default" means the feature is effectively off.
        if (this.enabled) {
          this.enabled = false;
          this.runCleanups();
        }
        return;
      }
      if (!this.enabled) {
        this.enabled = true;
      }
      this.apply(theme);
    }

    clear() {
      document.getElementById('setu-theme-style')?.remove();
      document.documentElement.removeAttribute('data-setu-theme');
    }

    apply(themeName) {
      const theme = THEMES[themeName];
      if (!theme) {
        this.clear();
        return;
      }

      document.documentElement.setAttribute('data-setu-theme', themeName);

      let style = document.getElementById('setu-theme-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'setu-theme-style';
        style.setAttribute('data-setu', 'style');
        (document.head || document.documentElement).appendChild(style);
      }

      const settings = Store.get().settings;
      const fontStack = theme.dyslexic
        ? `"OpenDyslexic", "Comic Sans MS", "Trebuchet MS", Verdana, sans-serif`
        : `"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

      // `:not([data-setu])` keeps our own overlay hosts out of the cascade.
      style.textContent = `
        html[data-setu-theme="${themeName}"] {
          background: ${theme.bg} !important;
        }
        html[data-setu-theme="${themeName}"] body {
          background: ${theme.bg} !important;
          color: ${theme.text} !important;
        }
        html[data-setu-theme="${themeName}"] body *:not([data-setu]):not([data-setu] *):not(svg):not(svg *):not(pre):not(pre *):not(code) {
          background-color: transparent !important;
          color: ${theme.text} !important;
          border-color: ${theme.border} !important;
          font-family: ${fontStack} !important;
          letter-spacing: ${settings.letterSpacing ?? 0.02}em !important;
          word-spacing: .08em !important;
          text-shadow: none !important;
        }
        html[data-setu-theme="${themeName}"] body :where(p, li, dd, blockquote, td):not([data-setu] *) {
          line-height: 1.8 !important;
          max-width: 78ch;
        }
        html[data-setu-theme="${themeName}"] body :where(a, a *):not([data-setu] *) {
          color: ${theme.link} !important;
          text-decoration: underline !important;
          text-underline-offset: 3px !important;
        }
        html[data-setu-theme="${themeName}"] body :where(section, article, main, div, header, aside, nav, li, table):not([data-setu]):not([data-setu] *) {
          box-shadow: none !important;
          background-image: none !important;
        }
        html[data-setu-theme="${themeName}"] body :where(input, textarea, select):not([data-setu] *) {
          background: ${theme.bg} !important;
          color: ${theme.text} !important;
          border: 1px solid ${theme.border} !important;
        }
        html[data-setu-theme="${themeName}"] body :where(img, video, picture, canvas) {
          filter: ${themeName === 'contrast' ? 'contrast(1.15)' : 'none'};
        }
        /* Stop decorative motion — a common sensory trigger. */
        html[data-setu-theme="${themeName}"] body :where(marquee, blink, [class*="animate"]):not([data-setu] *) {
          animation: none !important;
        }
      `;

      this.cleanup(() => this.clear());
    }
  }

  window.SETU.features.set('dyslexia', ReadingTheme);
})();
