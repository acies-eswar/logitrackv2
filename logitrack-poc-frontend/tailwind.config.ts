import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        ink: { DEFAULT: "#0a0e1a", 900: "#0a0e1a", 800: "#131a2e", 700: "#1e2740", 600: "#2d3a5c" },
        brand: {
          DEFAULT: "#1d4ed8", 50: "#eff4ff", 100: "#dbe6ff", 200: "#b9ceff", 300: "#8aabff",
          400: "#5a82f7", 500: "#1d4ed8", 600: "#1740b8", 700: "#143596", 800: "#142d77", 900: "#0f2150",
        },
        cyan: {
          DEFAULT: "#00d9ff", 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc",
          400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e",
        },
        slate: {
          50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8",
          500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a",
        },
        positive: "#10b981", warning: "#f59e0b", danger: "#ef4444",
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)",
        elevated: "0 4px 16px rgba(15,23,42,0.10)",
      },
      keyframes: { 
        "fade-up": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "gradient-shift": { "0%, 100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
      },
      animation: { 
        "fade-up": "fade-up 0.3s ease-out",
        "gradient-shift": "gradient-shift 6s ease infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
