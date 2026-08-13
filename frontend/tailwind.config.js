/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        setu: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        sand: {
          50: '#fdfcfa',
          100: '#faf8f5',
          200: '#f5f0e8',
          300: '#e8dfd2',
          400: '#d4c5a9',
          500: '#b8a080',
          600: '#9a7e5c',
          700: '#7a6348',
          800: '#5c4a36',
          900: '#3d3125',
        },
        sage: {
          50: '#f4f9f4',
          100: '#e5f0e5',
          200: '#c8dec8',
          300: '#9ec49e',
          400: '#6ea36e',
          500: '#4a7c59',
          600: '#3a6347',
          700: '#2f4f3a',
          800: '#273f30',
          900: '#213428',
        },
        mode: {
          start: '#f59e0b',
          simplify: '#14b8a6',
          learn: '#3b82f6',
          meet: '#8b5cf6',
          practice: '#ec4899',
          write: '#22c55e',
          guide: '#f97316',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        dyslexic: ['OpenDyslexic', 'Comic Sans MS', 'sans-serif'],
        hyperlegible: ['Atkinson Hyperlegible', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 8px 24px -4px rgba(0, 0, 0, 0.06)',
        'elevated': '0 8px 24px -4px rgba(0, 0, 0, 0.1), 0 16px 40px -8px rgba(0, 0, 0, 0.08)',
        'glow-green': '0 0 20px -4px rgba(74, 124, 89, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'breathe': 'breathe 5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
