/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7E6FB1",
          600: "#6B5C9E",
          700: "#554784",
          100: "#EEEBF7",
        },
        accent: {
          DEFAULT: "#57C4C9",
          600: "#3FA9AE",
        },
        ink: {
          DEFAULT: "#241F3A",
          muted: "#6A6386",
        },
        state: {
          success: "#12B886",
          warning: "#E8A317",
          danger: "#E5484D",
          info: "#5B76E6",
        },
      },
      fontFamily: {
        sans: ["Inter", "Hind Siliguri", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        sheet: "28px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(126, 111, 177, 0.20)",
        pill: "0 2px 8px rgba(126, 111, 177, 0.18)",
        card: "0 6px 24px rgba(126, 111, 177, 0.12)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        rise: "rise 0.35s ease both",
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
