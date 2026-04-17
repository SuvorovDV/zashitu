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
          DEFAULT: '#C8FF3E',
          ink:     '#0E0E0C',
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
        // Legacy amber aliased to accent so unrewritten pages stop looking amber-y.
        // Will be removed in commit 9 after every page is ported.
        brand: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
      },
    },
  },
  plugins: [],
}
