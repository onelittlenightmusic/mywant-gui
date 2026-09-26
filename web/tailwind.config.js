import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '480px',
      },
      colors: {
        primary: {
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
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        // Motion language: enters ride the shared "settle" curve
        // (cubic-bezier(0.32,0.72,0,1)); exits are shorter and ease-in.
        // Durations live in the 180-280ms band so every transition reads as
        // motion instead of a flicker.
        'fade-in': 'fadeIn 0.18s ease-out forwards',
        'slide-in': 'slideIn 0.22s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'slide-in-right': 'slideInRight 0.26s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'slide-in-left': 'slideInLeft 0.26s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'slide-out-left': 'slideOutLeft 0.2s ease-in forwards',
        'slide-out-right': 'slideOutRight 0.2s ease-in forwards',
        'value-bounce': 'valueBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'status-bounce': 'statusBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        // Grid card lifecycle: pop in with a slight overshoot. There is no
        // exit counterpart — see the note in hooks/useGridMotion.ts.
        'card-enter': 'cardEnter 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        // Route-level page enters, directional by menu order.
        'page-enter-right': 'pageEnterRight 0.22s cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'page-enter-left': 'pageEnterLeft 0.22s cubic-bezier(0.32, 0.72, 0, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutLeft: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-100%)' },
        },
        slideOutRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        // A field card's value momentarily grows then settles back — signals
        // that the value just updated live (SSE want_changed).
        valueBounce: {
          '0%':   { transform: 'scale(1)' },
          '35%':  { transform: 'scale(1.5)' },
          '100%': { transform: 'scale(1)' },
        },
        // Status icon jumps much higher than the value bounce — a bigger,
        // attention-grabbing pop when a want's status changes.
        statusBounce: {
          '0%':   { transform: 'scale(1)' },
          '30%':  { transform: 'scale(2.6)' },
          '55%':  { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        cardEnter: {
          '0%':   { opacity: '0', transform: 'scale(0.92) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        pageEnterRight: {
          '0%':   { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pageEnterLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      }
    },
  },
  plugins: [animate],
  safelist: [
    'h-[6rem]',  'sm:h-[10rem]',
    'h-[9rem]',  'sm:h-[15rem]',
    'h-[18rem]', 'sm:h-[30rem]',
  ],
}