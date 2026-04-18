/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['"Inter Tight"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Instrument Serif"', '"Fraunces"', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        hand:  ['"Caveat"', 'cursive'],
      },
      colors: {
        accent: {
          DEFAULT: '#FF5C2A',
          ink:     '#FFF8EE',
        },
        ink: {
          DEFAULT: '#F5F3EC',
          2:       '#D2CFC1',
          3:       '#8F8C7F',
          4:       '#5E5C51',
        },
        canvas: '#0E0E0C',
        surface: {
          DEFAULT: '#1A1A16',
          2:       '#23231E',
          3:       '#2B2B25',
        },
        err:  '#FF6A5C',
        warn: '#FFC44D',
        // `brand` kept as alias for Step/UI components that still use bg-brand-*
        // Tailwind classes. Scale matches the orange accent family.
        brand: {
          50:  '#FFF1EC',
          100: '#FFDCCF',
          200: '#FFB398',
          300: '#FF8A63',
          400: '#FF5C2A',   // = --accent
          500: '#E8501E',
          600: '#C64316',
          700: '#A4370F',
          800: '#7A270A',
          900: '#4D1706',
        },
      },
    },
  },
  plugins: [],
}
