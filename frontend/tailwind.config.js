/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest. Used via bg-ink-900 etc.
        ink: {
          950: '#070b16',
          900: '#0b1020',
          800: '#111830',
          700: '#18203e',
          600: '#222c52',
          500: '#2e3a68'
        },
        // Primary accent — periwinkle. Calm, high contrast on ink.
        iris: {
          50: '#eef0ff',
          200: '#c5cbff',
          300: '#a6b0ff',
          400: '#8b97ff',
          500: '#7c8cff',
          600: '#5f6ce6',
          700: '#4a54bd'
        },
        // Secondary accent — signals success, active state, live data.
        mint: {
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a'
        },
        sun: { 400: '#fbbf24', 500: '#f59e0b' },
        rose: { 400: '#fb7185', 500: '#f43f5e' },
        // Per-branch mind map palette, checked for contrast on ink-800.
        branch: {
          1: '#7c8cff',
          2: '#4ade80',
          3: '#fbbf24',
          4: '#f472b6',
          5: '#38bdf8',
          6: '#c084fc'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        dyslexic: ['OpenDyslexic', 'Comic Sans MS', 'Verdana', 'sans-serif']
      },
      borderRadius: { xl: '0.85rem', '2xl': '1.15rem', '3xl': '1.6rem' },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.28), 0 8px 26px -8px rgba(0,0,0,.5)',
        lift: '0 18px 48px -14px rgba(0,0,0,.66)',
        glow: '0 0 0 1px rgba(124,140,255,.4), 0 0 26px -6px rgba(124,140,255,.5)'
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        breathe: { '0%,100%': { opacity: 0.45 }, '50%': { opacity: 1 } },
        dash: { to: { strokeDashoffset: 0 } }
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.2,.7,.3,1) both',
        breathe: 'breathe 2.4s ease-in-out infinite',
        dash: 'dash .7s ease-out both'
      }
    }
  },
  plugins: []
};
