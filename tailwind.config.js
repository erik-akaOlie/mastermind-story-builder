/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        // The brand "direct-to-user" voice font (Erik, 2026-07-16): warm,
        // handwritten, personal-note energy — for moments the experience
        // talks TO the user (FTUE introduction, future guidance surfaces).
        // Never for regular UI chrome or content the user authors.
        hand: ['Caveat', 'cursive'],
      },
      lineHeight: {
        // Companion rule to font-hand (Erik, 2026-07-16): WRAPPED Caveat
        // paragraphs use `leading-hand` — tighter than UI leading, so a
        // sentence that wraps still reads as one handwritten note rather
        // than loose paragraph copy. Single-line Caveat needs no leading
        // class. 0.85 = 85% of the font size (Erik, 2026-07-17 — Caveat
        // carries generous built-in vertical padding, so sub-1.0 leading
        // reads as natural handwriting, not clipped text).
        hand: '0.85',
      },
    },
  },
  plugins: [],
}
