/**
 * Tailwind CSS Configuration - 태창 ERP
 * SAP-Style Conservative Design System
 * Version: 2.0
 * Last Updated: 2025-01-25
 */

import type { Config } from 'tailwindcss';
import { designTokens } from './src/lib/design-tokens';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Grayscale Color Palette (Primary)
      colors: {
        gray: {
          50: designTokens.colors.gray50,
          100: designTokens.colors.gray100,
          200: designTokens.colors.gray200,
          300: designTokens.colors.gray300,
          400: designTokens.colors.gray400,
          500: designTokens.colors.gray500,
          600: designTokens.colors.gray600,
          700: designTokens.colors.gray700,
          800: designTokens.colors.gray800,
          900: designTokens.colors.gray900,
        },

        // Status Colors (Minimal Usage Only)
        status: {
          success: designTokens.colors.statusSuccess,
          warning: designTokens.colors.statusWarning,
          error: designTokens.colors.statusError,
          info: designTokens.colors.statusInfo,
        },

        // Chart Colors (Grayscale Only)
        chart: {
          1: designTokens.chartColors.chart1,
          2: designTokens.chartColors.chart2,
          3: designTokens.chartColors.chart3,
          4: designTokens.chartColors.chart4,
          5: designTokens.chartColors.chart5,
        },

        // Dark Mode Colors
        dark: {
          bg: designTokens.colors.darkBg,
          card: designTokens.colors.darkCard,
          border: designTokens.colors.darkBorder,
          text: designTokens.colors.darkText,
          'text-secondary': designTokens.colors.darkTextSecondary,
        },

        // Semantic Color Aliases (for compatibility with existing code)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },

      // Typography
      fontFamily: {
        sans: designTokens.typography.fontSans.split(', '),
        mono: designTokens.typography.fontMono.split(', '),
      },
      fontSize: {
        xs: designTokens.typography.fontSize.xs,
        sm: designTokens.typography.fontSize.sm,
        base: designTokens.typography.fontSize.base,
        lg: designTokens.typography.fontSize.lg,
        xl: designTokens.typography.fontSize.xl,
        '2xl': designTokens.typography.fontSize['2xl'],
      },
      fontWeight: {
        normal: designTokens.typography.fontWeight.normal,
        medium: designTokens.typography.fontWeight.medium,
        semibold: designTokens.typography.fontWeight.semibold,
        bold: designTokens.typography.fontWeight.bold,
      },
      lineHeight: {
        tight: designTokens.typography.lineHeight.tight,
        normal: designTokens.typography.lineHeight.normal,
        relaxed: designTokens.typography.lineHeight.relaxed,
      },

      // Spacing (16px Base Unit)
      spacing: {
        xs: designTokens.spacing.xs,
        sm: designTokens.spacing.sm,
        md: designTokens.spacing.md,
        lg: designTokens.spacing.lg,
        xl: designTokens.spacing.xl,
        '2xl': designTokens.spacing['2xl'],
        '3xl': designTokens.spacing['3xl'],
      },

      // Border Radius
      borderRadius: {
        none: designTokens.borders.radius.none,
        sm: designTokens.borders.radius.sm,
        md: designTokens.borders.radius.md,
        lg: designTokens.borders.radius.lg,
        full: designTokens.borders.radius.full,
        // Compatibility with existing code
        DEFAULT: 'var(--radius)',
      },

      // Border Width
      borderWidth: {
        DEFAULT: designTokens.borders.width.thin,
        none: designTokens.borders.width.none,
        thin: designTokens.borders.width.thin,
        medium: designTokens.borders.width.medium,
      },

      // Box Shadow (Minimal - SAP Style)
      boxShadow: {
        none: designTokens.shadows.none,
        sm: designTokens.shadows.sm,
        md: designTokens.shadows.md,
        DEFAULT: designTokens.shadows.sm,
      },

      // Animation (Minimal - Remove Decorative Transitions)
      transitionDuration: {
        instant: designTokens.animations.duration.instant,
        fast: designTokens.animations.duration.fast,
        DEFAULT: designTokens.animations.duration.instant, // Prefer instant by default
      },
      transitionTimingFunction: {
        DEFAULT: designTokens.animations.easing.default,
        in: designTokens.animations.easing.in,
        out: designTokens.animations.easing.out,
      },

      // Chart Utilities
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    // Custom plugin for component variants
    function({ addComponents }: any) {
      addComponents({
        // Button Variants (SAP Style)
        '.btn-primary': {
          backgroundColor: designTokens.components.button.primary.bg,
          color: designTokens.components.button.primary.text,
          '&:hover': {
            backgroundColor: designTokens.components.button.primary.hoverBg,
          },
          '&:active': {
            backgroundColor: designTokens.components.button.primary.activeBg,
          },
        },
        '.btn-secondary': {
          backgroundColor: designTokens.components.button.secondary.bg,
          color: designTokens.components.button.secondary.text,
          '&:hover': {
            backgroundColor: designTokens.components.button.secondary.hoverBg,
          },
          '&:active': {
            backgroundColor: designTokens.components.button.secondary.activeBg,
          },
        },
        '.btn-ghost': {
          backgroundColor: designTokens.components.button.ghost.bg,
          color: designTokens.components.button.ghost.text,
          '&:hover': {
            backgroundColor: designTokens.components.button.ghost.hoverBg,
          },
          '&:active': {
            backgroundColor: designTokens.components.button.ghost.activeBg,
          },
        },

        // Table Styles (SAP Style)
        '.table-header': {
          backgroundColor: designTokens.components.table.headerBg,
          color: designTokens.components.table.headerText,
          borderBottomColor: designTokens.components.table.borderColor,
        },
        '.table-row': {
          backgroundColor: designTokens.components.table.rowBg,
          '&:hover': {
            backgroundColor: designTokens.components.table.rowHoverBg,
          },
        },

        // Card Styles (SAP Style)
        '.card-sap': {
          backgroundColor: designTokens.components.card.bg,
          borderColor: designTokens.components.card.border,
          boxShadow: designTokens.components.card.shadow,
        },

        // Input Styles (SAP Style)
        '.input-sap': {
          backgroundColor: designTokens.components.input.bg,
          borderColor: designTokens.components.input.border,
          color: designTokens.components.input.text,
          '&::placeholder': {
            color: designTokens.components.input.placeholder,
          },
          '&:focus': {
            borderColor: designTokens.components.input.focusBorder,
          },
          '&:disabled': {
            backgroundColor: designTokens.components.input.disabledBg,
            color: designTokens.components.input.disabledText,
          },
        },
      });
    },
  ],
};

export default config;
