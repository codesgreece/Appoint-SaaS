/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        status: {
          pending: "hsl(var(--status-pending))",
          confirmed: "hsl(var(--status-confirmed))",
          inProgress: "hsl(var(--status-in-progress))",
          completed: "hsl(var(--status-completed))",
          cancelled: "hsl(var(--status-cancelled))",
          rescheduled: "hsl(var(--status-rescheduled))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "led-halo-green": "ledHaloGreen 2s ease-in-out infinite",
        "led-halo-red": "ledHaloRed 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        ledHaloGreen: {
          "0%, 100%": {
            opacity: "0.45",
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(52, 211, 153, 0)",
          },
          "50%": {
            opacity: "0.95",
            transform: "scale(1.12)",
            boxShadow: "0 0 14px 3px rgba(52, 211, 153, 0.55)",
          },
        },
        ledHaloRed: {
          "0%, 100%": {
            opacity: "0.45",
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(251, 113, 133, 0)",
          },
          "50%": {
            opacity: "0.95",
            transform: "scale(1.12)",
            boxShadow: "0 0 14px 3px rgba(251, 113, 133, 0.55)",
          },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
