/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg0: "#070809",
        bg1: "#0d1014",
        panel: "#12151b",
        accent: "#22d3ee",
        magenta: "#e879f9",
        signal: "#4ade80",
        muted: "#6b7280",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(34,211,238,0.15)",
        panel: "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};
