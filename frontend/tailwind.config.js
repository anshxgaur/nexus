/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep glassmorphic palette
        surface: {
          DEFAULT: "#09090b",
          raised: "#18181b",
          overlay: "#27272a",
          border: "#3f3f46",
        },
        accent: {
          DEFAULT: "rgb(var(--accent))",
          hover: "rgb(var(--accent-hover))",
          muted: "rgba(var(--accent), 0.1)",
        },
        ink: {
          primary: "#f8fafc",
          secondary: "#94a3b8",
          muted: "#64748b",
        },
        ok:   "#10b981",
        warn: "#f59e0b",
        err:  "#ef4444",
        info: "#3b82f6",
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
        display: ["'Outfit'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-sm": "0 4px 16px 0 rgba(0, 0, 0, 0.2)",
        glow: "0 0 25px rgba(139, 92, 246, 0.5)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      animation: {
        "slide-in": "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-up":  "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        pulse_dot:  "pulseDot 1.5s ease-in-out infinite",
        blob: "blob 7s infinite",
      },
      keyframes: {
        slideIn:  { from: { transform: "translateX(-12px)", opacity: 0 }, to: { transform: "none", opacity: 1 } },
        fadeUp:   { from: { transform: "translateY(12px)", opacity: 0 },  to: { transform: "none", opacity: 1 } },
        pulseDot: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        }
      },
    },
  },
  plugins: [],
};
