import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2D5A3D',
          50: '#f0f7f2',
          100: '#d8eade',
          light: '#E8F0EA',
          200: '#b3d4bc',
          300: '#7fb892',
          400: '#4f9a65',
          500: '#2D5A3D',
          600: '#265034',
          700: '#1f422b',
          800: '#183422',
          900: '#102619',
        },
      },
    },
  },
  plugins: [],
}

export default config
