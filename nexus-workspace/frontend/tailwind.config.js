/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Nexus design system — dark workspace palette
        surface: {
          DEFAULT: "#0f0f11",
          raised: "#17171a",
          overlay: "#1e1e23",
          border: "#2a2a32",
        },
        accent: {
          DEFAULT: "#6c63ff",
          hover: "#7c75ff",
          muted: "#6c63ff33",
        },
        ink: {
          primary: "#f0f0f4",
          secondary: "#9898a8",
          muted: "#55556a",
        },
        ok:   "#22c55e",
        warn: "#f59e0b",
        err:  "#ef4444",
        info: "#3b82f6",
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glass: "0 4px 32px rgba(0,0,0,0.45)",
        glow: "0 0 20px rgba(108,99,255,0.35)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      animation: {
        "slide-in": "slideIn 0.2s ease-out",
        "fade-up":  "fadeUp 0.25s ease-out",
        pulse_dot:  "pulseDot 1.5s ease-in-out infinite",
      },
      keyframes: {
        slideIn:  { from: { transform: "translateX(-8px)", opacity: 0 }, to: { transform: "none", opacity: 1 } },
        fadeUp:   { from: { transform: "translateY(8px)", opacity: 0 },  to: { transform: "none", opacity: 1 } },
        pulseDot: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
      },
    },
  },
  plugins: [],
};
