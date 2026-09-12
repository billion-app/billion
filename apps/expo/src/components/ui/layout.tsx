/**
 * Shared screen layout: kicker, card, search field, tab scaffold.
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
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
  DigestType,
} from "~/styles";
import { SearchMark } from "~/components/digest/CraftMarks";

export function Kicker({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[l.kicker, style]}>{children}</Text>;
}

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

export function SearchInput({
  style,
  ...props
}: Omit<TextInputProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[l.searchWrap, style]}>
      <View style={l.searchIcon}>
        <SearchMark size={20} color={DigestPalette.spark} />
      </View>
      <TextInput
        style={l.search}
        placeholderTextColor={DigestHair.inkMuted}
        {...props}
      />
    </View>
  );
}

export function TabScreen({
  title,
  headerExtra,
  action,
  children,
  contentStyle,
}: {
  title?: string;
  headerExtra?: ReactNode;
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
    ...DigestType.sectionEyebrow,
    marginBottom: 12,
  },
  card: {
    backgroundColor: DigestPalette.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
  },
  cardPad: { padding: 16 },
  cardFlush: { overflow: "hidden" },
  searchWrap: { position: "relative" },
  searchIcon: { position: "absolute", left: 18, top: 18, zIndex: 1 },
  search: {
    height: 56,
    backgroundColor: DigestPalette.paper,
    borderWidth: 0,
    borderRadius: 28,
    paddingLeft: 48,
    paddingRight: 18,
    color: DigestPalette.ink,
    fontFamily: fontBody.medium,
    fontSize: 17,
  },
});
