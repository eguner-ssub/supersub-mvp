/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'permanent-marker': ["'Permanent Marker'", 'cursive'],
      },
      keyframes: {
        levitate: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        levitate: 'levitate 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
