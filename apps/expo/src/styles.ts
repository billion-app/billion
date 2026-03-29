/**
 * Consolidated Styles for the Expo Native App
 * Billion Brand System — Dark-first civic tech aesthetic
 *
 * This is the SINGLE SOURCE OF TRUTH for all styling in the app.
 * Import everything you need from here: `import { ... } from "~/styles"`
 *
 * Font families (must be loaded via expo-font):
 *   Headlines:   "IBMPlexSerif-Bold", "IBMPlexSerif-BoldItalic"
 *   Subheadings: "InriaSerif-Bold", "InriaSerif-Regular"
 *   Body / UI:   "AlbertSans-Regular", "AlbertSans-Medium", "AlbertSans-SemiBold", "AlbertSans-Bold"
 */

import { StyleSheet, useColorScheme } from "react-native";

import {
  colors,
  darkTheme,
  fontSize,
  fontWeight,
  lightTheme,
  shadows,
} from "@acme/ui/theme-tokens";

// Re-export everything from theme-tokens so you only need to import from one place
export {
  colors,
  darkTheme,
  lightTheme,
  fontSize,
  fontWeight,
  shadows,
} from "@acme/ui/theme-tokens";

// ============================================================================
// BRAND FONT FAMILIES
// ============================================================================

/** Use for all screen titles, hero statements, article headlines */
export const fontDisplay = {
  regular: "IBMPlexSerif-Regular",
  bold: "IBMPlexSerif-Bold",
  italic: "IBMPlexSerif-Italic",
  boldItalic: "IBMPlexSerif-BoldItalic",
};

/** Use for section headers, card titles, pull quotes */
export const fontEditorial = {
  regular: "InriaSerif-Regular",
  bold: "InriaSerif-Bold",
  italic: "InriaSerif-Italic",
  boldItalic: "InriaSerif-BoldItalic",
};

/** Use for body text, captions, button labels, metadata, form inputs */
export const fontBody = {
  regular: "AlbertSans-Regular",
  medium: "AlbertSans-Medium",
  semibold: "AlbertSans-SemiBold",
  bold: "AlbertSans-Bold",
};

/** @deprecated Use fontDisplay, fontEditorial, fontBody instead */
export const fonts = {
  bodySemibold: fontBody.semibold,
  editorialRegular: fontEditorial.regular,
  body: fontBody.regular,
  bodyMedium: fontBody.medium,
};

// ============================================================================
// THEME HOOK - Use this to get the current theme based on color scheme
// ============================================================================

export type Theme = typeof darkTheme;

export function useTheme(): {
  theme: Theme;
  colorScheme: "light" | "dark";
  isDark: boolean;
} {
  const colorScheme: "light" | "dark" = (useColorScheme() as "light" | "dark" | null | undefined) ?? "dark";
  const theme = colorScheme === "dark" ? darkTheme : lightTheme;
  return { theme, colorScheme, isDark: colorScheme === "dark" };
}

// ============================================================================
// SPACING HELPERS - Pre-computed pixel values for use in StyleSheet.create()
// ============================================================================

/** Pre-computed spacing values in pixels (spacing token * 16) */
export const sp = {
  0: 0,
  1: 4, // 0.25 * 16
  2: 8, // 0.5 * 16
  3: 12, // 0.75 * 16
  4: 16, // 1 * 16
  5: 20, // 1.25 * 16
  6: 24, // 1.5 * 16
  8: 32, // 2 * 16
  10: 40, // 2.5 * 16
  12: 48, // 3 * 16
  16: 64, // 4 * 16
  20: 80, // 5 * 16
  24: 96, // 6 * 16
} as const;
// export const sp = (key: keyof typeof spacing): number => spacing[key] * 16;
/** Pre-computed radius values in pixels (radius token * 16) */
export const rd = {
  none: 0,
  sm: 6, // 0.375 * 16
  md: 8, // 0.5 * 16
  lg: 12, // 0.75 * 16
  xl: 16, // 1 * 16
  "2xl": 24, // 1.5 * 16
  full: 9999,
} as const;
// export const rd = (key: keyof typeof radius): number => {
//   const value = radius[key];
//   return typeof value === "number" ? value * 16 : value;
// };
// ============================================================================
// COMMON LAYOUT STYLES
// ============================================================================

