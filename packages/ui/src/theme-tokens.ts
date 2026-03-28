/**
 * Shared theme tokens for both web and React Native
 * Billion Brand System — Dark-first civic tech aesthetic
 */

export const colors = {
  // Brand Navy — primary surfaces
  navy: {
    base: "#0E1530", // Deep Navy — primary background
    elevated: "#272D3C", // Slate — cards, elevated containers
    higher: "#323848", // Highest surface — popovers, dropdowns
  },

  // Content type colors
  bill: "#4A7CFF", // Civic Blue
  executive: "#6366F1", // Deep Indigo
  case: "#0891B2", // Teal
  general: "#8A8FA0", // Muted

  // Content type aliases (convenience)
  civicBlue: "#4A7CFF",
  deepIndigo: "#6366F1",
  teal: "#0891B2",

  // Additional border tokens
  borderLight: "rgba(255, 255, 255, 0.12)",

  // Semantic colors
  green: {
    500: "#10B981",
  },
  yellow: {
    500: "#F59E0B",
  },
  red: {
    400: "#f87171",
    500: "#EF4444",
    600: "#dc2626",
  },

  // Base colors
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",

  // Secondary text / muted
  textSecondary: "#8A8FA0",

  // Border tokens
  borderSubtle: "rgba(255, 255, 255, 0.06)",
  borderFocus: "rgba(255, 255, 255, 0.3)",
};

/**
 * Semantic color mappings for dark mode (primary theme — dark is always default)
 */
export const darkTheme = {
  // Backgrounds — surface layering
  background: colors.navy.base, // #0E1530
  foreground: colors.white,
  card: colors.navy.elevated, // #272D3C
  cardForeground: colors.white,

  // Primary — white fills on dark surfaces
  primary: colors.white,
  primaryForeground: colors.black,

  // Secondary surfaces
  secondary: colors.navy.elevated,
  secondaryForeground: colors.white,

  // Muted
  muted: colors.navy.higher,
  mutedForeground: colors.textSecondary,

  // Accent — keep legacy accent for compatibility
  accent: colors.bill,
  accentForeground: colors.white,

  // Destructive
  destructive: colors.red[500],
  destructiveForeground: colors.white,

  // Border and input
  border: colors.borderSubtle,
  input: colors.navy.elevated,
  ring: colors.borderFocus,

  // Text
  text: colors.white,
  textSecondary: colors.textSecondary,

  // Semantic
  success: colors.green[500],
  warning: colors.yellow[500],
  danger: colors.red[500],
};

/**
 * Light mode — secondary accommodation (dark is primary)
 */
export const lightTheme = {
  background: colors.white,
  foreground: colors.navy.base,
  card: "#F5F5F7",
  cardForeground: colors.navy.base,

  primary: colors.navy.base,
  primaryForeground: colors.white,

  secondary: "#E8E9ED",
  secondaryForeground: colors.navy.base,

  muted: "#F0F1F3",
  mutedForeground: "#555E70",

  accent: colors.bill,
  accentForeground: colors.white,

  destructive: colors.red[500],
  destructiveForeground: colors.white,

  border: "rgba(14, 21, 48, 0.1)",
  input: colors.white,
  ring: "rgba(14, 21, 48, 0.4)",

  text: colors.navy.base,
  textSecondary: "#555E70",

  success: colors.green[500],
  warning: colors.yellow[500],
  danger: colors.red[500],
};

/**
 * Spacing scale (in rem for web, multiply by 4 for RN)
 */
export const spacing = {
  0: 0,
  1: 0.25, // 4px / 1rem
  2: 0.5, // 8px / 2rem
  3: 0.75, // 12px / 3rem
  4: 1, // 16px / 4rem
  5: 1.25, // 20px / 5rem
  6: 1.5, // 24px / 6rem
  8: 2, // 32px / 8rem
  10: 2.5, // 40px / 10rem
  12: 3, // 48px / 12rem
  16: 4, // 64px / 16rem
  20: 5, // 80px / 20rem
  24: 6, // 96px / 24rem
};

/**
 * Border radius values
 */
export const radius = {
  none: 0,
  sm: 0.375, // 6px
  md: 0.5, // 8px
  lg: 0.75, // 12px
  xl: 1, // 16px
  "2xl": 1.5, // 24px
  full: 9999,
};

/**
 * Typography scale
 */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
};

export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

/**
 * Shadow presets — deep, soft shadows reinforcing dark surface layering
 */
export const shadows = {
  // Subtle — cards resting on base surface
  light: {
    sm: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 4,
    },
    lg: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.5,
      shadowRadius: 32,
      elevation: 6,
    },
  },
  // Elevated — modals, overlays, popovers
  dark: {
    sm: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 4,
    },
    lg: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.5,
      shadowRadius: 32,
      elevation: 6,
    },
  },
};
