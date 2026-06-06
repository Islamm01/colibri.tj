import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: { xs: '380px' },
      colors: {
        // ============================================================
        // Colibri — PREMIUM EMERALD MARKETPLACE
        //   #014737 deep emerald (primary)
        //   #0A5C46 botanical green
        //   #052E25 dark forest
        //   #C8F169 fresh lime · #FF4F5E berry · #FFA43A citrus (accents)
        //   #F8F6F1 warm ivory (background)
        // Token NAMES preserved (fig/gold/cream/ink) so no markup breaks.
        // ============================================================

        // PRIMARY — emerald ramp (token name: fig)
        fig: {
          50: '#EAF3EF',
          100: '#D2E6DF',
          200: '#A3CCBF',
          300: '#6FAE9B',
          400: '#3C8770',
          500: '#0A5C46', // botanical green
          600: '#014737', // deep emerald — PRIMARY
          700: '#063D30',
          800: '#052E25', // dark forest
          900: '#03201A',
          950: '#021712',
        },

        // ACCENT — token name: gold, now FRESH LIME (the signature pop)
        gold: {
          50: '#F4FCE4',
          100: '#E9F9C8',
          200: '#DAF59E',
          300: '#C8F169', // fresh lime — primary accent
          400: '#B2E04A',
          500: '#97C42F',
          600: '#769E1F',
          700: '#5A7A1B',
        },

        // Secondary accents (new tokens — additive, safe)
        berry: {
          DEFAULT: '#FF4F5E',
          400: '#FF6B77',
          500: '#FF4F5E',
          600: '#E63B49',
        },
        citrus: {
          DEFAULT: '#FFA43A',
          400: '#FFB45C',
          500: '#FFA43A',
          600: '#F08A1C',
        },

        // BACKGROUND — token name: cream, now WARM IVORY
        cream: {
          DEFAULT: '#F8F6F1',
          50: '#FFFFFF',
          100: '#F8F6F1', // warm ivory
          200: '#F0EDE4',
          300: '#E6E1D4',
        },

        // DARK CANVAS — the deep forest the customer app lives on (reference look)
        forest: {
          DEFAULT: '#0C2A1E',
          900: '#071E15', // deepest — page base
          800: '#0C2A1E', // canvas
          700: '#103325', // raised surface / cards
          600: '#16412F', // card hover / chips
          500: '#1D4E39', // borders / dividers on dark
          400: '#2A5E47',
        },

        // TEXT — token name: ink, emerald-toned dark
        ink: {
          DEFAULT: '#052E25',
          soft: '#063D30',
          muted: '#4A6357',
          subtle: '#728A7E',
          faint: '#9DB0A6',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-dm-serif)', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(5,46,37,0.05), 0 1px 1px rgba(5,46,37,0.03)',
        'card': '0 6px 22px -8px rgba(5,46,37,0.14), 0 2px 8px -3px rgba(5,46,37,0.08)',
        'card-hover': '0 22px 48px -14px rgba(1,71,55,0.30), 0 8px 20px -6px rgba(5,46,37,0.14)',
        'fig-glow': '0 10px 34px -8px rgba(1,71,55,0.45)',
        'gold-glow': '0 8px 28px -6px rgba(200,241,105,0.55)',
        'float': '0 18px 50px -16px rgba(5,46,37,0.40)',
      },
      borderRadius: {
        'xl2': '1.5rem',   // 24px
        'xl3': '2rem',     // 32px
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.21,0.61,0.35,1) both',
        'fade-in': 'fadeIn 0.4s ease-out both',
        'pop': 'pop 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.21,0.61,0.35,1) both',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        pop: { '0%': { transform: 'scale(0.8)', opacity: '0' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        glowPulse: { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};

export default config;
