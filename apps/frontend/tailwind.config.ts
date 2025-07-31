module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {
      fontFamily: {
        bebasNeue: ['Bebas Neue', 'sans-serif'],
      },
      colors: {
        bg: {
          dark: 'hsl(var(--bg-dark))',
          DEFAULT: 'hsl(var(--bg))',
          light: 'hsl(var(--bg-light))',
        },
        text: {
          DEFAULT: 'hsl(var(--text))',
          muted: 'hsl(var(--text-muted))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          muted: 'hsl(var(--border-muted))',
        },
        highlight: 'hsl(var(--highlight))',
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--secondary))',
        danger: 'hsl(var(--danger))',
        warning: 'hsl(var(--warning))',
        success: 'hsl(var(--success))',
        info: 'hsl(var(--info))',
      },
    },
  },
  plugins: [],
}