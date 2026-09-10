/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1A3A5C",
        "primary-dark": "#16304F",
        secondary: "#2A7A6B",
        accent: "#E89D3F",
        neutral: "#F5F6F8",
        surface: "#FFFFFF",
        textPrimary: "#1A1D23",
        textSecondary: "#6B7180",
        success: "#2A7A6B",
        warning: "#E89D3F",
        danger: "#C23B22",
        info: "#2B6CB0",
        muted: "#6B7180",
      },
    },
  },
  plugins: [],
}
