import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'sans-serif'],
      },
      colors: {
        brand: {
          blue: "#0A1C82",
          purple: "#6B00D7",
          orange: "#FF3D00",
        },
        support: {
          grey: "#6E7191",
        },
        primary: {
          50: "#f0f4f9",
          100: "#e1e9f4",
          200: "#d2dff0",
          400: "#a9bce0",
          500: "#345995",
          600: "#0A1C82",
          700: "#233d6a",
          800: "#1b2f51",
          900: "#13213a",
        },
        secondary: {
          50: "#fbfaf8",
          100: "#f6f4f0",
          200: "#ebe6df",
          500: "#d1c1a5",
          600: "#c1b092",
          700: "#a8987b",
        }
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
