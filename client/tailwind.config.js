/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Accent palette wired to CSS variables (see src/index.css)
        // Enables classes like bg-accent-500, text-accent-600, from-accent-500, etc.
        accent: {
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
          950: 'var(--color-accent-950)'
        },
        // Light Green Primary Palette (Mint/Fresh)
        primary: {
          50: '#F0FFF9',    // Very light mint tint
          100: '#CCFFF0',   // Lighter mint
          200: '#99FFE1',   // Light mint
          300: '#6DD5C4',   // Soft mint
          400: '#4AEDC4',   // Bright mint (main primary)
          500: '#3DD4B0',   // Medium mint
          600: '#2FB89A',   // Deeper mint
          700: '#2A9B82',   // Dark mint
          800: '#23806D',   // Darker mint
          900: '#1F6A5C',   // Deep mint
        },
        // Complementary Accent Colors
        mint: {
          50: '#F0FFF9',
          100: '#E6FFF5',
          200: '#CCFFF0',
          300: '#99FFE1',
          400: '#6DD5C4',
          500: '#4AEDC4',
          600: '#3DD4B0',
          700: '#2FB89A',
        },
        sage: {
          50: '#F5F9F7',
          100: '#E8F2ED',
          200: '#C8DDD5',
          300: '#A8C8BD',
          400: '#8DBFAA',
          500: '#73A997',
          600: '#608F7D',
          700: '#4D7464',
          800: '#3A594C',
          900: '#30575D',
        },
        coral: {
          50: '#FFF5F2',
          100: '#FFE8E3',
          200: '#FFD1C7',
          300: '#FFBAAB',
          400: '#FFB4A0',
          500: '#FF9580',
          600: '#FF7660',
          700: '#E85D45',
          800: '#CC4430',
        },
        lavender: {
          50: '#F9F7FD',
          100: '#F2EEFA',
          200: '#E5DDF5',
          300: '#D8CCF0',
          400: '#C5B5E8',
          500: '#B09EE0',
          600: '#9987D8',
          700: '#8370D0',
          800: '#6C59C8',
        },
        sky: {
          50: '#F0FAFF',
          100: '#E0F5FF',
          200: '#C1EBFF',
          300: '#A8E6FF',
          400: '#7DD3FF',
          500: '#52C0FF',
          600: '#2AADFF',
          700: '#0099FF',
        },
        sunshine: {
          50: '#FFFCF0',
          100: '#FFF9E0',
          200: '#FFF3C1',
          300: '#FFEDA2',
          400: '#FFD88A',
          500: '#FFC663',
          600: '#FFB33C',
          700: '#FFA015',
        },
        // Neutrals - Enhanced for light theme
        gray: {
          25: '#FEFEFE',    // Almost white
          50: '#F8F9FA',    // Off-white background
          100: '#F3F4F6',   // Light gray
          200: '#E5E7EB',   // Border gray
          300: '#D1D5DB',   // Muted border
          400: '#9CA3AF',   // Placeholder text
          500: '#6B7280',   // Secondary text
          600: '#4B5563',   // Body text
          700: '#374151',   // Dark text
          800: '#1F2937',   // Headings
          900: '#111827',   // Almost black
          950: '#0A0A0A',   // Pure black
        },
        // Semantic colors with new palette
        success: {
          50: '#F0FFF9',
          100: '#CCFFF0',
          200: '#99FFE1',
          300: '#6DD5C4',
          400: '#4AEDC4',
          500: '#3DD4B0',
          600: '#2FB89A',
        },
        warning: {
          50: '#FFFCF0',
          100: '#FFF9E0',
          200: '#FFF3C1',
          300: '#FFEDA2',
          400: '#FFD88A',
          500: '#FFC663',
          600: '#FFB33C',
        },
        error: {
          50: '#FFF5F2',
          100: '#FFE8E3',
          200: '#FFD1C7',
          300: '#FFBAAB',
          400: '#FFB4A0',
          500: '#FF9580',
          600: '#FF7660',
        },
        info: {
          50: '#F0FAFF',
          100: '#E0F5FF',
          200: '#C1EBFF',
          300: '#A8E6FF',
          400: '#7DD3FF',
          500: '#52C0FF',
          600: '#2AADFF',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'Consolas',
          'Monaco',
          'monospace',
        ],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'sm': '0.25rem',
        DEFAULT: '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'vercel': '0 0 0 1px rgba(0, 0, 0, 0.03), 0 2px 4px rgba(0, 0, 0, 0.05), 0 12px 24px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in',
        'fade-out': 'fadeOut 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(-2%)' },
          '50%': { transform: 'translateY(2%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
