/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        batman: {
          bg: "#0a0a0f",
          accent: "#fbbf24",
        },
        jarvis: {
          bg: "#0c1420",
          accent: "#60a5fa",
        },
        wakanda: {
          bg: "#1a0a1f",
          accent: "#a855f7",
        },
      },
    },
  },
  plugins: [],
}

