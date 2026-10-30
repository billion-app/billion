import { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { BillBriefData, BriefQuote } from "./BillBrief";
import { useLanguage } from "~/hooks/useLanguage";
import {
  BillReaderPalette as R,
  BillReaderSpace as S,
  BillReaderType as T,
} from "~/styles";
import { BillChangeExplanation } from "./BillChangeExplanation";
import { Icon } from "./Icon";
import { readerLegalContext } from "./reader-legal-context";
import { readerLayout, ReaderReveal } from "./ReaderMotion";
import { ReaderPressable } from "./ReaderPressable";

/** One consequence at a time, with direct access to every supplied provision.
 * Changing the selection remounts its comparison and quotation disclosures. */
export function BillChangeExplorer({
  data,
  onViewSource,
  showFirstTitle = false,
  testIDPrefix = "overview",
}: {
  data: BillBriefData;
  onViewSource?: (quote: BriefQuote) => void;
  showFirstTitle?: boolean;
  testIDPrefix?: string;
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [selection, setSelected] = useState(0);
  const [indexOpen, setIndexOpen] = useState(false);
  const selected = Math.max(0, Math.min(selection, data.changes.length - 1));
  const change = data.changes[selected];
  if (!change) return null;
  return (
    <Animated.View layout={readerLayout} testID="bill-change-explorer">
      <View style={s.navigation}>
        <Text
          style={s.heading}
          accessibilityRole="header"
          testID={`${testIDPrefix}-main-change`}
        >
          {t(
            readerLegalContext(data.legalStatus, data.sourceStatus).scenarioKey,
          )}
        </Text>
      </View>
      <ReaderReveal key={selected}>
        {showFirstTitle || selected > 0 ? (
          <Text style={s.title} accessibilityRole="header">
            {change.title.replaceAll("**", "")}
          </Text>
        ) : null}
        <BillChangeExplanation
          change={change}
          index={selected}
          legalStatus={data.legalStatus}
          sourceStatus={data.sourceStatus}
          sourceLabel={data.sourceLabel}
          terms={data.terms}
          presentation="story"
          showScenario={false}
          onViewSource={onViewSource}
          testIDPrefix={testIDPrefix}
        />
      </ReaderReveal>
      {data.changes.length > 1 ? (
        <ReaderPressable
          style={s.indexToggle}
          onPress={() => setIndexOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("readerUi.otherChangesQuestion")}
          accessibilityHint={t("readerUi.changePosition", {
            current: selected + 1,
            total: data.changes.length,
          })}
          accessibilityState={{ expanded: indexOpen }}
          testID="explore-change-index"
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="layers" size={16} color={R.muted} />
          </View>
          <Text style={s.indexLabel}>{t("readerUi.otherChangesQuestion")}</Text>
        </ReaderPressable>
      ) : null}
      <Modal
        visible={indexOpen}
        animationType={reduceMotion ? "none" : "slide"}
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => setIndexOpen(false)}
      >
        <View
          style={[
            s.sheet,
            { paddingTop: Platform.OS === "ios" ? 12 : insets.top + 12 },
          ]}
          accessibilityViewIsModal
        >
          <View style={s.sheetToolbar}>
            <Text style={s.sheetTitle} accessibilityRole="header">
              {t("readerUi.allChanges")}
            </Text>
            <ReaderPressable
              style={s.arrow}
              onPress={() => setIndexOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t("readerUi.close")}
              testID="explore-change-index-close"
            >
              <Icon name="close" size={22} color={R.text} />
            </ReaderPressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + S.block }}
          >
            {data.changes.map((item, index) => (
              <ReaderPressable
                key={index}
                style={s.indexRow}
                onPress={() => {
                  setSelected(index);
                  setIndexOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === index }}
                accessibilityLabel={t("readerUi.exploreChange", {
                  current: index + 1,
                  total: data.changes.length,
                  title: item.title.replaceAll("**", ""),
                })}
                testID={`explore-change-${index}`}
              >
                <Text
                  style={[s.indexNumber, selected === index && s.activeNumber]}
                >
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <Text style={s.indexTitle}>
                  {item.title.replaceAll("**", "")}
                </Text>
                {selected === index ? (
                  <Icon name="check" size={18} color={R.secondary} />
                ) : null}
              </ReaderPressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.group,
    marginBottom: S.inline,
  },
  heading: {
    ...T.label,
    color: R.secondary,
    flex: 1,
  },
  indexToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: S.inline,
  },
  indexLabel: { ...T.label, color: R.muted, fontVariant: ["tabular-nums"] },
  activeNumber: { color: R.secondary },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...T.title, color: R.text, marginBottom: S.inline },
  sheet: { flex: 1, backgroundColor: R.canvas },
  sheetToolbar: {
    paddingLeft: S.page,
    paddingRight: S.page - S.inline,
    paddingBottom: S.group,
    flexDirection: "row",
    alignItems: "center",
    gap: S.inline,
  },
  sheetTitle: { ...T.title, color: R.text, flex: 1 },
  indexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.group,
    minHeight: 64,
    paddingVertical: S.group,
    marginHorizontal: S.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: R.rule,
  },
  indexNumber: { ...T.label, color: R.muted, minWidth: 24 },
  indexTitle: { ...T.body, color: R.text, flex: 1 },
});
