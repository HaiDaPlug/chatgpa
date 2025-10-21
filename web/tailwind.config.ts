// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Inter variable → falls back to system if not loaded
        sans: ['"Inter var"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Brand accents (match waitlist glow)
        coral: { DEFAULT: "#FF7373", 50:"#FFF2F2",100:"#FFE6E6",200:"#FFCACA",300:"#FFADAD",400:"#FF8F8F",500:"#FF7373",600:"#E65F5F",700:"#CC4F4F",800:"#B33F3F",900:"#8F2E2E" },
        amber: { DEFAULT: "#FFB86C", 50:"#FFF7ED",100:"#FFEDD5",200:"#FED7AA",300:"#FEC37A",400:"#FFB86C",500:"#F59E0B",600:"#D97706",700:"#B45309",800:"#92400E",900:"#78350F" },
      },
      boxShadow: {
        glow: "0 0 40px rgba(255,115,115,0.25)",
      },
      opacity: {
        15: "0.15",
        6: "0.06",
      },
    },
  },
  plugins: [],
} satisfies Config;
