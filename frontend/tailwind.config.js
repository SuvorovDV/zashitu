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
        // `brand` kept as alias for Step/UI components that still use bg-brand-*
        // Tailwind classes. Scale is the lime-accent family so everything reads
        // dark+lime without per-file rewrites.
        brand: {
          50:  '#F9FFE3',
          100: '#F2FFC5',
          200: '#E4FF8C',
          300: '#D8FF63',
          400: '#C8FF3E',   // = --accent
          500: '#B8E038',
          600: '#9CC02E',
          700: '#7BA024',
          800: '#5A7418',
          900: '#304010',
        },
      },
    },
  },
  plugins: [],
}
