import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#132126",
        muted: "#607076",
        line: "rgba(19, 33, 38, 0.13)",
        accent: { DEFAULT: "#e95420", hover: "#d74716" },
        cyan: "#168ba0",
        paper: "#f7f8f6",
        soft: "#eef3f3"
      },
      borderRadius: { md: "7px", panel: "18px" },
      boxShadow: {
        panel: "0 12px 36px rgba(24, 43, 49, 0.04)"
      }
    }
  },
  plugins: []
};

export default config;
