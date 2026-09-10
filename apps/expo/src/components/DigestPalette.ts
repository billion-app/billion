/** Billion Digest two-surface system: night cover, paper brief.
 *
 * SOURCE OF TRUTH for vibe bots — do not invent parallel palettes.
 * Re-exported from `~/theme` (`apps/expo/src/theme`).
 *
 * Surfaces:
 *   night/canvas  — home screen chrome, greeting bar, tab bar
 *   stone/card    — elevated cards (local rail + ALSO TODAY)
 *   paper/cream   — paper-brief surface (source pills, paper-tone headers)
 *
 * Accents:
 *   spark/copper  — kickers, active tab, carousel dots, cover rules
 *   quiet         — secondary metadata / inactive chrome
 */

export const DigestPalette = {
  night: "#0E1530",
  canvas: "#0E1530",
  stone: "#272D3C",
  card: "#272D3C",
  /** Paper-brief cream surface (source pills, paper NavHeader). */
  paper: "#F4EFE6",
  /** Alias of paper — cream brief surface. */
  cream: "#F4EFE6",
  ink: "#16131A",
  inkOnNight: "#F7F4EE",
  /** Gold accent used for cover kickers, active tab, active dots. */
  spark: "#C4A35A",
  /** Alias of spark — muted copper/gold category tags. */
  copper: "#C4A35A",
  quiet: "#8A8FA0",
  border: "#35405A",
  badgeBlue: "#6678A8",
  badgeIndigo: "#7775B7",
  badgeTeal: "#6B9895",
} as const;

export type DigestPaletteKey = keyof typeof DigestPalette;
