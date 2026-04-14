/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    colors: {
      // Amber color scheme for donor app
      amber: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
      },
      white: '#ffffff',
      gray: {
        200: '#efefef',
        300: '#d1d5db',
        600: '#4b5563',
        800: '#1f2937',
      },
      red: {
        200: '#fecaca',
      },
      green: {
        600: '#16a34a',
      }
    },
    extend: {},
  },
  plugins: [],
}
