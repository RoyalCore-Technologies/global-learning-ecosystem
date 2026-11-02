import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#080c14',
          card: '#0f172a',
          elevated: '#17223b',
          subtle: '#1e293b',
          border: '#1e293b',
          'border-hover': '#334155',
        },
        brand: {
          indigo: {
            50: '#eef2ff',
            100: '#e0e7ff',
            200: '#c7d2fe',
            300: '#a5b4fc',
            400: '#818cf8',
            500: '#6366f1',
            600: '#4f46e5',
            700: '#4338ca',
            800: '#3730a3',
            900: '#312e81',
            950: '#1e1b4b',
          },
          emerald: {
            50: '#ecfdf5',
            100: '#d1fae5',
            400: '#34d399',
            500: '#10b981',
            600: '#059669',
            950: '#022c22',
          },
          violet: {
            50: '#f5f3ff',
            400: '#a78bfa',
            500: '#8b5cf6',
            600: '#7c3aed',
            950: '#2e1065',
          },
          amber: {
            50: '#fffbeb',
            400: '#fcd34d',
            500: '#f59e0b',
            600: '#d97706',
            950: '#451a03',
          },
          cyan: {
            50: '#ecfeff',
            400: '#67e8f9',
            500: '#06b6d4',
            600: '#0891b2',
            950: '#083344',
          },
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'brand-glow': '0 0 20px -5px rgba(99, 102, 241, 0.35)',
        'emerald-glow': '0 0 20px -5px rgba(16, 185, 129, 0.35)',
        'violet-glow': '0 0 20px -5px rgba(139, 92, 246, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
