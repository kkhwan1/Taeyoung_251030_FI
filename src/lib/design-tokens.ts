/**
 * Design Tokens for 태창 ERP - SAP Style Conservative Design
 * Version: 2.0
 * Last Updated: 2025-01-24
 *
 * Design Philosophy:
 * - Grayscale-first (80% gray + 20% status colors)
 * - Minimalism (remove all unnecessary decorative elements)
 * - Conservative (clarity over creativity)
 * - Professional (enterprise-grade quality)
 */

// ============================================================
// Color Tokens
// ============================================================

export const colors = {
  // Grayscale (Light Mode)
  gray50: '#FAFAFA',    // Background
  gray100: '#F5F5F5',   // Card Background
  gray200: '#E5E5E5',   // Border
  gray300: '#D4D4D4',   // Disabled State
  gray400: '#A3A3A3',   // Secondary Text
  gray500: '#737373',   // Placeholder
  gray600: '#525252',   // Body Text
  gray700: '#404040',   // Heading
  gray800: '#262626',   // Primary Text
  gray900: '#171717',   // Strong Emphasis

  // Status Colors (Minimal Usage Only)
  statusSuccess: '#525252',   // Green-600
  statusWarning: '#525252',   // Amber-600
  statusError: '#262626',     // Red-600
  statusInfo: '#525252',      // Gray-600 (converted from blue for SAP-style consistency)

  // Dark Mode
  darkBg: '#1A1A1A',          // Dark Background
  darkCard: '#262626',        // Dark Card
  darkBorder: '#404040',      // Dark Border
  darkText: '#E5E5E5',        // Light Text
  darkTextSecondary: '#A3A3A3' // Secondary Text
} as const;

// Chart Colors (Grayscale Only)
export const chartColors = {
  chart1: '#262626',  // Gray-800 (Primary)
  chart2: '#525252',  // Gray-600 (Secondary)
  chart3: '#737373',  // Gray-500 (Tertiary)
  chart4: '#A3A3A3',  // Gray-400 (Quaternary)
  chart5: '#D4D4D4',  // Gray-300 (Quinary)
} as const;

// ============================================================
// Typography Tokens
// ============================================================

export const typography = {
  // Font Families (Conservative System Fonts - 금융권/기업용)
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", "맑은 고딕", Arial, sans-serif',
  fontMono: '"Consolas", "Courier New", monospace',

  // Font Sizes (Clear Hierarchy - 축소 버전: 정보 밀도 증가)
  fontSize: {
    xs: '10px',   // Small labels, captions (12px → 10px)
    sm: '12px',   // Body text, form inputs (14px → 12px)
    base: '13px', // Default body text (16px → 13px)
    lg: '14px',   // Section headings (18px → 14px)
    xl: '16px',   // Page headings (20px → 16px)
    '2xl': '18px' // Main titles (24px → 18px)
  },

  // Font Weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75
  }
} as const;

// ============================================================
// Spacing Tokens (16px Base Unit)
// ============================================================

export const spacing = {
  xs: '4px',    // 0.25rem
  sm: '8px',    // 0.5rem
  md: '16px',   // 1rem (base unit)
  lg: '24px',   // 1.5rem
  xl: '32px',   // 2rem
  '2xl': '48px', // 3rem
  '3xl': '64px'  // 4rem
} as const;

// ============================================================
// Border & Shadow Tokens
// ============================================================

export const borders = {
  // Border Widths
  width: {
    none: '0',
    thin: '1px',
    medium: '2px'
  },

  // Border Radius
  radius: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px'
  },

  // Border Colors (Light Mode)
  color: {
    default: colors.gray200,
    hover: colors.gray300,
    focus: colors.gray400
  }
} as const;

export const shadows = {
  // Minimal shadows (SAP style prefers flat design)
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', // Subtle depth only
  md: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',  // Very minimal
} as const;

// ============================================================
// Component Tokens
// ============================================================

export const components = {
  // Button Variants
  button: {
    primary: {
      bg: colors.gray800,
      text: '#FFFFFF',
      hoverBg: colors.gray900,
      activeBg: colors.gray700
    },
    secondary: {
      bg: colors.gray100,
      text: colors.gray800,
      hoverBg: colors.gray200,
      activeBg: colors.gray300
    },
    ghost: {
      bg: 'transparent',
      text: colors.gray700,
      hoverBg: colors.gray50,
      activeBg: colors.gray100
    }
  },

  // Table Styles
  table: {
    headerBg: colors.gray50,
    headerText: colors.gray700,
    rowBg: '#FFFFFF',
    rowHoverBg: colors.gray50,
    borderColor: colors.gray200
  },

  // Card Styles
  card: {
    bg: '#FFFFFF',
    border: colors.gray200,
    headerBg: colors.gray50,
    shadow: shadows.none // Flat design
  },

  // Input Styles
  input: {
    bg: '#FFFFFF',
    border: colors.gray200,
    text: colors.gray800,
    placeholder: colors.gray400,
    focusBorder: colors.gray400,
    disabledBg: colors.gray100,
    disabledText: colors.gray400
  }
} as const;

// ============================================================
// Dark Mode Tokens
// ============================================================

export const darkMode = {
  colors: {
    background: colors.darkBg,
    card: colors.darkCard,
    border: colors.darkBorder,
    text: colors.darkText,
    textSecondary: colors.darkTextSecondary
  },

  components: {
    button: {
      primary: {
        bg: colors.darkText,
        text: colors.darkBg,
        hoverBg: '#FFFFFF',
        activeBg: colors.gray200
      },
      secondary: {
        bg: colors.darkCard,
        text: colors.darkText,
        hoverBg: colors.darkBorder,
        activeBg: colors.gray600
      }
    },

    table: {
      headerBg: colors.darkCard,
      headerText: colors.darkText,
      rowBg: colors.darkBg,
      rowHoverBg: colors.darkCard,
      borderColor: colors.darkBorder
    },

    card: {
      bg: colors.darkCard,
      border: colors.darkBorder,
      headerBg: colors.darkBg,
      shadow: shadows.none
    },

    input: {
      bg: colors.darkCard,
      border: colors.darkBorder,
      text: colors.darkText,
      placeholder: colors.darkTextSecondary,
      focusBorder: colors.gray600,
      disabledBg: colors.darkBg,
      disabledText: colors.gray600
    }
  }
} as const;

// ============================================================
// Animation Tokens (Minimal - Remove Decorative Animations)
// ============================================================

export const animations = {
  // Only essential transitions (no decorative animations)
  duration: {
    instant: '0ms',      // Prefer instant for most interactions
    fast: '150ms',       // Only for essential feedback
    normal: '200ms'      // Rarely used
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)', // Standard easing
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)'
  }
} as const;

// ============================================================
// Export All Tokens
// ============================================================

export const designTokens = {
  colors,
  chartColors,
  typography,
  spacing,
  borders,
  shadows,
  components,
  darkMode,
  animations
} as const;

export default designTokens;
