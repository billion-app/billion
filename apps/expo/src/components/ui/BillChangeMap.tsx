import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";

import type { BillBriefData, BriefQuote } from "./BillBrief";
import type { IconName } from "./Icon";
import type { StringKey } from "~/i18n/strings";
import { useLanguage } from "~/hooks/useLanguage";
import {
  fontBody,
  BillReaderPalette as R,
  BillReaderSpace as S,
  BillReaderType as T,
} from "~/styles";
import { BillChangeExplanation } from "./BillChangeExplanation";
import { Icon } from "./Icon";
import {
  ReaderDisclosureIcon,
  readerLayout,
  ReaderReveal,
} from "./ReaderMotion";
import { ReaderPressable } from "./ReaderPressable";

const KIND: Record<
  BillBriefData["changes"][number]["kind"],
  {
    label: StringKey;
    icon: IconName;
  }
> = {
  creates: { label: "readerUi.creates", icon: "plus" },
  repeals: { label: "readerUi.repeals", icon: "minus" },
  expands: { label: "readerUi.expands", icon: "external" },
  restricts: { label: "readerUi.restricts", icon: "block" },
  requires: { label: "readerUi.requires", icon: "check" },
  waives: { label: "readerUi.waives", icon: "undo" },
  funds: { label: "readerUi.funds", icon: "layers" },
  transfers: { label: "readerUi.transfers", icon: "arrowRight" },
};

/** Parallel branches describe provisions, not a sequence, vote count or impact
 * score. Their supplied titles and source-backed explanations carry meaning. */
export function BillChangeMap({
  data,
  onViewSource,
  initialOpenIndex = null,
  testIDPrefix = "overview",
  presentation = "story",
}: {
  data: BillBriefData;
  onViewSource?: (quote: BriefQuote) => void;
  initialOpenIndex?: number | null;
  testIDPrefix?: string;
  presentation?: "story" | "comparison";
}) {
  const { t } = useLanguage();
  const { fontScale } = useWindowDimensions();
  const [openIndex, setOpenIndex] = useState(initialOpenIndex);
  const center =
    S.group +
    T.label.lineHeight * fontScale +
    4 +
    (T.body.lineHeight * fontScale) / 2;
  if (!data.changes.length) return null;
  return (
    <Animated.View layout={readerLayout} style={s.map} testID="bill-change-map">
      <View style={s.origin}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name="doc" size={16} color={R.secondary} />
        </View>
        <Text style={s.caption}>
          {t(
            data.legalStatus === "enacted"
              ? "readerUi.enactedChangeMap"
              : "readerUi.proposedChangeMap",
          )}
        </Text>
      </View>
      {data.changes.map((change, index) => {
        const expanded = openIndex === index;
        const kind = KIND[change.kind];
        const label = t(kind.label).toLocaleLowerCase();
        const kindLabel = label.charAt(0).toLocaleUpperCase() + label.slice(1);
        const last = index === data.changes.length - 1;
        return (
          <Animated.View key={index} layout={readerLayout} style={s.branch}>
            <View style={s.rail} pointerEvents="none" accessible={false}>
              <Svg width={24} height="100%" style={s.connector}>
                {!last ? (
                  <Line
                    x1={8}
                    x2={8}
                    y1={0}
                    y2="100%"
                    stroke={R.rule}
                    strokeWidth={1}
                  />
                ) : null}
                <Path
                  d={`M 8 ${last ? 0 : center - 8} V ${center - 8} Q 8 ${center} 16 ${center} H 24`}
                  stroke={R.rule}
                  strokeWidth={1}
                  fill="none"
                />
              </Svg>
            </View>
            <View style={s.content}>
              <ReaderPressable
                style={s.toggle}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${kindLabel}. ${change.title.replaceAll("**", "")}`}
                onPress={() => setOpenIndex(expanded ? null : index)}
                testID={`${testIDPrefix}-change-${index}`}
              >
                <View style={[s.symbol, { top: center - 12 }]}>
                  {change.kind === "expands" ? (
                    <Svg width={22} height={22} viewBox="0 0 24 24">
                      <Path
                        d="M4 9V4H9 M4 4L10 10 M20 15V20H15 M20 20L14 14"
                        stroke={expanded ? R.secondary : R.text}
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </Svg>
                  ) : (
                    <Icon
                      name={kind.icon}
                      size={22}
                      color={expanded ? R.secondary : R.text}
                    />
                  )}
                </View>
                <View style={s.copy}>
                  <Text style={s.kind}>{kindLabel}</Text>
                  <Text style={s.title}>
                    {change.title.replaceAll("**", "")}
                  </Text>
                </View>
                <ReaderDisclosureIcon expanded={expanded} />
              </ReaderPressable>
              {expanded ? (
                <ReaderReveal style={s.detail}>
                  <BillChangeExplanation
                    change={change}
                    index={index}
                    presentation={presentation}
                    legalStatus={data.legalStatus}
                    sourceStatus={data.sourceStatus}
                    sourceLabel={data.sourceLabel}
                    terms={data.terms}
                    onViewSource={onViewSource}
                    testIDPrefix={`${testIDPrefix}-map`}
                  />
                </ReaderReveal>
              ) : null}
            </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  map: { paddingTop: S.group, paddingBottom: S.inline },
  origin: { flexDirection: "row", alignItems: "center", gap: S.group },
  caption: { ...T.label, color: R.muted, flex: 1 },
  branch: { flexDirection: "row" },
  rail: { width: S.block },
  connector: { position: "absolute", left: 0, top: 0 },
  content: { flex: 1 },
  toggle: {
    flexDirection: "row",
    gap: S.inline,
    minHeight: 72,
    paddingVertical: S.group,
    paddingLeft: S.block + S.inline,
    alignItems: "center",
  },
  symbol: {
    position: "absolute",
    left: 0,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 4 },
  kind: { ...T.label, color: R.muted },
  title: { ...T.body, fontFamily: fontBody.medium, color: R.text },
  detail: { paddingTop: 4, paddingBottom: S.inline },
});
