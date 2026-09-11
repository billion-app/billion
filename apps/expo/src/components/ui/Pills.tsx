/** Pills — wrapping (default) or optional horizontal-scroll chip row. */
import type { ReactNode } from "react";
import { Children } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { DigestSpace } from "~/styles";

const CHIP_GAP = 8;

/**
 * Chip row. Default `layout="wrap"` so every label (incl. "Briefings") is fully
 * visible at rest — horizontal ScrollView always peeks/clips the last chip on
 * resting screenshots; endSpacer cannot fix that. Optional `layout="scroll"`
 * keeps a horizontal rail for screens that need it.
 */
export function Pills({
  children,
  layout = "wrap",
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
        nestedScrollEnabled
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
