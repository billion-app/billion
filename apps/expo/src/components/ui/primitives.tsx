/**
 * Core design primitives mirroring new-design/billion-core.jsx.
 * Small, focused, themed RN building blocks.
 */
import type { ViewStyle } from "react-native";
import { useEffect, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";

import type { IconName } from "./Icon";
import type { ContentTypeKey } from "~/styles";
import {
  colors,
  contentType,
  fontBody,
  fontSize,
  hair,
  planes,
} from "~/styles";
import { Icon } from "./Icon";

/* ---------- Badge — content-type uppercase pill ---------- */
export function Badge({
  type,
  children,
}: {
  type: ContentTypeKey;
  children?: string;
}) {
  const t = contentType[type];
  return (
    <View style={[s.badge, { backgroundColor: t.color }]}>
      <Text style={s.badgeText}>{children ?? t.label}</Text>
    </View>
  );
}

/* ---------- Spine — thin colored bar on a card's left edge ---------- */
export function Spine({ type }: { type: ContentTypeKey }) {
  return (
    <View style={[s.spine, { backgroundColor: contentType[type].color }]} />
  );
}

/* ---------- Avatar — initials on a tinted plane ---------- */
export function Avatar({
  name = "JA",
  size = 44,
  color = colors.bill,
  imageUri,
}: {
  name?: string;
  size?: number;
  color?: string;
  imageUri?: string;
}) {
  const [failedImageUri, setFailedImageUri] = useState<string>();

  return (
    <View
      style={[
        s.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
        },
      ]}
    >
      {imageUri && failedImageUri !== imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          onError={() => setFailedImageUri(imageUri)}
        />
      ) : (
        <Text
          style={{
            fontFamily: "InriaSerif-Bold",
            fontSize: size * 0.36,
            color,
          }}
        >
          {name}
        </Text>
      )}
    </View>
  );
}

/* ---------- Toggle — switch ---------- */
export function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  const [x] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    Animated.timing(x, {
      toValue: on ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [on, x]);
  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={[
        s.toggle,
        {
          backgroundColor: on ? colors.green[500] : planes.surface,
          borderColor: on ? "transparent" : hair[2],
        },
      ]}
    >
      <Animated.View
        style={[
          s.toggleKnob,
          { left: x.interpolate({ inputRange: [0, 1], outputRange: [3, 23] }) },
        ]}
      />
    </Pressable>
  );
}

/* ---------- Buttons ---------- */
export function PrimaryButton({
  label,
  onPress,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      style={[s.primaryBtn, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={s.primaryBtnText}>{label}</Text>
      {icon && <Icon name={icon} size={18} color={planes.ink} />}
    </TouchableOpacity>
  );
}

export function GhostButton({
  label,
  onPress,
  color = "rgba(255,255,255,0.7)",
  style,
}: {
  label: string;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      style={[s.ghostBtn, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.ghostBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- Pill — filter / interest chip ---------- */
export function Pill({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <TouchableOpacity
      style={[
        s.pill,
        active
          ? { backgroundColor: colors.white, borderColor: colors.white }
          : { backgroundColor: "transparent", borderColor: hair[2] },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && (
        <Icon
          name={icon}
          size={14}
          color={active ? planes.ink : "rgba(255,255,255,0.6)"}
        />
      )}
      <Text
        style={[
          s.pillText,
          { color: active ? planes.ink : "rgba(255,255,255,0.6)" },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ---------- Placeholder — striped art block ---------- */
export function Placeholder({
  label,
  height = 150,
  radius = 12,
  style,
}: {
  label: string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.ph, { height, borderRadius: radius }, style]}>
      <Text style={s.phLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: "center",
  },
  badgeText: {
    color: colors.white,
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  spine: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 3,
  },
  avatar: {
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    alignItems: "center",
    justifyContent: "center",
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  toggleKnob: {
    position: "absolute",
    top: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  primaryBtn: {
    height: 52,
    width: "100%",
    borderRadius: 9999,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.base,
    color: planes.ink,
  },
  ghostBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  ghostBtnText: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.base,
  },
  pill: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pillText: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.sm,
  },
  ph: {
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  phLabel: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: hair[3],
    borderStyle: "dashed",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
    overflow: "hidden",
  },
});
