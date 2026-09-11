/**
 * Layout helpers shared across screens — section kicker, card container,
 * search input, and the top-level tab screen scaffold. These collapse the
 * repeated "slate card", "uppercase label", and "scrolling screen" patterns
 * into one place.
 */
import type { ReactNode } from "react";
import type {
  StyleProp,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from "react-native";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  colors,
  fontBody,
  fontDisplay,
  hair,
  planes,
  DigestHair,
  DigestPalette,
  DigestSpace,
} from "~/styles";
import { Icon } from "./Icon";

/** Uppercase, letter-spaced section label. */
export function Kicker({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[l.kicker, style]}>{children}</Text>;
}

/** Slate card container (the app's default elevated surface). */
export function Card({
  children,
  style,
  flush,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** flush = no padding, clipped corners (for grouped rows). */
  flush?: boolean;
}) {
  return (
    <View style={[l.card, flush ? l.cardFlush : l.cardPad, style]}>
      {children}
    </View>
  );
}

/** Search field with a leading magnifier icon. `style` lays out the wrapper. */
export function SearchInput({
  style,
  ...props
}: Omit<TextInputProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[l.searchWrap, style]}>
      <View style={l.searchIcon}>
        <Icon name="search" size={20} color={DigestPalette.quiet} />
      </View>
      <TextInput
        style={l.search}
        placeholderTextColor={DigestPalette.quiet}
        {...props}
      />
    </View>
  );
}

/**
 * Top-level tab screen: navy background, top-inset-aware scroll, and an
 * optional large display title. Children render inside the scroll.
 */
export function TabScreen({
  title,
  headerExtra,
  action,
  children,
  contentStyle,
}: {
  title?: string;
  /** Extra content rendered under the title, inside the header padding. */
  headerExtra?: ReactNode;
  /** Trailing control on the title line (profile mark, etc.). */
  action?: ReactNode;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  // Tab bar chrome (~72) + home indicator + breath — last rows must clear fold.
  const tabClearance = 88 + Math.max(insets.bottom, 12) + 48;
  return (
    <View style={[l.screen, { backgroundColor: DigestPalette.canvas }]}>
      {/* Title pinned outside ScrollView so pull-to-refresh / banners cannot eat it. */}
      {(title ?? headerExtra ?? action) && (
        <View style={[l.headerPad, { paddingTop: insets.top + 6 }]}>
          {title ?? action ? (
            <View style={l.titleRow}>
              {title ? (
                <Text style={[l.display, l.titleFill]}>{title}</Text>
              ) : (
                <View style={l.titleFill} />
              )}
              {action}
            </View>
          ) : null}
          {headerExtra}
        </View>
      )}
      <ScrollView
        style={l.scroll}
        contentContainerStyle={[
          {
            paddingTop: title || headerExtra ? 8 : insets.top + 4,
            paddingBottom: tabClearance,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Avoid iOS UIRefreshControl "Refreshing…" chrome on tab screens.
        bounces={false}
        overScrollMode="never"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export const l = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DigestPalette.canvas },
  scroll: { flex: 1 },
  headerPad: { paddingHorizontal: DigestSpace.screenPadX },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  /** Display serif loads async — let the title take remaining width so a
      fallback-font measurement cannot clip the last glyph. */
  titleFill: { flex: 1 },
  display: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    color: DigestPalette.inkOnNight,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 16,
  },
  cardPad: { padding: 16 },
  cardFlush: { overflow: "hidden" },
  searchWrap: { position: "relative" },
  searchIcon: { position: "absolute", left: 16, top: 15, zIndex: 1 },
  search: {
    height: 50,
    backgroundColor: DigestPalette.stone,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: 12,
    paddingLeft: 46,
    paddingRight: 16,
    color: DigestPalette.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 16,
  },
});
