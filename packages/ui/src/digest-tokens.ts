/**
 * Digest design tokens — the phone's palette, hairlines, radii and spacing as
 * plain data.
 *
 * Two clients read these: the Expo app re-exports them from `~/styles`, and
 * the web reader emits them as CSS custom properties. Keeping them free of
 * React Native and browser imports is what lets both do that, and keeping
 * them in one module is what stops the two surfaces drifting apart while the
 * palette is still being tuned. Change a value here, not in a consumer.
 */

/** Layered surface planes on top of the navy base. */
export const planes = {
  navy: "#0E1530", // primary canvas / app chrome
  slate: "#272D3C", // cards, elevated containers
  surface: "#323848", // popovers, nested elements, icon tiles
  hi: "#3C4356", // highest plane — pressed / hover
  ink: "#0A0F22", // text on light surfaces / verbatim panel bg
  /** Paper-brief cream (source pills, paper NavHeader, article reader) */
  paper: "#F4EFE6",
} as const;

/** Hairline border tiers. */
export const hair = {
  1: "rgba(255,255,255,0.06)",
  2: "rgba(255,255,255,0.10)",
  3: "rgba(255,255,255,0.16)",
} as const;

/**
 * Digest / editorial accents that sit on the shared plane system.
 * Keep these here — do not invent a parallel palette file.
 */
export const digest = {
  /** Gold — selected tab, active dots, and section eyebrows only */
  spark: "#D4AF37",
  /** Filled primary actions (buttons, selected segments) — not gold */
  primary: "#4A7CFF",
  /** Alias of spark */
  copper: "#D4AF37",
  /** Primary text on night surfaces */
  inkOnNight: "#F7F4EE",
  /** Primary text on paper surfaces */
  inkOnPaper: "#16131A",
  /** Secondary metadata / inactive chrome */
  quiet: "#8A8FA0",
  /** Chrome hairline / tab top border */
  border: "#35405A",
  badgeBlue: "#6678A8",
  badgeIndigo: "#7775B7",
  badgeTeal: "#6B9895",
} as const;

/** Radii measured from Digest home / tab chrome. */
export const DigestRadii = {
  card: 24,
  coverArt: 8,
  menu: 14,
  menuRow: 10,
  tabActivePill: 14,
  dot: 99,
  sourcePill: 0,
} as const;

/** Spacing rhythm from Digest home. */
export const DigestSpace = {
  screenPadX: 16,
  sectionPadTop: 16,
  sectionPadBottom: 12,
  alsoSectionPadTop: 24,
  alsoSectionPadBottom: 12,
  railGap: 12,
  cardBodyPadX: 16,
  cardBodyPadTop: 16,
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

/** Hairlines / translucent overlays used on Digest surfaces. */
export const DigestHair = {
  sectionRule: "rgba(247,244,238,0.16)",
  cardBorder: "rgba(247,244,238,0.08)",
  coverBorder: "rgba(247,244,238,0.10)",
  coverRule: "rgba(247,244,238,0.14)",
  menuBorder: "rgba(247,244,238,0.12)",
  menuRowOn: "rgba(212,175,55,0.14)",
  tabActivePill: "rgba(74,124,255,0.20)",
  menuScrim: "rgba(0,0,0,0.42)",
  inkFaint: "rgba(22,19,26,0.05)",
  inkHair: "rgba(22,19,26,0.10)",
  inkBorder: "rgba(22,19,26,0.12)",
  inkWash: "rgba(22,19,26,0.14)",
  inkMuted: "rgba(22,19,26,0.42)",
  inkHint: "rgba(22,19,26,0.50)",
  inkSecondary: "rgba(22,19,26,0.72)",
} as const;

/** Content-type color + badge label (bill/exec/court/news/local). */
export const contentType = {
  bill: { color: "#4A7CFF", label: "BILL" },
  exec: { color: "#6366F1", label: "ORDER" },
  court: { color: "#0891B2", label: "CASE" },
  news: { color: "#8A8FA0", label: "NEWS" },
  local: { color: "#4A7CFF", label: "LOCAL" },
} as const;

/**
 * Outcome hues for "who it lands on". A navigation aid, not a verdict: four
 * distinct nonpartisan colours, never the only signal.
 */
export const outcomeColors = {
  gains: "#55D6BE",
  loses: "#FF9575",
  mixed: "#B8A1FF",
  unclear: "#F4C95D",
} as const;

/** The two sides of the dual lens. */
export const lensColors = {
  proponents: "#6DD6C7",
  opponents: "#F2B56B",
} as const;
