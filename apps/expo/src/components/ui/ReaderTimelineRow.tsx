import type { ReactNode } from "react";
import {
  PixelRatio,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { BillReaderPalette as R, BillReaderSpace as S } from "~/styles";

/** The marker center follows the first text line. The connector terminates at
 * the next row's center, even when Dynamic Type changes the row height. */
export function ReaderTimelineRow({
  children,
  firstLineHeight,
  hasNext,
  hollow = false,
}: {
  children: ReactNode;
  firstLineHeight: number;
  hasNext: boolean;
  hollow?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const center = PixelRatio.roundToNearestPixel(
    (firstLineHeight * fontScale) / 2,
  );
  return (
    <View style={s.row}>
      <View
        style={s.rail}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {hasNext ? (
          <View style={[s.connector, { top: center, bottom: -center }]} />
        ) : null}
        <View style={[s.dot, { top: center - 3 }, hollow && s.hollow]} />
      </View>
      <View style={[s.copy, hasNext && { paddingBottom: S.block }]}>
        {children}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", gap: S.group },
  rail: { width: S.inline, alignItems: "center" },
  connector: {
    position: "absolute",
    width: StyleSheet.hairlineWidth,
    backgroundColor: R.rule,
  },
  dot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: R.secondary,
    borderColor: R.secondary,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hollow: { backgroundColor: R.canvas, borderColor: R.muted },
  copy: { flex: 1, gap: S.inline },
});
