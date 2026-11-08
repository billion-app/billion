import type { ImageSource } from "expo-image";
import type { LayoutChangeEvent } from "react-native";
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

import type { ArticleBlockData, BillArticleData } from "./bill-article";
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
import {
  articleBlocks,
  articleChanges,
  changeContext,
  figureForBlock,
  figureShowsTimeline,
} from "./bill-article";
import { BillChangeExplanation } from "./BillChangeExplanation";
import { BillChangeExplorer } from "./BillChangeExplorer";
import { BillChangeMap } from "./BillChangeMap";
import { BillFactFigure } from "./BillFactFigure";
import { Icon } from "./Icon";
import { readerLegalContext } from "./reader-legal-context";
import { readerLayout, ReaderReveal } from "./ReaderMotion";
import { ReaderPressable } from "./ReaderPressable";
import { ReaderText } from "./ReaderText";

type Person = BillBriefData["affected"][number];

// The story presentation renders the blocks a casual reader needs first. Depth
// blocks (glossary, history, arguments, outside reading) live in the full brief.
export function BillOverview({
  article,
  officialTitle,
  billNumber,
  imageSource,
  onRead,
  onDetails,
  onOriginal,
  onViewSource,
  onJump,
}: {
  article: BillArticleData;
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
  const blockY = useRef<Record<number, number>>({});
  const hasDeck = !!article.summary?.trim();
  const [activePerson, setPerson] = useState<Person | null>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [storyVisible, setStoryVisible] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const changes = articleChanges(article);
  const unknowns = articleBlocks(article, "unknowns").flatMap(
    (block) => block.items,
  );
  const people = articleBlocks(article, "affected").flatMap(
    (block) => block.items,
  );
  const story = articleBlocks(article, "furtherReading").find(
    (block) => block.deepDive,
  )?.deepDive;
  // A provision label can depend on context the opening has not supplied yet.
  // Older briefs keep their source title until a standalone headline is authored.
  const headline = article.headline ?? officialTitle;
  const legal = readerLegalContext(article.legalStatus, article.sourceStatus);
  const state = t(legal.statusKey);
  const jumpTo = (index: number, offset = 0) => {
    const y = blockY.current[index];
    if (y !== undefined)
      onJump?.(
        Math.max(0, rootY.current + y + offset - S.group),
        !reduceMotion,
      );
  };
  const markdownStyles = getMarkdownStyles({
    ...darkTheme,
    foreground: R.text,
    accent: R.link,
    muted: R.surface,
  });

  const renderBlock = (block: ArticleBlockData, index: number) => {
    const onLayout = (event: LayoutChangeEvent) => {
      blockY.current[index] = event.nativeEvent.layout.y;
    };
    switch (block.type) {
      case "changes": {
        const lead = block.items[0];
        if (!lead) return null;
        const map = block.display === "map";
        return (
          <Animated.View
            key={index}
            style={s.changes}
            layout={readerLayout}
            onLayout={onLayout}
          >
            {map || block.items.length <= 1 ? (
              <Text
                style={s.sectionHeading}
                accessibilityRole="header"
                testID="overview-main-change"
              >
                {t(legal.scenarioKey)}
              </Text>
            ) : null}
            {!map && block.items.length > 1 ? (
              <BillChangeExplorer
                data={changeContext(article, block.items)}
                onViewSource={onViewSource}
              />
            ) : (
              <BillChangeExplanation
                change={lead}
                presentation="story"
                showScenario={false}
                index={0}
                legalStatus={article.legalStatus}
                sourceStatus={article.sourceStatus}
                sourceLabel={article.sourceLabel}
                terms={article.terms}
                onViewSource={onViewSource}
              />
            )}
            {map ? (
              <BillChangeMap
                data={changeContext(article, block.items)}
                onViewSource={onViewSource}
              />
            ) : null}
          </Animated.View>
        );
      }
      case "figure": {
        const figure = figureForBlock(block);
        return figure ? (
          <Animated.View key={index} layout={readerLayout} onLayout={onLayout}>
            <BillFactFigure
              figure={figure}
              timeline={figureShowsTimeline(block)}
              onViewSource={onViewSource}
              changes={changes}
              legalStatus={article.legalStatus}
              sourceStatus={article.sourceStatus}
              onInspect={onJump ? (y) => jumpTo(index, y) : undefined}
            />
          </Animated.View>
        ) : null;
      }
      case "affected":
        return (
          <Animated.View
            key={index}
            layout={readerLayout}
            style={s.section}
            testID="overview-people"
            onLayout={onLayout}
          >
            <Text style={s.sectionHeading} accessibilityRole="header">
              {t("readerUi.whoCouldBeAffected")}
            </Text>
            {block.items.map((item, itemIndex) => (
              <Animated.View
                key={itemIndex}
                layout={readerLayout}
                style={s.person}
              >
                <ReaderPressable
                  style={s.personToggle}
                  onPress={() => setPerson(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activePerson === item }}
                  accessibilityLabel={item.group}
                  testID={"overview-person-" + people.indexOf(item)}
                >
                  <Text style={s.personName}>{item.group}</Text>
                  <Icon name="chevR" size={17} color={R.muted} />
                </ReaderPressable>
              </Animated.View>
            ))}
          </Animated.View>
        );
      case "unknowns": {
        const [first, ...rest] = block.items;
        if (!first) return null;
        return (
          <Animated.View
            key={index}
            layout={readerLayout}
            style={s.uncertainty}
            testID="overview-uncertainty"
            onLayout={onLayout}
          >
            <Text style={s.sectionHeading} accessibilityRole="header">
              {t("readerUi.whatRemainsUnclear")}
            </Text>
            <ReaderText text={first} terms={article.terms} />
            {questionsOpen ? (
              <ReaderReveal style={s.questions}>
                {rest.map((text, textIndex) => (
                  <ReaderText
                    key={textIndex}
                    text={text}
                    terms={article.terms}
                  />
                ))}
              </ReaderReveal>
            ) : null}
            {rest.length ? (
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
        );
      }
      default:
        // Depth blocks belong to the full brief; unknown blocks are skipped.
        return null;
    }
  };

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
      {hasDeck && article.summary ? (
        <ReaderText
          text={article.summary}
          terms={article.terms}
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
      {article.blocks.map(renderBlock)}

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
              <ReaderText text={activePerson.effect} terms={article.terms} />
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
                  index: article.blocks.findIndex(
                    (block) => block.type === "changes" && block.items.length,
                  ),
                },
                {
                  key: "people",
                  icon: "users",
                  label: "readerUi.peopleQuestion",
                  index: article.blocks.findIndex(
                    (block) => block.type === "affected",
                  ),
                },
                {
                  key: "questions",
                  icon: "help",
                  label: "readerUi.unknownQuestion",
                  index: article.blocks.findIndex(
                    (block) => block.type === "unknowns",
                  ),
                },
              ] as const
            )
              .filter((item) => item.index >= 0)
              .map((item) => (
                <ReaderPressable
                  key={item.key}
                  style={s.contentsLink}
                  accessibilityRole="button"
                  testID={`overview-jump-${item.key}`}
                  onPress={() => {
                    setContentsOpen(false);
                    jumpTo(item.index);
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
            {unknowns.length ? (
              <View style={s.uncertainty}>
                <Text style={s.sectionHeading}>
                  {t("readerUi.whatRemainsUnclear")}
                </Text>
                {unknowns.map((text, index) => (
                  <ReaderText key={index} text={text} terms={article.terms} />
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
