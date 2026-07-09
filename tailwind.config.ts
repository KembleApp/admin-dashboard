import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Kemble brand palette, extracted from the Oct-Jan releases deck.
        kemble: {
          ink: "#1A1A2E", // primary text / dark UI surfaces
          navy: "#273141", // secondary heading ink
          cream: "#FFF9F5", // page background
          coral: "#FF9D80",
          peach: "#F7CAA4",
          lime: "#E6FAB7",
          sage: "#AAB181",
          sky: "#DDE9FA",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
