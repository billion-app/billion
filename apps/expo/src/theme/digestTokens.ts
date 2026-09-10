/**
 * Digest visual system tokens — extracted from DigestHome / DigestGreetingBar /
 * DigestPalette. Other vibe bots MUST import from here (or DigestPalette) instead
 * of inventing new colors/radii.
 *
 * SOURCE OF TRUTH screens: DigestHome, DigestGreetingBar, DigestPalette.
 * Do not redesign Digest home. Do not invent a parallel theme.
 */

import { DigestPalette } from "~/components/DigestPalette";
import { fontBody, fontDisplay, fontEditorial } from "~/styles";

export { DigestPalette };
export type { DigestPaletteKey } from "~/components/DigestPalette";

/** Color roles mapped from Digest home (night cover + paper brief). */
export const DigestColor = {
  /** Home / greeting / tab bar canvas */
  screenBg: DigestPalette.canvas,
  /** Elevated card fill (local rail + ALSO TODAY) */
  cardBg: DigestPalette.card,
  /** Paper-brief cream (source pills, paper headers) */
  paperBg: DigestPalette.paper,
  creamBg: DigestPalette.cream,
  /** Primary text on night surfaces */
  textOnNight: DigestPalette.inkOnNight,
  /** Primary text on paper surfaces */
  textOnPaper: DigestPalette.ink,
  /** Accent / active / copper-gold tags */
  accent: DigestPalette.spark,
  copper: DigestPalette.copper,
  /** Secondary metadata / inactive */
  muted: DigestPalette.quiet,
  /** Chrome hairline / tab top border */
  border: DigestPalette.border,
  /** Location menu surface */
  menuBg: DigestPalette.stone,
  badgeBlue: DigestPalette.badgeBlue,
  badgeIndigo: DigestPalette.badgeIndigo,
  badgeTeal: DigestPalette.badgeTeal,
} as const;

/**
 * Radii measured from DigestHome / DigestGreetingBar / TabBar.
 * Prefer these over inventing new corner radii on non-home screens.
 */
export const DigestRadii = {
  /** Local news cards + ALSO TODAY card (Digest home SoT). Prefer modest radii — see CRAFT.md. */
  card: 24,
  /** Cover art thumbnail inside ALSO TODAY */
  coverArt: 8,
  /** Location dropdown menu */
  menu: 14,
  /** Menu row highlight */
  menuRow: 10,
  /** Tab bar active icon pill */
  tabActivePill: 14,
  /** Carousel dots */
  dot: 99,
  /** Source pill is square-edged in Digest home (no radius) */
  sourcePill: 0,
} as const;

/** Spacing rhythm from Digest home. */
export const DigestSpace = {
  /** 4px base rhythm — prefer multiples of 4 (see CRAFT.md). */
  screenPadX: 16,
  sectionPadTop: 16,
  sectionPadBottom: 12,
  alsoSectionPadTop: 24,
  alsoSectionPadBottom: 12,
  railGap: 12,
  cardBodyPadX: 16,
  cardBodyPadTop: 16,
  /** Hug-content: pad only — never pair with copy minHeight. */
  cardBodyPadBottom: 12,
  coverPadX: 20,
  coverPadTop: 20,
  coverPadBottom: 16,
  tabBarPadX: 12,
  tabBarPadTop: 8,
  tabBarInnerHeight: 64,
  greetingCompactInner: 48,
  greetingPadLeft: 16,
} as const;

/** Hairlines / translucent overlays used on Digest home. */
export const DigestHair = {
  sectionRule: "rgba(247,244,238,0.16)",
  cardBorder: "rgba(247,244,238,0.08)",
  coverBorder: "rgba(247,244,238,0.10)",
  coverRule: "rgba(247,244,238,0.14)",
  menuBorder: "rgba(247,244,238,0.12)",
  menuRowOn: "rgba(196,163,90,0.14)",
  tabActivePill: "rgba(196,163,90,0.16)",
  menuScrim: "rgba(0,0,0,0.42)",
} as const;

/** Shadows from Digest greeting location menu. */
export const DigestShadow = {
  menu: {
    shadowColor: DigestPalette.night,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
} as const;

/**
 * Typography roles — font families from ~/styles (loaded via expo-font).
 * Digest home uses display serif for headlines, Albert Sans for UI/meta,
 * and platform script for greeting ceremony only.
 */
export const DigestFonts = {
  display: fontDisplay,
  editorial: fontEditorial,
  body: fontBody,
  /** Greeting ceremony only (iOS Snell Roundhand / GreatVibes). Do not use on other screens. */
  greetingScript: {
    ios: "Snell Roundhand",
    default: "GreatVibes-Regular",
  },
} as const;

/** Type scale roles measured from DigestHome / DigestGreetingBar / TabBar. */
export const DigestType = {
  sectionEyebrow: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 2.1,
    color: DigestPalette.spark,
  },
  sectionTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 29,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: DigestPalette.inkOnNight,
  },
  alsoTitle: {
    fontFamily: fontBody.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    color: DigestPalette.inkOnNight,
  },
  cardKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.15,
    color: DigestPalette.quiet,
  },
  cardTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.45,
    color: DigestPalette.inkOnNight,
  },
  cardDek: {
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: DigestPalette.quiet,
  },
  coverKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: DigestPalette.spark,
  },
  coverHeadline: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.45,
    color: DigestPalette.inkOnNight,
  },
  coverMeta: {
    fontFamily: fontBody.regular,
    fontSize: 11,
    color: DigestPalette.quiet,
  },
  sourcePill: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.35,
    color: DigestPalette.ink,
  },
  brandLockup: {
    fontFamily: fontBody.bold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: DigestPalette.inkOnNight,
  },
  tabLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.15,
  },
} as const;

/** Card geometry from Digest local rail. */
export const DigestCardLayout = {
  width: 334,
  photoHeight: 190,
  snapInterval: 292,
  /**
   * Cover/ALSO TODAY hugs content — do NOT apply as minHeight.
   * Kept undefined-by-omission on purpose (CRAFT.md anti-AI: no empty wells).
   */
  coverArtWidth: 116,
  coverArtHeight: 138,
} as const;

/** Tab bar active/inactive — already wired in TabBar.tsx via DigestPalette. */
export const DigestTabBar = {
  background: DigestPalette.canvas,
  borderTop: DigestPalette.border,
  active: DigestPalette.spark,
  inactive: DigestPalette.quiet,
  activePillBg: "rgba(196,163,90,0.16)",
  iconSize: 22,
  labelSize: 11,
} as const;

/** Convenience bag for vibe bots. */
export const DigestTokens = {
  palette: DigestPalette,
  color: DigestColor,
  radii: DigestRadii,
  space: DigestSpace,
  hair: DigestHair,
  shadow: DigestShadow,
  fonts: DigestFonts,
  type: DigestType,
  card: DigestCardLayout,
  tabBar: DigestTabBar,
} as const;
