/**
 * Reading Themes — typography and colour adjustments applied to the live page.
 *
 * Implements Sanctuary's sensory palettes on arbitrary websites:
 * Sepia, Velvet Dark, Sage, Pastel, High Contrast AAA, Cream & Dyslexia.
 * Everything is scoped cleanly under [data-setu-theme] and cleanly removed on disable.
 */

(() => {
  const { Feature, UI, Store } = window.SETU;

  const THEMES = {
    sepia:    { name: 'Sepia', bg: '#f6ecd9', text: '#3b3226', link: '#8a5a1f', border: 'rgba(0,0,0,.14)' },
    dark:     { name: 'Velvet Dark', bg: '#18181a', text: '#f3f2f2', link: '#38bdf8', border: 'rgba(243,242,242,.15)' },
    contrast: { name: 'High Contrast AAA', bg: '#0d0d0d', text: '#ffffff', link: '#facc15', border: 'rgba(255,255,255,.25)' },
    dyslexia: { name: 'Dyslexia Friendly', bg: '#faf7ee', text: '#26231e', link: '#00779c', border: 'rgba(38,35,30,.15)', dyslexic: true },
    calm:     { name: 'Sage Calm', bg: '#f2f6f1', text: '#1c2b1d', link: '#15803d', border: 'rgba(28,43,29,.15)' },
    pastel:   { name: 'Pastel Blue', bg: '#f0f4f8', text: '#1e293b', link: '#0284c7', border: 'rgba(30,41,59,.14)' },
    cream:    { name: 'Warm Cream', bg: '#faf7ee', text: '#26231e', link: '#00779c', border: 'rgba(38,35,30,.15)' }
  };

  class ReadingTheme extends Feature {
    static key = 'theme';

    constructor() {
      super();
      this.theme = 'dyslexia';
    }

    onEnable() {
      this.apply(this.theme);
      this.cleanup(() => this.clear());
      const label = THEMES[this.theme]?.name || this.theme;
      UI.toast(`Reading theme: ${label}`, { tone: 'success' });
    }

    onDisable() {
      this.clear();
    }

    onSettings() {
      if (this.enabled) this.apply(this.theme);
    }

    /**
     * The single public entry point. `default` means "no theme", which is the
     * same thing as the feature being off.
     */
    applyTheme(name) {
      if (!name || name === 'default' || !THEMES[name]) {
        this.disable();
        return;
      }

      this.theme = name;
      if (this.enabled) this.apply(name);
      else this.enable();
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
      }
      (document.head || document.documentElement).appendChild(style);

      const settings = Store.get().settings;
      const letterSpacing = Number(settings.letterSpacing ?? 0.02);
      const lineHeight = Number(settings.lineHeight ?? 1.8);
      const fontStack = theme.dyslexic
        ? '"Atkinson Hyperlegible", "Lexend", "OpenDyslexic", system-ui, sans-serif'
        : '"Source Serif 4", Georgia, "Atkinson Hyperlegible", serif';

      const root = `html[data-setu-theme="${themeName}"]`;
      const notOurs = ':not([data-setu]):not([data-setu] *):not([data-setu-fix]):not([data-setu-bionic])';

      style.textContent = `
        ${root} { background: ${theme.bg} !important; }
        ${root} body { background: ${theme.bg} !important; color: ${theme.text} !important; }

        ${root} body *${notOurs}:not(svg):not(svg *):not(pre):not(pre *):not(code) {
          background-color: transparent !important;
          color: ${theme.text} !important;
          border-color: ${theme.border} !important;
          font-family: ${fontStack} !important;
          letter-spacing: ${letterSpacing}em !important;
          word-spacing: .08em !important;
          text-shadow: none !important;
        }

        /* Bionic anchors keep their weight; only the palette follows the theme. */
        ${root} body b[data-setu-fix] {
          color: ${theme.text} !important;
          font-weight: 800 !important;
          font-family: ${fontStack} !important;
        }

        ${root} body :where(p, li, dd, blockquote, td)${notOurs} {
          line-height: ${lineHeight} !important;
          max-width: 78ch;
        }
        ${root} body :where(a, a *)${notOurs} {
          color: ${theme.link} !important;
          text-decoration: underline !important;
          text-underline-offset: 3px !important;
        }
        ${root} body :where(section, article, main, div, header, aside, nav, li, table)${notOurs} {
          box-shadow: none !important;
          background-image: none !important;
        }
        ${root} body :where(input, textarea, select)${notOurs} {
          background: ${theme.bg} !important;
          color: ${theme.text} !important;
          border: 1px solid ${theme.border} !important;
        }
      `;
    }
  }

  window.SETU.features.set('theme', ReadingTheme);
})();
