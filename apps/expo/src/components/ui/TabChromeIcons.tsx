/**
 * Hand-crafted tab chrome glyphs for Billion Digest.
 * Original SVG stroke icons (viewBox 0 0 24 24) — not stock icon packs.
 * License: original work for Billion; royalty-free for this product.
 */
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type TabChromeName =
  | "home"
  | "browse"
  | "elections"
  | "feedback"
  | "settings";

export function TabChromeIcon({
  name,
  size = 22,
  color,
  strokeWidth = 1.6,
}: {
  name: TabChromeName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
  };
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "home":
      // Peaked brief-house — doorway open, editorial not generic home glyph.
      return (
        <Svg {...common}>
          <Path d="M4.5 11.2 12 4.8l7.5 6.4" {...stroke} />
          <Path d="M6.4 10.6V19h11.2v-8.4" {...stroke} />
          <Path d="M10.2 19v-5.2h3.6V19" {...stroke} />
        </Svg>
      );
    case "browse":
      // Lens with a short handle — catalog search, quieter than stock magnifier.
      return (
        <Svg {...common}>
          <Circle cx="10.6" cy="10.6" r="5.4" {...stroke} />
          <Path d="M14.6 14.6 19.2 19.2" {...stroke} />
          <Path d="M8.4 10.6h4.4" {...stroke} strokeWidth={strokeWidth * 0.85} />
        </Svg>
      );
    case "elections":
      // Ballot card with check — civic, not a pencil.
      return (
        <Svg {...common}>
          <Rect x="5.2" y="3.6" width="13.6" height="16.8" rx="1.6" {...stroke} />
          <Path d="M8.4 9.2h7.2" {...stroke} />
          <Path d="M8.4 12.4h7.2" {...stroke} />
          <Path d="M8.4 15.6h4.2" {...stroke} />
          <Path d="M8.2 6.4l1.3 1.3 2.4-2.5" {...stroke} />
        </Svg>
      );
    case "feedback":
      // Squared correspondence mark with two brief lines.
      return (
        <Svg {...common}>
          <Path
            d="M5 6.2h14a1.4 1.4 0 0 1 1.4 1.4v7.2a1.4 1.4 0 0 1-1.4 1.4H11l-3.6 2.6V16.2H5A1.4 1.4 0 0 1 3.6 14.8V7.6A1.4 1.4 0 0 1 5 6.2Z"
            {...stroke}
          />
          <Path d="M8 9.6h8" {...stroke} strokeWidth={strokeWidth * 0.9} />
          <Path d="M8 12.4h5.5" {...stroke} strokeWidth={strokeWidth * 0.9} />
        </Svg>
      );
    case "settings":
      // Dial marks around a hub — quieter luxury than a 6-tooth gear.
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="3.1" {...stroke} />
          <Path d="M12 3.6v2.2" {...stroke} />
          <Path d="M12 18.2v2.2" {...stroke} />
          <Path d="M3.6 12h2.2" {...stroke} />
          <Path d="M18.2 12h2.2" {...stroke} />
          <Path d="M6.05 6.05l1.56 1.56" {...stroke} />
          <Path d="M16.39 16.39l1.56 1.56" {...stroke} />
          <Path d="M17.95 6.05l-1.56 1.56" {...stroke} />
          <Path d="M7.61 16.39l-1.56 1.56" {...stroke} />
        </Svg>
      );
    default:
      return null;
  }
}

export const TAB_ROUTE_ICON: Record<string, TabChromeName> = {
  index: "home",
  feed: "browse",
  elections: "elections",
  feedback: "feedback",
  settings: "settings",
};
