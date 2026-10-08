/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface-2)', line: 'var(--line)',
        fg: 'var(--fg)', muted: 'var(--muted)', accent: 'var(--accent)', accentfg: 'var(--accent-fg)',
        accentsoft: 'var(--accent-soft)', zins: 'var(--zins)', tilgung: 'var(--tilgung)',
        rest: 'var(--rest)', alt: 'var(--alt)', good: 'var(--good)', bad: 'var(--bad)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { card: '18px' },
    },
  },
  plugins: [],
};
