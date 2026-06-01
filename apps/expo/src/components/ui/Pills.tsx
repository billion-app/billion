/** Pills — horizontally scrolling row of filter chips (full-bleed edges). */
import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

export function Pills({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
    >
      {children}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
});
