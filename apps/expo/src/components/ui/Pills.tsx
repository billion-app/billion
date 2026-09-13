/** Pills — horizontally scrolling row of filter chips (full-bleed edges). */
import type { ReactNode } from "react";
import { Children } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { DigestSpace } from "~/styles";

const CHIP_GAP = 8;

/**
 * Chip row. Default `layout="scroll"` keeps All / Bills / Executive / Courts /
 * Briefings on one line (last chip may peek). Optional `layout="wrap"` is for
 * screens that need a wrapping chip cloud.
 */
export function Pills({
  children,
  layout = "scroll",
}: {
  children: ReactNode;
  layout?: "wrap" | "scroll";
}) {
  const items = Children.toArray(children);

  if (layout === "scroll") {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        style={s.scroll}
        contentContainerStyle={s.scrollRow}
      >
        {items.map((child, index) => (
          <View
            key={index}
            style={index < items.length - 1 ? s.chipScrollGap : s.chipWrap}
          >
            {child}
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={s.wrapRow}>
      {items.map((child, index) => (
        <View key={index} style={s.chipWrap}>
          {child}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: DigestSpace.screenPadX,
    gap: CHIP_GAP,
    paddingBottom: 4,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    paddingHorizontal: DigestSpace.screenPadX,
    paddingBottom: 4,
  },
  chipWrap: {
    flexShrink: 0,
  },
  chipScrollGap: {
    flexShrink: 0,
    marginRight: CHIP_GAP,
  },
});
