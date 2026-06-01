/**
 * Icon — single mapping from new-design glyph names to @expo/vector-icons.
 * Centralizing here keeps the rest of the app on design-language names
 * ("chevR", "scale", "vote") and makes swapping the icon set a one-file change.
 */
import { Feather, FontAwesome, Ionicons } from "@expo/vector-icons";

import { colors } from "~/styles";

type IconName =
  | "search"
  | "home"
  | "feed"
  | "layers"
  | "settings"
  | "bookmark"
  | "bookmarkFill"
  | "share"
  | "chevR"
  | "chevL"
  | "chevD"
  | "external"
  | "close"
  | "check"
  | "pin"
  | "calendar"
  | "scale"
  | "user"
  | "sliders"
  | "shield"
  | "help"
  | "message"
  | "info"
  | "lock"
  | "block"
  | "doc"
  | "trash"
  | "undo"
  | "plus"
  | "bell"
  | "clock"
  | "filter"
  | "flag"
  | "globe"
  | "vote"
  | "edit"
  | "heart"
  | "download"
  | "sparkle";

type Family = "ion" | "feather" | "fa";

const MAP: Record<IconName, { family: Family; name: string }> = {
  search: { family: "feather", name: "search" },
  home: { family: "feather", name: "home" },
  feed: { family: "feather", name: "layout" },
  layers: { family: "feather", name: "layers" },
  settings: { family: "feather", name: "settings" },
  bookmark: { family: "feather", name: "bookmark" },
  bookmarkFill: { family: "ion", name: "bookmark" },
  share: { family: "feather", name: "share" },
  chevR: { family: "feather", name: "chevron-right" },
  chevL: { family: "feather", name: "chevron-left" },
  chevD: { family: "feather", name: "chevron-down" },
  external: { family: "feather", name: "external-link" },
  close: { family: "feather", name: "x" },
  check: { family: "feather", name: "check" },
  pin: { family: "feather", name: "map-pin" },
  calendar: { family: "feather", name: "calendar" },
  scale: { family: "fa", name: "balance-scale" },
  user: { family: "feather", name: "user" },
  sliders: { family: "feather", name: "sliders" },
  shield: { family: "feather", name: "shield" },
  help: { family: "feather", name: "help-circle" },
  message: { family: "feather", name: "message-square" },
  info: { family: "feather", name: "info" },
  lock: { family: "feather", name: "lock" },
  block: { family: "feather", name: "slash" },
  doc: { family: "feather", name: "file-text" },
  trash: { family: "feather", name: "trash-2" },
  undo: { family: "feather", name: "rotate-ccw" },
  plus: { family: "feather", name: "plus" },
  bell: { family: "feather", name: "bell" },
  clock: { family: "feather", name: "clock" },
  filter: { family: "feather", name: "filter" },
  flag: { family: "feather", name: "flag" },
  globe: { family: "feather", name: "globe" },
  vote: { family: "feather", name: "edit-3" },
  edit: { family: "feather", name: "edit-2" },
  heart: { family: "feather", name: "heart" },
  download: { family: "feather", name: "download" },
  sparkle: { family: "ion", name: "sparkles-outline" },
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof Feather>["style"];
}

export function Icon({
  name,
  size = 22,
  color = colors.white,
  style,
}: IconProps) {
  const def = MAP[name];
  if (def.family === "ion") {
    return (
      <Ionicons
        name={def.name as React.ComponentProps<typeof Ionicons>["name"]}
        size={size}
        color={color}
        style={style}
      />
    );
  }
  if (def.family === "fa") {
    return (
      <FontAwesome
        name={def.name as React.ComponentProps<typeof FontAwesome>["name"]}
        size={size}
        color={color}
        style={style}
      />
    );
  }
  return (
    <Feather
      name={def.name as React.ComponentProps<typeof Feather>["name"]}
      size={size}
      color={color}
      style={style}
    />
  );
}

export type { IconName };
