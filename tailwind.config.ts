import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        mono:  ['var(--font-ibm-mono)', 'monospace'],
      },
      colors: {
        coral:  { DEFAULT: '#E8553E', dark: '#C8412C', light: '#FFEDE9' },
        gold:   { DEFAULT: '#C8860A', light: '#FEF3C7' },
        sage:   { DEFAULT: '#3D7A52', light: '#D1FAE5' },
        cream:  { DEFAULT: '#FBF7F0', dark: '#F5ECD7' },
        ink:    { DEFAULT: '#1C1108', soft: '#8A7968' },
      },
      animation: {
        'fade-up':   'fadeUp 0.4s ease forwards',
        'fade-in':   'fadeIn 0.3s ease forwards',
        'slide-in':  'slideIn 0.3s ease forwards',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn:  { from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      borderRadius: { xl: '1rem', '2xl': '1.25rem', '3xl': '1.5rem' },
      boxShadow: {
        card:    '0 2px 16px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.10)',
        coral:   '0 4px 20px rgba(232,85,62,0.25)',
      },
    },
  },
  plugins: [],
}

export default config
