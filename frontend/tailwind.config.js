/** Design tokens live in src/styles/index.css as CSS variables; Tailwind maps them to utility classes. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: { DEFAULT: v("night"), 2: v("night-2"), 3: v("night-3") },
        paper: { DEFAULT: v("paper"), 2: v("paper-2") },
        ink: { DEFAULT: v("ink"), 2: v("ink-2"), 3: v("ink-3") },
        line: { DEFAULT: v("line"), 2: v("line-2") },
        cobalt: { DEFAULT: v("cobalt"), 700: v("cobalt-700"), 50: v("cobalt-50") },
        lamp: { DEFAULT: v("lamp"), 700: v("lamp-700"), 50: v("lamp-50") },
        go: { DEFAULT: v("go"), 50: v("go-50") },
        alert: { DEFAULT: v("alert"), 50: v("alert-50") },
      },
      fontFamily: {
        display: ['"Manrope Variable"', "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"DM Sans Variable"', '"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { ctl: "4px", panel: "6px" },
      boxShadow: { lift: "0 1px 0 rgb(var(--line)), 0 6px 16px -10px rgb(var(--night) / 0.3)" },
    },
  },
  plugins: [],
};
