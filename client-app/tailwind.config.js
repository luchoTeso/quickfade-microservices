/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#C9A84C',
          goldLight: '#F0D080',
          dark: '#0D0D0D',
          dark2: '#161616',
          dark3: '#1E1E1E',
          dark4: '#2A2A2A',
          white: '#F5F0E8',
          cream: '#EDE8DC',
          red: '#E84040',
          green: '#27AE60',
        }
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'pulse-badge': 'pulseBadge 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.35s ease forwards',
      },
      keyframes: {
        pulseBadge: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(232,64,64,0.5)' },
          '50%': { boxShadow: '0 0 0 10px rgba(232,64,64,0)' },
        },
        blink: {
          '50%': { opacity: 0 },
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
};
