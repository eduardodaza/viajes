/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#e8f5ef",
          100: "#c5e6d5",
          500: "#1a6b4a",
          600: "#155a3e",
          700: "#0f4530",
        },
        accent: {
          50:  "#fdf0eb",
          100: "#fad5c2",
          500: "#e85d26",
          600: "#c44d1c",
        },
      },
    },
  },
  plugins: [],
};