export const layout = StyleSheet.create({
  // Flex containers
  flex1: { flex: 1 },
  row: { flexDirection: "row" },
  column: { flexDirection: "column" },
  center: { alignItems: "center", justifyContent: "center" },
  centerX: { alignItems: "center" },
  centerY: { justifyContent: "center" },
  spaceBetween: { justifyContent: "space-between" },
  spaceAround: { justifyContent: "space-around" },
  flexEnd: { justifyContent: "flex-end" },
  alignEnd: { alignItems: "flex-end" },
  alignStart: { alignItems: "flex-start" },
  wrap: { flexWrap: "wrap" },

  // Common containers
  container: { flex: 1 },
  scrollView: { flex: 1 },

  // Full screen loading/error states
  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ============================================================================
// TYPOGRAPHY STYLES
// ============================================================================

export const typography = StyleSheet.create({
  // Headings — IBM Plex Serif (display face, authoritative)
  h1: {
    fontSize: fontSize["3xl"],
    fontFamily: "IBMPlexSerif-Bold",
    lineHeight: fontSize["3xl"] * 1.2,
  },
  h2: {
    fontSize: fontSize["2xl"],
    fontFamily: "IBMPlexSerif-Bold",
    lineHeight: fontSize["2xl"] * 1.2,
  },
  h3: {
    fontSize: fontSize.xl,
    fontFamily: "InriaSerif-Bold",
    lineHeight: fontSize.xl * 1.3,
  },
  h4: {
    fontSize: fontSize.lg,
    fontFamily: "InriaSerif-Bold",
    lineHeight: fontSize.lg * 1.3,
  },

  // Body text — Albert Sans (clean, legible)
  body: {
    fontSize: fontSize.lg, // 18px per brand spec
    fontFamily: "AlbertSans-Regular",
    lineHeight: fontSize.lg * 1.5,
  },
  bodySmall: {
    fontSize: fontSize.base, // 16px — UI / small labels
    fontFamily: "AlbertSans-Medium",
    lineHeight: fontSize.base * 1.4,
  },
  caption: {
    fontSize: fontSize.sm, // 14px — timestamps, badges, metadata
    fontFamily: "AlbertSans-Medium",
    lineHeight: fontSize.sm * 1.4,
  },
  micro: {
    fontSize: fontSize.xs, // 12px — fine print
    fontFamily: "AlbertSans-Medium",
    lineHeight: fontSize.xs * 1.4,
  },

  // Text style modifiers
  bold: { fontFamily: "AlbertSans-Bold" },
  semibold: { fontFamily: "AlbertSans-SemiBold" },
  medium: { fontFamily: "AlbertSans-Medium" },
  italic: { fontStyle: "italic" as const },
  uppercase: { textTransform: "uppercase" as const, letterSpacing: 0.5 },
  center: { textAlign: "center" as const },
});

// ============================================================================
// CARD STYLES
// ============================================================================

export const cards = StyleSheet.create({
  // Base card
  base: {
    borderRadius: rd.xl,
    padding: sp[5],
  },

  // Card with border (modern style)
  bordered: {
    borderRadius: rd.xl,
    borderWidth: 2,
    padding: sp[5],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // Content card (for articles, etc.)
  content: {
    borderRadius: rd.lg,
    borderWidth: 2,
    padding: sp[5],
  },

  // Elevated card with heavy shadow
  elevated: {
    borderRadius: rd.xl,
    padding: sp[6],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});

// ============================================================================
// HEADER STYLES
// ============================================================================

export const headers = StyleSheet.create({
  container: {
    paddingHorizontal: sp[5],
    paddingBottom: sp[5],
  },
  title: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    marginBottom: sp[4],
  },
  withBorder: {
    borderBottomWidth: 1,
  },
});

// ============================================================================
// INPUT STYLES
// ============================================================================

export const inputs = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderRadius: rd.lg,
    paddingHorizontal: sp[4],
    paddingVertical: sp[3],
    fontSize: fontSize.base,
  },
  text: {
    borderWidth: 1,
    borderRadius: rd.md,
    paddingHorizontal: sp[4],
    paddingVertical: sp[3],
    fontSize: fontSize.base,
  },
});

// ============================================================================
// BUTTON STYLES (for custom buttons, use Button from @acme/ui for standard)
// ============================================================================

export const buttons = StyleSheet.create({
  // Tab button base
  tab: {
    paddingHorizontal: sp[3],
    paddingVertical: sp[1] + 2,
    borderRadius: rd.md,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Floating action button
  floating: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});

// ============================================================================
// BADGE STYLES
// ============================================================================

export const badges = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: sp[3],
    paddingVertical: sp[1],
    borderRadius: rd.sm,
  },
  text: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
});

// ============================================================================
// SETTINGS SCREEN STYLES
// ============================================================================

