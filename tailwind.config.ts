import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05060a",
        panel: "#0d0f16",
        accent: "#5b8cff",
      },
    },
  },
  plugins: [],
} satisfies Config;
