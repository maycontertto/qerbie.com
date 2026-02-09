import type { Config } from "tailwindcss";

const config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#22C55E", // green-500
        brandHover: "#16A34A", // green-600
        accent: "#2DD4BF", // teal-400
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
