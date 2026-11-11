import type { ImageSource } from "expo-image";
import { useRef, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from "@ronradtke/react-native-markdown-display";

import type { BillBriefData, BriefQuote } from "./BillBrief";
import { useLanguage } from "~/hooks/useLanguage";
import {
  darkTheme,
  fontBody,
  getMarkdownStyles,
  BillReaderPalette as R,
  BillReaderSpace as S,
  BillReaderType as T,
} from "~/styles";
import { ArticleOpening } from "./ArticleOpening";
import { getBillFactFigure } from "./bill-fact-figure";
import { getBillVisualKind } from "./bill-visual";
import { BillChangeExplanation } from "./BillChangeExplanation";
import { BillChangeExplorer } from "./BillChangeExplorer";
import { BillChangeMap } from "./BillChangeMap";
import { BillFactFigure } from "./BillFactFigure";
import { Icon } from "./Icon";
import { readerLegalContext } from "./reader-legal-context";
import { readerLayout, ReaderReveal } from "./ReaderMotion";
import { ReaderPressable } from "./ReaderPressable";
import { ReaderText } from "./ReaderText";

export function BillOverview({
  data,
  officialTitle,
  billNumber,
  imageSource,
  onRead,
  onDetails,
  onOriginal,
  onViewSource,
  onJump,
}: {
  data: BillBriefData;
  officialTitle: string;
  billNumber?: string | null;
  imageSource?: ImageSource;
  onRead: () => void;
  onDetails: () => void;
  onOriginal: () => void;
  onViewSource: (quote: BriefQuote) => void;
  onJump?: (y: number, animated: boolean) => void;
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const rootY = useRef(0);
  const figureY = useRef(0);
  const sectionY = useRef<
    Partial<Record<"changes" | "people" | "questions", number>>
  >({});
  const hasDeck = !!data.summary?.trim();
  const [person, setPerson] = useState<number | null>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [storyVisible, setStoryVisible] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const activePerson = person === null ? null : data.affected[person];
  const lead = data.changes[0];
  const firstUnknown = data.unknowns[0];
  const story = data.deepDive;
  const figure = getBillFactFigure(data.facts);
  const showChangeMap = getBillVisualKind(data.facts) === "changes";
  // A provision label can depend on context the opening has not supplied yet.
  // Older briefs keep their source title until a standalone headline is authored.
  const headline = data.headline ?? officialTitle;
  const state = t(
    readerLegalContext(data.legalStatus, data.sourceStatus).statusKey,
  );
  const markdownStyles = getMarkdownStyles({
    ...darkTheme,
    foreground: R.text,
    accent: R.link,
    muted: R.surface,
  });

  return (
    <Animated.View
      key={fontScale}
      layout={readerLayout}
      style={s.root}
      testID="bill-overview"
      onLayout={(event) => {
        rootY.current = event.nativeEvent.layout.y;
      }}
    >
      <ArticleOpening
        title={headline}
        titleTestID="overview-headline"
        imageSource={imageSource}
        imageCredit={t("readerUi.aiIllustration")}
        metadata={
          <>
            {billNumber ? <Text style={s.billNumber}>{billNumber}</Text> : null}
            <Text style={s.legalState}>{state}</Text>
          </>
        }
      />
      {hasDeck && data.summary ? (
        <ReaderText
          text={data.summary}
          terms={data.terms}
          style={s.deck}
          emphasize={false}
        />
      ) : null}
      <View style={s.readerTools}>
        <Text style={[s.attribution, { marginTop: 0 }]}>
          {t("readerUi.billionAi")}
        </Text>
        {onJump ? (
          <ReaderPressable
            style={s.contentsToggle}
            onPress={() => setContentsOpen(true)}
            accessibilityRole="button"
            accessibilityState={{ expanded: contentsOpen }}
            testID="overview-contents"
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon name="book" size={16} color={R.muted} />
            </View>
            <Text style={s.jumpText}>{t("readerUi.onThisPage")}</Text>
          </ReaderPressable>
        ) : null}
      </View>
      {lead ? (
        <Animated.View
          style={s.changes}
          layout={readerLayout}
          onLayout={(event) => {
            sectionY.current.changes = event.nativeEvent.layout.y;
          }}
        >
          {showChangeMap || data.changes.length <= 1 ? (
            <Text
              style={s.sectionHeading}
              accessibilityRole="header"
              testID="overview-main-change"
            >
              {t(
                readerLegalContext(data.legalStatus, data.sourceStatus)
                  .scenarioKey,
              )}
            </Text>
          ) : null}
          {!showChangeMap && data.changes.length > 1 ? (
            <BillChangeExplorer data={data} onViewSource={onViewSource} />
          ) : (
            <BillChangeExplanation
              change={lead}
              presentation="story"
              showScenario={false}
              index={0}
              legalStatus={data.legalStatus}
              sourceStatus={data.sourceStatus}
              sourceLabel={data.sourceLabel}
              terms={data.terms}
              onViewSource={onViewSource}
            />
          )}
          {showChangeMap ? (
            <BillChangeMap data={data} onViewSource={onViewSource} />
          ) : null}
          {figure ? (
            <View
              onLayout={(event) => {
                figureY.current = event.nativeEvent.layout.y;
              }}
            >
              <BillFactFigure
                figure={figure}
                onViewSource={onViewSource}
                changes={data.changes}
                legalStatus={data.legalStatus}
                sourceStatus={data.sourceStatus}
                onInspect={
                  onJump
                    ? (y) =>
                        onJump(
                          Math.max(
                            0,
                            rootY.current +
                              (sectionY.current.changes ?? 0) +
                              figureY.current +
                              y -
                              S.group,
                          ),
                          !reduceMotion,
                        )
                    : undefined
                }
              />
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {data.affected.length ? (
        <Animated.View
          layout={readerLayout}
          style={s.section}
          testID="overview-people"
          onLayout={(event) => {
            sectionY.current.people = event.nativeEvent.layout.y;
          }}
        >
          <Text style={s.sectionHeading} accessibilityRole="header">
            {t("readerUi.whoCouldBeAffected")}
          </Text>
          {data.affected.map((item, index) => (
            <Animated.View key={index} layout={readerLayout} style={s.person}>
              <ReaderPressable
                style={s.personToggle}
                onPress={() => setPerson(index)}
                accessibilityRole="button"
                accessibilityState={{ selected: person === index }}
                accessibilityLabel={item.group}
                testID={"overview-person-" + index}
              >
                <Text style={s.personName}>{item.group}</Text>
                <Icon name="chevR" size={17} color={R.muted} />
              </ReaderPressable>
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}

      {firstUnknown ? (
        <Animated.View
          layout={readerLayout}
          style={s.uncertainty}
          testID="overview-uncertainty"
          onLayout={(event) => {
            sectionY.current.questions = event.nativeEvent.layout.y;
          }}
        >
          <Text style={s.sectionHeading} accessibilityRole="header">
            {t("readerUi.whatRemainsUnclear")}
          </Text>
          <ReaderText text={firstUnknown} terms={data.terms} />
          {questionsOpen ? (
            <ReaderReveal style={s.questions}>
              {data.unknowns.slice(1).map((text, index) => (
                <ReaderText key={index} text={text} terms={data.terms} />
              ))}
            </ReaderReveal>
          ) : null}
          {data.unknowns.length > 1 ? (
            <ReaderPressable
              style={s.textAction}
              onPress={() => setQuestionsOpen((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: questionsOpen }}
              testID="overview-more-questions"
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Icon
                  name={questionsOpen ? "minus" : "help"}
                  size={16}
                  color={R.muted}
                />
              </View>
              <Text style={s.quietAction}>
                {t(
                  questionsOpen
                    ? "readerUi.fewerQuestions"
                    : "readerUi.moreQuestions",
                )}
              </Text>
            </ReaderPressable>
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.View layout={readerLayout} style={s.ending}>
        <View style={s.readingLinks}>
          {story ? (
            <ReaderPressable
              style={s.textAction}
              onPress={() => setStoryVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("readerUi.readStory")}
              testID="overview-read"
            >
              <Icon name="book" size={17} color={R.muted} />
              <Text style={s.supportingLink}>{t("readerUi.readStory")}</Text>
            </ReaderPressable>
          ) : null}
          <ReaderPressable
            style={s.textAction}
            onPress={onRead}
            accessibilityRole="button"
            accessibilityLabel={t("readerUi.fullBrief")}
            testID="overview-full-brief"
          >
            <Icon name="layers" size={17} color={R.muted} />
            <Text style={s.supportingLink}>{t("readerUi.fullBrief")}</Text>
          </ReaderPressable>
          <ReaderPressable
            style={s.textAction}
            onPress={onDetails}
            accessibilityRole="button"
            accessibilityLabel={t("readerUi.billDetails")}
            testID="overview-bill-details"
          >
            <Icon name="info" size={17} color={R.muted} />
            <Text style={s.supportingLink}>{t("readerUi.billDetails")}</Text>
          </ReaderPressable>
        </View>
        <ReaderPressable
          style={s.original}
          onPress={onOriginal}
          accessibilityRole="button"
          testID="overview-original"
        >
          <Icon name="doc" size={19} color={R.link} />
          <View style={s.originalCopy}>
            <Text style={s.actionText}>
              {t("readerUi.originalLegislation")}
            </Text>
            <Text style={s.sourceIdentity}>
              {billNumber} · {officialTitle}
            </Text>
          </View>
        </ReaderPressable>
      </Animated.View>

      <Modal
        visible={!!activePerson}
        animationType={reduceMotion ? "none" : "slide"}
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => setPerson(null)}
      >
        <View
          style={[
            s.sheet,
            { paddingTop: Platform.OS === "ios" ? 12 : insets.top + 12 },
          ]}
          accessibilityViewIsModal
        >
          <View style={s.sheetToolbar}>
            <Text style={s.contentsTitle} accessibilityRole="header">
              {activePerson?.group}
            </Text>
            <ReaderPressable
              style={s.utilityAction}
              onPress={() => setPerson(null)}
              accessibilityRole="button"
              accessibilityLabel={t("readerUi.close")}
              testID="overview-person-close"
            >
              <Icon name="close" size={20} color={R.text} />
            </ReaderPressable>
          </View>
          <ScrollView
            contentContainerStyle={[
              s.sheetContent,
              { paddingBottom: insets.bottom + S.block },
            ]}
          >
            <View style={s.personContext}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Icon name="users" size={17} color={R.secondary} />
              </View>
              <Text style={[s.sectionHeading, { marginBottom: 0 }]}>
                {t("readerUi.whoCouldBeAffected")}
              </Text>
            </View>
            {activePerson ? (
              <ReaderText text={activePerson.effect} terms={data.terms} />
            ) : null}
            <Text style={s.sourceIdentity}>{t("readerUi.billionAi")}</Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={contentsOpen}
        animationType={reduceMotion ? "none" : "slide"}
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => setContentsOpen(false)}
      >
        <View
          style={[
            s.sheet,
            { paddingTop: Platform.OS === "ios" ? 12 : insets.top + 12 },
          ]}
          accessibilityViewIsModal
        >
          <View style={s.sheetToolbar}>
            <Text style={s.contentsTitle} accessibilityRole="header">
              {t("readerUi.onThisPage")}
            </Text>
            <ReaderPressable
              style={s.utilityAction}
              onPress={() => setContentsOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t("readerUi.close")}
              testID="overview-contents-close"
            >
              <Icon name="close" size={20} color={R.text} />
            </ReaderPressable>
          </View>
          <ScrollView
            contentContainerStyle={[
              s.contentsList,
              { paddingBottom: insets.bottom + S.block },
            ]}
          >
            {(
              [
                {
                  key: "changes",
                  icon: "sliders",
                  label: "readerUi.changeQuestion",
                  visible: !!lead,
                },
                {
                  key: "people",
                  icon: "users",
                  label: "readerUi.peopleQuestion",
                  visible: data.affected.length > 0,
                },
                {
                  key: "questions",
                  icon: "help",
                  label: "readerUi.unknownQuestion",
                  visible: data.unknowns.length > 0,
                },
              ] as const
            )
              .filter((item) => item.visible)
              .map((item) => (
                <ReaderPressable
                  key={item.key}
                  style={s.contentsLink}
                  accessibilityRole="button"
                  testID={`overview-jump-${item.key}`}
                  onPress={() => {
                    setContentsOpen(false);
                    const y = sectionY.current[item.key];
                    if (y !== undefined)
                      onJump?.(
                        Math.max(0, rootY.current + y - S.group),
                        !reduceMotion,
                      );
                  }}
                >
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Icon name={item.icon} size={17} color={R.muted} />
                  </View>
                  <Text style={s.contentsLinkText}>{t(item.label)}</Text>
                </ReaderPressable>
              ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={storyVisible}
        animationType={reduceMotion ? "none" : "slide"}
        presentationStyle="pageSheet"
        allowSwipeDismissal
        onRequestClose={() => setStoryVisible(false)}
      >
        <View
          style={[
            s.sheet,
            { paddingTop: Platform.OS === "ios" ? 12 : insets.top + 12 },
          ]}
          accessibilityViewIsModal
        >
          <View style={s.sheetToolbar}>
            <Text style={[s.attribution, { flex: 1, marginTop: 0 }]}>
              {t("readerUi.billionAi")} · {billNumber}
            </Text>
            <ReaderPressable
              style={s.utilityAction}
              onPress={() => setStoryVisible(false)}
              accessibilityRole="button"
              accessibilityLabel={t("readerUi.close")}
              testID="overview-close"
            >
              <Icon name="close" size={20} color={R.text} />
            </ReaderPressable>
          </View>
          <ScrollView
            contentContainerStyle={[
              s.sheetContent,
              { paddingBottom: insets.bottom + 28 },
            ]}
          >
            <Text style={s.legalState}>{state}</Text>
            <Text style={s.headline}>{story?.title}</Text>
            <Markdown
              style={{
                ...markdownStyles,
                body: { ...markdownStyles.body, ...T.body },
                heading1: {
                  ...markdownStyles.heading1,
                  ...T.title,
                  fontFamily: fontBody.semibold,
                  color: R.text,
                },
                heading2: {
                  ...markdownStyles.heading2,
                  ...T.title,
                  fontFamily: fontBody.semibold,
                  color: R.text,
                },
              }}
            >
              {story?.body ?? ""}
            </Markdown>
            {data.unknowns.length ? (
              <View style={s.uncertainty}>
                <Text style={s.sectionHeading}>
                  {t("readerUi.whatRemainsUnclear")}
                </Text>
                {data.unknowns.map((text, index) => (
                  <ReaderText key={index} text={text} terms={data.terms} />
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { paddingTop: 0 },
  readerTools: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: S.group,
    marginTop: S.inline,
  },
  contentsToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: S.inline,
  },
  contentsTitle: { ...T.title, color: R.text, flex: 1 },
  contentsList: { paddingHorizontal: S.page, paddingTop: S.group },
  contentsLink: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: S.group,
    paddingVertical: S.group,
  },
  contentsLinkText: { ...T.body, color: R.text, flex: 1 },
  jumpText: { ...T.label, color: R.muted },
  billNumber: { ...T.label, color: R.secondary },
  legalState: { ...T.label, color: R.text, opacity: 0.76 },
  headline: { ...T.display, color: R.text },
  deck: {
    ...T.body,
    color: R.reading,
    marginTop: 0,
  },
  attribution: { ...T.label, color: R.muted, marginTop: 8 },
  utilityAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  changes: { marginTop: S.group },
  questions: { gap: 8 },
  section: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: R.rule,
  },
  sectionHeading: {
    ...T.label,
    color: R.secondary,
    marginBottom: S.inline,
  },
  supportingHeading: {
    ...T.label,
    color: R.muted,
    marginTop: 20,
    marginBottom: 8,
  },
  provision: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: R.rule,
  },
  disclosureHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 60,
    paddingVertical: 16,
  },
  provisionTitle: {
    ...T.body,
    fontFamily: fontBody.medium,
    flex: 1,
    color: R.text,
  },
  person: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: R.rule },
  personToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
  },
  personName: {
    ...T.body,
    fontFamily: fontBody.medium,
    color: R.text,
    flex: 1,
  },
  personContext: { flexDirection: "row", alignItems: "center", gap: S.inline },
  uncertainty: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: R.rule,
    gap: 8,
  },
  textAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
  },
  actionText: { ...T.action, color: R.link },
  ending: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: R.rule,
    marginTop: 24,
  },
  readingLinks: { paddingVertical: S.group, gap: S.inline },
  supportingLink: { ...T.label, color: R.reading, flexShrink: 1 },
  quietAction: { ...T.label, color: R.muted, flexShrink: 1 },
  original: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: R.rule,
  },
  originalCopy: { flex: 1, gap: 6 },
  sourceIdentity: { ...T.label, color: R.muted },
  sheet: { flex: 1, backgroundColor: R.canvas },
  sheetToolbar: {
    paddingLeft: S.page,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetContent: { paddingHorizontal: S.page, paddingTop: 24, gap: 24 },
});