export const settings = StyleSheet.create({
  section: {
    marginTop: sp[8],
  },
  sectionTitle: {
    marginHorizontal: sp[5],
    marginBottom: sp[3],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionContent: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: sp[5],
    paddingVertical: sp[4],
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    marginBottom: sp[1],
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  itemSubtitle: {
    fontSize: fontSize.sm,
    lineHeight: sp[5],
  },
  chevron: {
    marginLeft: sp[3],
    fontSize: fontSize.xl,
  },
});

// ============================================================================
// ACTION BUTTON STYLES (like/comment/share)
// ============================================================================

export const actions = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  button: {
    marginBottom: sp[4],
    alignItems: "center",
    backgroundColor: "transparent",
  },
  icon: {
    marginBottom: sp[1],
    fontSize: fontSize["2xl"],
  },
  text: {
    textAlign: "center",
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});

// ============================================================================
// MARKDOWN STYLES GENERATOR
// ============================================================================

export function getMarkdownStyles(theme: Theme) {
  return {
    body: {
      fontSize: fontSize.base,
      lineHeight: sp[6],
      color: theme.foreground,
    },
    heading1: {
      fontSize: fontSize["2xl"],
      fontWeight: fontWeight.bold,
      marginBottom: sp[4],
      color: theme.foreground,
    },
    heading2: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      marginBottom: sp[3],
      color: theme.foreground,
    },
    heading3: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      marginBottom: sp[2],
      color: theme.foreground,
    },
    paragraph: {
      marginBottom: sp[4],
    },
    listItem: {
      marginBottom: sp[2],
    },
    strong: {
      fontWeight: fontWeight.bold,
    },
    em: {
      fontStyle: "italic" as const,
    },
    link: {
      color: theme.accent,
      textDecorationLine: "underline" as const,
    },
    blockquote: {
      backgroundColor: theme.muted,
      borderLeftWidth: 4,
      borderLeftColor: theme.accent,
      paddingLeft: sp[4],
      paddingVertical: sp[2],
      marginVertical: sp[3],
    },
    code_inline: {
      backgroundColor: theme.muted,
      color: theme.foreground,
      paddingHorizontal: sp[2],
      paddingVertical: sp[1],
      borderRadius: rd.sm,
      fontFamily: "monospace",
    },
    code_block: {
      backgroundColor: theme.muted,
      color: theme.foreground,
      padding: sp[4],
      borderRadius: rd.md,
      marginVertical: sp[3],
      fontFamily: "monospace",
    },
  };
}

// ============================================================================
// TYPE BADGE COLORS (for bills, orders, cases)
// ============================================================================

export const typeBadgeColors = {
  bill: colors.bill, // Civic Blue #4A7CFF
  order: colors.executive, // Deep Indigo #6366F1
  case: colors.case, // Teal #0891B2
  general: colors.general, // Muted #8A8FA0
} as const;

const backendTypeMap: Record<string, keyof typeof typeBadgeColors> = {
  bill: "bill",
  government_content: "order",
  court_case: "case",
  general: "general",
};

export function getTypeBadgeColor(type: string, fallback?: string): string {
  const normalized = Object.hasOwn(backendTypeMap, type)
    ? backendTypeMap[type]
    : type;
  if (normalized !== undefined && Object.hasOwn(typeBadgeColors, normalized)) {
    return typeBadgeColors[normalized as keyof typeof typeBadgeColors];
  }
  return fallback ?? typeBadgeColors.general;
}

// ============================================================================
// COMBINED STYLES HELPERS - For building complete screen styles
// ============================================================================

/** Create themed styles for a screen header */
export function createHeaderStyles(theme: Theme, insetTop: number) {
  return {
    container: {
      backgroundColor: theme.background,
      paddingHorizontal: sp[5],
      paddingBottom: sp[5],
      paddingTop: insetTop + 20,
    },
    title: {
      fontSize: fontSize["2xl"],
      fontWeight: fontWeight.bold,
      color: theme.foreground,
      marginBottom: sp[4],
    },
  };
}

/** Create themed styles for search input */
export function createSearchStyles(theme: Theme) {
  return {
    backgroundColor: theme.input,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: rd.lg,
    paddingHorizontal: sp[4],
    paddingVertical: sp[3],
    fontSize: fontSize.base,
    color: theme.foreground,
  };
}

/** Create themed styles for tab container */
export function createTabContainerStyles(theme: Theme) {
  return {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: sp[5],
    paddingVertical: sp[3],
    gap: sp[2],
  };
}

/** Get shadow styles based on theme */
export function getShadow(size: "sm" | "md" | "lg", isDark: boolean) {
  return isDark ? shadows.dark[size] : shadows.light[size];
}
