/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-down': { '0%': { opacity: '0', transform: 'translateY(-10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        indeterminate: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(350%)' } },
        'pulse-slow': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.5' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-in-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        indeterminate: 'indeterminate 1.4s ease-in-out infinite',
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
