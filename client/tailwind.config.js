/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'canvas': {
          DEFAULT: '#0f0f0f',
          dark: '#0a0a0a',
          light: '#1a1a1a',
          lighter: '#252525'
        },
        'surface': {
          DEFAULT: '#1a1a1a',
          hover: '#1f1f1f',
          active: '#252525'
        },
        'border': {
          DEFAULT: '#2a2a2a',
          light: '#333333'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
      },
      boxShadow: {
        'node': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'node-hover': '0 4px 16px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px var(--glow-color)',
      }
    },
  },
  plugins: [],
}
