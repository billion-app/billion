import Svg, { Circle, Path } from "react-native-svg";

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
      return (
        <Svg {...common}>
          <Path d="M4.5 11.2 12 4.8l7.5 6.4" {...stroke} />
          <Path d="M6.4 10.6V19h11.2v-8.4" {...stroke} />
          <Path d="M10.2 19v-5.2h3.6V19" {...stroke} />
        </Svg>
      );
    case "browse":
      return (
        <Svg {...common}>
          <Circle cx="11" cy="11" r="7" {...stroke} />
          <Path d="M16.5 16.5 21 21" {...stroke} />
        </Svg>
      );
    case "elections":
      return (
        <Svg {...common}>
          <Path d="M12 20h9" {...stroke} />
          <Path
            d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
            {...stroke}
          />
        </Svg>
      );
    case "feedback":
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
