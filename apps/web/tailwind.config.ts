/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans TC"', 'PingFang TC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
