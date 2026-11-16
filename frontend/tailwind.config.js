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
      borderRadius: {
        ctl: "10px",
        panel: "16px",
        "panel-lg": "24px",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(15 23 42 / 0.05)",
        card: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)",
        lift: "0 10px 25px -5px rgb(15 23 42 / 0.08), 0 8px 10px -6px rgb(15 23 42 / 0.04)",
        "lift-lg": "0 20px 35px -10px rgb(15 23 42 / 0.12), 0 10px 10px -5px rgb(15 23 42 / 0.04)",
        glow: "0 0 25px -4px rgb(var(--cobalt) / 0.25)",
        "glow-lamp": "0 0 25px -4px rgb(var(--lamp) / 0.35)",
      },
    },
  },
  plugins: [],
};
