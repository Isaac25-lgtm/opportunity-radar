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
        brand: {
          50: '#eaf4fe',
          100: '#d4e9fd',
          200: '#a9d3fb',
          300: '#73b8f7',
          400: '#3fa0f4',
          500: '#1a91f0',
          600: '#1170cd',
          700: '#0f5aa6',
          800: '#0d4580',
          900: '#0b3463',
        },
        ink: {
          DEFAULT: '#1e2532',
          700: '#303848',
          600: '#495163',
          500: '#656e83',
          400: '#828ba2',
          300: '#bec4d5',
          200: '#dadee8',
          100: '#eff2f9',
          50: '#f7f9fc',
        },
        ok: { 50: '#e7f8f0', 500: '#21ad64', 700: '#137a44' },
        warn: { 50: '#fff6e5', 500: '#f5a623', 700: '#a35f00' },
        bad: { 50: '#feecec', 500: '#ef4b4b', 700: '#b42323' },
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 2px 4px -1px rgba(15,20,30,.06), 0 12px 32px -8px rgba(15,20,30,.12)',
        paper: '0 4px 8px rgba(15,20,30,.08), 0 24px 56px -12px rgba(15,20,30,.28)',
      },
    },
  },
  plugins: [],
};
