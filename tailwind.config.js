/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    'btn-sm',
    'btn-md',
    'btn-lg',
    'btn-primary',
    'btn-secondary',
    'btn-ghost',
    'btn-outline',
    'btn-danger',
  ],
  theme: {
    extend: {
      colors: {
        // Restrained accent, used for links, focus and small highlights only.
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Neutral scale (zinc-based). DEFAULT is the primary text and button colour.
        ink: {
          DEFAULT: '#171717',
          900: '#18181b',
          800: '#27272a',
          700: '#3f3f46',
          600: '#52525b',
          500: '#6b6b70',
          400: '#a1a1aa',
          300: '#d4d4d8',
          200: '#e4e4e7',
          100: '#f4f4f5',
          50: '#fafafa',
        },
        night: { DEFAULT: '#0b0b0c', 800: '#141416', 700: '#1c1c1f', 600: '#2a2a2e' },
        line: '#ececec',
        ok: { 50: '#ecfdf3', 500: '#16a34a', 700: '#15803d' },
        warn: { 50: '#fffbeb', 500: '#d97706', 700: '#b45309' },
        bad: { 50: '#fef2f2', 500: '#dc2626', 700: '#b91c1c' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 2px 4px 0 rgba(0,0,0,.04), 0 22px 46px -22px rgba(0,0,0,.30)',
        soft: '0 1px 2px 0 rgba(0,0,0,.05)',
        paper: '0 2px 6px rgba(0,0,0,.06), 0 30px 60px -24px rgba(0,0,0,.35)',
        panel: '0 1px 2px rgba(0,0,0,.04), 0 10px 28px -16px rgba(0,0,0,.16)',
      },
      letterSpacing: { tightish: '-0.015em', display: '-0.025em' },
    },
  },
  plugins: [],
};
