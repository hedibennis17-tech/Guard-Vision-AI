/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0EA5E9",
          dark: "#0369A1",
        },
      },
    },
  },
  plugins: [],
};
