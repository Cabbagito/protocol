/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        protocol: {
          400: 'var(--accent-l)',
          500: 'var(--accent)',
          600: 'var(--accent-d)',
          700: 'var(--accent-d)',
        },
        navy: {
          deep: 'var(--deep)',
          base: 'var(--base)',
          card: 'var(--card)',
          panel: 'var(--panel)',
          input: 'var(--input)',
          border: 'var(--border)',
        },
        muscle: {
          back: '#14b8a6',
          'back-light': '#2dd4bf',
          biceps: '#6366f1',
          'biceps-light': '#818cf8',
          shoulders: '#a855f7',
          'shoulders-light': '#c084fc',
          chest: '#f97316',
          'chest-light': '#fb923c',
          triceps: '#ec4899',
          'triceps-light': '#f472b6',
          quads: '#eab308',
          'quads-light': '#facc15',
          hamstrings: '#22c55e',
          'hamstrings-light': '#4ade80',
          glutes: '#f43f5e',
          'glutes-light': '#fb7185',
          calves: '#06b6d4',
          'calves-light': '#22d3ee',
          core: '#f59e0b',
          'core-light': '#fbbf24',
          traps: '#8b5cf6',
          'traps-light': '#a78bfa',
          forearms: '#64748b',
          'forearms-light': '#94a3b8',
        },
      },
      boxShadow: {
        'card': '0 4px 12px var(--shadow)',
        'progress-glow': '0 0 8px rgba(74,222,128,0.5), 0 0 2px rgba(74,222,128,0.8)',
      },
    },
  },
  plugins: [],
}
