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
        // Editorial palette
        ivory:    { DEFAULT: '#FBF9F4', dark: '#F2EDE2' },
        bone:     { DEFAULT: '#EFE8DA', dark: '#E0D6C2' },
        gold:     { DEFAULT: '#B8956A', light: '#D4B895', dark: '#8E6B45' },
        coral:    { DEFAULT: '#D9614A', dark: '#B84B36', light: '#F2D7CF' },
        sage:     { DEFAULT: '#7A8B6E', light: '#D9E0CE' },
        rose:     { DEFAULT: '#C9A8A0', light: '#F2E2DD' },
        cream:    { DEFAULT: '#FBF9F4', dark: '#F2EDE2' },
        ink:      { DEFAULT: '#1A1612', soft: '#5C534A', muted: '#8B8175' },
      },
      animation: {
        'fade-up':    'fadeUp 0.7s ease forwards',
        'fade-in':    'fadeIn 0.6s ease forwards',
        'slide-in':   'slideIn 0.3s ease forwards',
        'kenburns':   'kenburns 20s ease-in-out infinite alternate',
        'spin-slow':  'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeUp:   { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'none' } },
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn:  { from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        kenburns: { from: { transform: 'scale(1)' }, to: { transform: 'scale(1.08)' } },
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem', '3xl': '1.25rem' },
      boxShadow: {
        card:        '0 4px 24px rgba(26,22,18,0.06)',
        'card-hover':'0 12px 40px rgba(26,22,18,0.12)',
        gold:        '0 6px 24px rgba(184,149,106,0.20)',
        'editorial': '0 20px 60px rgba(26,22,18,0.15)',
      },
      letterSpacing: {
        widest: '0.18em',
      },
    },
  },
  plugins: [],
}

export default config
