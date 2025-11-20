/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#0a192f',
        'accent-cyan': '#00e6ff',
        'accent-green': '#00ff99',
      },
      fontFamily: {
        'sans': ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      animation: {
        'fadeInUp': 'fadeInUp 1.2s forwards',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        fadeInUp: {
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      screens: {
        'xs': '480px',
      },
    },
  },
  plugins: [],
}

