import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import type { BillBriefData, BriefQuote } from "./BillBrief";
import { useLanguage } from "~/hooks/useLanguage";
import {
  fontBody,
  fontEditorial,
  BillReaderPalette as R,
  BillReaderType as T,
} from "~/styles";
import { Icon } from "./Icon";
import { readerLegalContext } from "./reader-legal-context";
import { readerLayout, ReaderReveal } from "./ReaderMotion";
import { ReaderPopup } from "./ReaderPopup";
import { ReaderPressable } from "./ReaderPressable";
import { ReaderText } from "./ReaderText";
import { ReaderTimelineRow } from "./ReaderTimelineRow";

type Panel = "answer" | "compare" | "source";

/** Short answers and quotations float above the story; comparisons stay in context. */
export function BillChangeExplanation({
  change,
  index,
  legalStatus,
  sourceStatus,
  sourceLabel,
  terms,
  onViewSource,
  testIDPrefix = "overview",
  presentation = "comparison",
  showScenario = true,
}: {
  change: BillBriefData["changes"][number];
  index: number;
  legalStatus: BillBriefData["legalStatus"];
  sourceStatus?: string;
  sourceLabel?: string;
  terms: BillBriefData["terms"];
  onViewSource?: (quote: BriefQuote) => void;
  testIDPrefix?: string;
  presentation?: "story" | "comparison";
  showScenario?: boolean;
}) {
  const { t } = useLanguage();
  const [panel, setPanel] = useState<Panel | null>(
    presentation === "comparison" ? "compare" : null,
  );
  const intro = presentation === "story" ? change.reader : undefined;
  const context = readerLegalContext(legalStatus, sourceStatus);
  const enacted = context.enacted;
  // A provision quote cannot stand in for evidence of a different follow-up answer.
  const sourceQuote = intro ? intro.quote : change.quote;
  const id = (name: string) =>
    `${testIDPrefix}-${name}${index ? `-${index}` : ""}`;
  const actions = [
    ...(intro
      ? [{ key: "answer", icon: "help", label: "readerUi.answerTab" } as const]
      : []),
    ...(!intro
      ? [
          {
            key: "compare",
            icon: "clock",
            label: "readerUi.compareTab",
          } as const,
        ]
      : []),
    ...(sourceQuote
      ? [{ key: "source", icon: "doc", label: "readerUi.sourceTab" } as const]
      : []),
  ];
  const actionButtons = actions.map((action) => (
    <ReaderPressable
      key={action.key}
      style={[s.action, panel === action.key && s.selectedAction]}
      onPress={() => setPanel(action.key)}
      accessibilityRole="button"
      accessibilityState={{ selected: panel === action.key }}
      testID={id(action.key === "source" ? "quote" : action.key)}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon
          name={action.icon}
          size={16}
          color={panel === action.key ? R.secondary : intro ? R.text : R.muted}
        />
      </View>
      <Text
        style={[
          s.actionLabel,
          intro && s.popupActionLabel,
          panel === action.key && s.selectedLabel,
        ]}
      >
        {t(action.label)}
      </Text>
    </ReaderPressable>
  ));

  const details = (
    <>
      {panel === "answer" && intro ? (
        <ReaderText text={intro.answer} terms={terms} />
      ) : null}
      {panel === "compare" ? (
        <View style={s.comparisonFlow}>
          {([true, false] as const).map((previous) => (
            <ReaderTimelineRow
              key={String(previous)}
              firstLineHeight={T.label.lineHeight}
              hasNext={previous}
              hollow={previous}
            >
              <Text
                style={[s.stageLabel, !previous && s.changeLabel]}
                accessibilityRole="header"
                testID={id(previous ? "now" : "proposal")}
              >
                {t(
                  previous
                    ? enacted
                      ? "readerUi.beforeLaw"
                      : context.closed
                        ? "readerUi.beforeProposal"
                        : "readerUi.currentSituation"
                    : enacted
                      ? "readerUi.underLaw"
                      : context.closed
                        ? "readerUi.underProposal"
                        : "readerUi.ifPasses",
                )}
              </Text>
              {!previous ? (
                <Text style={s.stageLabel}>
                  {t(
                    enacted
                      ? "readerUi.enactedChange"
                      : "readerUi.proposedChange",
                  )}
                </Text>
              ) : null}
              <ReaderText
                text={previous ? change.before : change.after}
                terms={terms}
              />
            </ReaderTimelineRow>
          ))}
        </View>
      ) : null}
      {panel === "source" && sourceQuote ? (
        <View style={s.quote}>
          <Text style={s.stageLabel}>
            {sourceLabel ?? t("readerUi.originalLegislation")}
          </Text>
          {sourceQuote.locator ? (
            <Text style={s.stageLabel}>{sourceQuote.locator}</Text>
          ) : null}
          <Text style={s.quoteText}>{sourceQuote.text}</Text>
          {onViewSource ? (
            <ReaderPressable
              style={s.action}
              onPress={() => {
                setPanel(null);
                if (sourceQuote) onViewSource(sourceQuote);
              }}
              accessibilityRole="button"
              testID={id("source-passage")}
            >
              <Icon name="doc" size={16} color={R.muted} />
              <Text style={s.sourceLink}>{t("readerUi.viewSource")}</Text>
            </ReaderPressable>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <Animated.View layout={readerLayout} style={s.explanation}>
      {showScenario && (intro || panel !== "compare") ? (
        <Text style={s.scenario}>{t(context.scenarioKey)}</Text>
      ) : null}
      {intro ? (
        <>
          <ReaderText text={intro.summary} emphasize={false} />
          <ReaderPressable
            style={s.readerQuestion}
            onPress={() => setPanel("answer")}
            accessibilityRole="button"
            accessibilityState={{ expanded: panel !== null }}
            testID={id("reader-question")}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon name="help" size={17} color={R.muted} />
            </View>
            <Text style={s.readerQuestionText}>{intro.question}</Text>
          </ReaderPressable>
        </>
      ) : panel !== "compare" ? (
        <ReaderText text={change.after} terms={terms} />
      ) : null}
      {!intro ? <View style={s.actions}>{actionButtons}</View> : null}
      {panel === "compare" ? (
        <ReaderReveal style={s.panel}>
          <View style={s.panelToolbar}>
            {intro ? (
              <View style={[s.actions, { flex: 1 }]}>{actionButtons}</View>
            ) : (
              <Text style={s.panelTitle}>{t("readerUi.compareTab")}</Text>
            )}
            <ReaderPressable
              style={s.close}
              onPress={() => setPanel(null)}
              accessibilityRole="button"
              accessibilityLabel={t("readerUi.close")}
              testID={id("detail-close")}
            >
              <Icon name="close" size={18} color={R.muted} />
            </ReaderPressable>
          </View>
          {details}
        </ReaderReveal>
      ) : null}
      {panel === "answer" || panel === "source" ? (
        <ReaderPopup
          title={intro ? intro.question : t("readerUi.sourceTab")}
          onClose={() => setPanel(null)}
          actions={
            intro && sourceQuote ? (
              <View style={s.actions}>{actionButtons}</View>
            ) : undefined
          }
          testID={id("popup")}
        >
          {details}
        </ReaderPopup>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  explanation: { gap: 8, paddingBottom: 16 },
  scenario: { ...T.label, color: R.secondary },
  readerQuestion: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 10,
    minHeight: 44,
    paddingVertical: 8,
    marginTop: 8,
    maxWidth: "100%",
  },
  readerQuestionText: {
    ...T.body,
    fontFamily: fontBody.medium,
    color: R.reading,
    flexShrink: 1,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  action: {
    maxWidth: "100%",
    alignSelf: "flex-start",
    paddingVertical: 8,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionLabel: { ...T.label, color: R.muted, flexShrink: 1 },
  popupActionLabel: { color: R.text },
  selectedLabel: { color: R.secondary },
  selectedAction: { borderBottomWidth: 2, borderBottomColor: R.secondary },
  panel: {
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: R.rule,
    paddingTop: 8,
    paddingBottom: 8,
  },
  panelToolbar: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  panelTitle: { ...T.label, color: R.muted, flex: 1, paddingTop: 10 },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  comparisonFlow: { paddingVertical: 4 },
  stageLabel: { ...T.label, fontFamily: fontBody.medium, color: R.muted },
  changeLabel: { color: R.text },
  quote: { gap: 8 },
  quoteText: {
    fontFamily: fontEditorial.regular,
    fontSize: T.body.fontSize,
    lineHeight: T.body.lineHeight,
    color: R.text,
  },
  sourceLink: { ...T.body, color: R.link, flexShrink: 1 },
});
