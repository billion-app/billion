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

import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";

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
        <Icon name="search" size={20} color={colors.textSecondary} />
      </View>
      <TextInput
        style={l.search}
        placeholderTextColor={colors.textSecondary}
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
  children,
  contentStyle,
}: {
  title?: string;
  /** Extra content rendered under the title, inside the header padding. */
  headerExtra?: ReactNode;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={l.screen}>
      <ScrollView
        style={l.scroll}
        contentContainerStyle={[
          { paddingTop: insets.top + 4, paddingBottom: 120 },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {(title ?? headerExtra) && (
          <View style={l.headerPad}>
            {title && <Text style={l.display}>{title}</Text>}
            {headerExtra}
          </View>
        )}
        {children}
      </ScrollView>
    </View>
  );
}

export const l = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  scroll: { flex: 1 },
  headerPad: { paddingHorizontal: 20 },
  display: {
    fontFamily: fontDisplay.bold,
    fontSize: 36,
    color: colors.white,
    lineHeight: 40,
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
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingLeft: 46,
    paddingRight: 16,
    color: colors.white,
    fontFamily: "AlbertSans-Regular",
    fontSize: 16,
  },
});
