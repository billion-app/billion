/**
 * BillBrief — the structured replacement for a wall of markdown.
 *
 * The old explainer rendered one long markdown blob, so the reader's only
 * choices were "read all of it" or "read none of it". A brief is a stack of
 * self-contained blocks the reader can leave at any point and still have
 * learned something true:
 *
 *   summary   → one-sentence takeaway, visible by default
 *   hook      → fuller "What this means for you" explanation, on demand
 *   facts     → shared prominent figures, with complete units and conditions
 *   changes   → before → after, source quote one tap away
 *   affected  → who this lands on
 *   unknowns  → what the text does not settle
 *   terms     → glossary, collapsed
 *   history   → cited context on why the policy was not already adopted
 *   deepDive  → an optional long-form Billion article
 *   reading   → researched articles from outside publishers
 *
 * Two brand constraints shape the visual language here:
 *
 *  - Outcome meaning lives in written labels. Flat sections keep uncertainty
 *    visible without colored warning containers.
 *  - Every claim keeps a path back to the source. Change sections expose the
 *    verbatim provision that backs them, and the block ends by pointing at the
 *    official text rather than presenting itself as the last word.
 */
import type { ReactNode } from "react";
import type { StyleProp, TextProps, TextStyle } from "react-native";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import Markdown from "@ronradtke/react-native-markdown-display";

import type { StringKey } from "~/i18n/strings";
import { useLanguage } from "~/hooks/useLanguage";
import {
  darkTheme,
  fontBody,
  fontEditorial,
  getMarkdownStyles,
  hair,
  BillReaderPalette as R,
  BillReaderType as T,
} from "~/styles";
import { getBillFactFigure } from "./bill-fact-figure";
import { BillChangeExplorer } from "./BillChangeExplorer";
import { BillFactFigure } from "./BillFactFigure";
import { Icon } from "./Icon";
import { ReaderDisclosureIcon, ReaderReveal } from "./ReaderMotion";
import { ReaderPressable } from "./ReaderPressable";
import { ReaderText } from "./ReaderText";

/* ---------- data shape ---------- */
// Mirrors @acme/validators' BillBriefRecord. Redeclared rather than imported so
// the native app keeps no dependency on server-side validation code, matching
// how LensData is handled next door.

export type BriefChangeKind =
  | "creates"
  | "repeals"
  | "expands"
  | "restricts"
  | "requires"
  | "waives"
  | "funds"
  | "transfers";

export interface BriefQuote {
  text: string;
  locator?: string;
  /** Court briefs use this to disambiguate separately published documents. */
  documentId?: string;
}

export interface BillBriefData {
  /** Source-owned view metadata supplied by the article route, never generated. */
  sourceStatus?: string;
  sourceLabel?: string;
  /** Standalone article headline; older cached records may omit it. */
  headline?: string;
  /** Optional only so a pre-v8 brief held across fast refresh still renders. */
  summary?: string;
  hook: string;
  legalStatus: "proposed" | "enacted";
  facts: { label: string; value: string; note?: string; quote?: BriefQuote }[];
  changes: {
    kind: BriefChangeKind;
    title: string;
    before: string;
    after: string;
    reader?: {
      summary: string;
      question: string;
      answer: string;
      quote?: BriefQuote;
    };
    /** Generated photograph for this change, when one helps. Absent is normal. */
    imageUri?: string;
    quote?: BriefQuote;
  }[];
  affected: {
    group: string;
    takeaway?: string;
    effect: string;
    direction: "gains" | "loses" | "mixed" | "unclear";
  }[];
  unknowns: string[];
  terms: { term: string; plain: string }[];
  whyNotBefore?: {
    summary: string;
    points: {
      text: string;
      citations: { title: string; publisher: string; url: string }[];
    }[];
  };
  deepDive?: { title: string; dek: string; body: string };
  reading?: {
    title: string;
    publisher: string;
    url: string;
    whyRead: string;
  }[];
}

const DIRECTION: Record<
  BillBriefData["affected"][number]["direction"],
  StringKey
> = {
  gains: "readerUi.effectGains",
  loses: "readerUi.effectLoses",
  mixed: "readerUi.effectMixed",
  unclear: "readerUi.effectUnclear",
};

/* ---------- Inline emphasis — useful phrases, not whole paragraphs ---------- */
function EmphasizedText({
  children,
  style,
  strongStyle,
  testID,
  numberOfLines,
  ellipsizeMode,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  strongStyle?: StyleProp<TextStyle>;
  testID?: string;
  numberOfLines?: number;
  ellipsizeMode?: TextProps["ellipsizeMode"];
}) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text
      style={style}
      testID={testID}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
    >
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**")
          ? // iOS can treat one multi-word custom-font span as unbreakable.
            // Keep the real bold face per word and leave whitespace to the
            // parent Text so native layout still chooses every line break.
            part
              .slice(2, -2)
              .split(/(\s+)/)
              .map((token, tokenIndex) =>
                /^\s+$/.test(token) ? (
                  token
                ) : (
                  <Text
                    key={`${index}-${tokenIndex}`}
                    style={[s.inlineStrong, strongStyle]}
                  >
                    {token}
                  </Text>
                ),
              )
          : part,
      )}
    </Text>
  );
}

/* ---------- Hook — the one sentence that must land ---------- */
export function BillSummary({
  summary,
  text,
  legalStatus,
  accent,
  compact = false,
}: {
  compact?: boolean;
  summary?: string;
  text: string;
  legalStatus: BillBriefData["legalStatus"];
  accent: string;
}) {
  const { t: tr } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const shortText = summary ?? text;
  const hasExtendedVersion = shortText !== text;

  return (
    <View
      style={[s.summaryCard, compact && s.compactSummary]}
      testID="brief-summary"
    >
      {!compact && (
        <View style={s.summaryHead}>
          <Text style={s.summaryTitle}>{tr("readerUi.shortVersion")}</Text>
          <View style={s.summaryStatus}>
            <Text style={s.summaryStatusText}>
              {legalStatus === "enacted"
                ? tr("readerUi.law")
                : tr("readerUi.proposal")}
            </Text>
          </View>
        </View>
      )}
      <EmphasizedText
        style={[s.summaryText, compact && s.compactSummaryText]}
        testID="brief-summary-text"
      >
        {shortText}
      </EmphasizedText>
      {hasExtendedVersion ? (
        <TouchableOpacity
          style={s.summaryToggle}
          activeOpacity={0.72}
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded
              ? tr("readerUi.hideExtendedA11y")
              : tr("readerUi.readExtendedA11y")
          }
        >
          <Text style={[s.summaryToggleText, { color: accent }]}>
            {expanded
              ? tr("readerUi.hideExtended")
              : tr(compact ? "readerUi.whyMatters" : "readerUi.readExtended")}
          </Text>
          <View style={expanded ? s.chevFlip : undefined}>
            <Icon name="chevD" size={14} color={accent} />
          </View>
        </TouchableOpacity>
      ) : null}
      {expanded ? (
        <View style={s.extendedSummary} testID="brief-hook">
          <Text style={s.extendedSummaryLabel}>{tr("readerUi.extended")}</Text>
          <EmphasizedText style={s.extendedSummaryText}>{text}</EmphasizedText>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Why not before — researched history, collapsed by default ---------- */
function WhyNotBefore({
  context,
  accent,
}: {
  context: NonNullable<BillBriefData["whyNotBefore"]>;
  accent: string;
}) {
  const { t: tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const sources = [
    ...new Map(
      context.points
        .flatMap((point) => point.citations)
        .map((citation) => [citation.url, citation]),
    ).values(),
  ];
  const sourceNumber = new Map(
    sources.map((source, index) => [source.url, index + 1]),
  );

  return (
    <View style={s.contextCard} testID="brief-why-not-before">
      <TouchableOpacity
        style={s.contextToggle}
        activeOpacity={0.72}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          open ? tr("readerUi.hideHistory") : tr("readerUi.showHistory")
        }
      >
        <View style={[s.contextIcon, { backgroundColor: R.wash }]}>
          <Icon name="clock" size={15} color={R.muted} />
        </View>
        <View style={s.contextHeadingCopy}>
          <Text style={s.contextTitle}>{tr("readerUi.history")}</Text>
        </View>
        <View style={open ? s.chevFlip : undefined}>
          <Icon name="chevD" size={16} color={accent} />
        </View>
      </TouchableOpacity>

      {open ? (
        <View style={s.contextDetails}>
          <EmphasizedText style={s.contextSummary}>
            {context.summary}
          </EmphasizedText>

          {context.points.map((point, index) => (
            <View key={index} style={s.contextPoint}>
              <Text style={[s.contextIndex, { color: R.muted }]}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <View style={s.contextPointCopy}>
                <EmphasizedText style={s.contextPointText}>
                  {point.text}
                </EmphasizedText>
                <View style={s.contextCitations}>
                  {point.citations.map((citation) => (
                    <Text
                      key={citation.url}
                      style={[s.contextCitation, { color: accent }]}
                    >
                      [{sourceNumber.get(citation.url)}]
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          ))}

          <View style={s.contextSources}>
            <Text style={s.contextSourcesTitle}>{tr("readerUi.sources")}</Text>
            {sources.map((source, index) => (
              <TouchableOpacity
                key={source.url}
                style={s.contextSource}
                activeOpacity={0.7}
                onPress={() => void WebBrowser.openBrowserAsync(source.url)}
                accessibilityRole="link"
                accessibilityLabel={tr("readerUi.openSourceNumber", {
                  number: index + 1,
                  title: source.title,
                })}
              >
                <Text style={[s.contextSourceNumber, { color: accent }]}>
                  [{index + 1}]
                </Text>
                <View style={s.contextSourceCopy}>
                  <Text style={s.contextSourceTitle}>{source.title}</Text>
                  <Text style={s.contextSourcePublisher}>
                    {source.publisher}
                  </Text>
                </View>
                <Icon name="external" size={13} color={R.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Affected({ affected }: { affected: BillBriefData["affected"] }) {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <View testID="brief-affected">
      {affected.map((person, index) => (
        <View key={index} style={s.flatSection}>
          <ReaderPressable
            style={s.flatToggle}
            onPress={() => setOpenIndex(openIndex === index ? null : index)}
            accessibilityRole="button"
            accessibilityState={{ expanded: openIndex === index }}
            testID={`brief-person-${index}`}
          >
            <Text style={[s.flatTitle, { flex: 1 }]}>{person.group}</Text>
            <ReaderDisclosureIcon expanded={openIndex === index} />
          </ReaderPressable>
          {openIndex === index ? (
            <ReaderReveal style={{ paddingBottom: 24, gap: 12 }}>
              <Text style={s.affectedDirection}>
                {t(DIRECTION[person.direction])}
              </Text>
              <ReaderText text={person.effect} />
            </ReaderReveal>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/* ---------- Unknowns — the honesty block ---------- */
// Deliberately given the same visual weight as the analysis blocks. Burying it
// would let a brief read as more settled than the source actually is.
function Unknowns({ unknowns }: { unknowns: string[] }) {
  const { t: tr } = useLanguage();
  if (unknowns.length === 0) return null;
  return (
    <View style={s.unknownCard} testID="brief-unknowns">
      <View style={s.unknownHead}>
        <Icon name="help" size={15} color={R.muted} />
        <Text style={s.unknownTitle}>{tr("readerUi.unknowns")}</Text>
      </View>
      <View style={s.unknownList}>
        {unknowns.map((u, i) => (
          <View key={i} style={s.unknownRow}>
            <Text style={[s.unknownIndex, { color: R.muted }]}>
              {String(i + 1).padStart(2, "0")}
            </Text>
            <EmphasizedText style={s.unknownText}>{u}</EmphasizedText>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- Terms — essential vocabulary before the analysis ---------- */
function Terms({ terms }: { terms: BillBriefData["terms"] }) {
  const { t: tr } = useLanguage();
  const [open, setOpen] = useState(false);
  if (terms.length === 0) return null;
  return (
    <View style={s.termSection} testID="brief-key-terms">
      <TouchableOpacity
        style={s.termHeading}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID="brief-terms-toggle"
      >
        <View style={[s.termIcon, { backgroundColor: R.wash }]}>
          <Icon name="book" size={15} color={R.muted} />
        </View>
        <View style={s.termHeadingCopy}>
          <Text style={s.termTitle}>{tr("readerUi.terms")}</Text>
        </View>
        <Text style={s.changeIndex}>{terms.length}</Text>
        <Icon name={open ? "minus" : "chevD"} size={16} color={R.muted} />
      </TouchableOpacity>
      {open && (
        <View style={s.termList}>
          {terms.map((t, i) => (
            <View key={i} style={[s.termRow, { borderLeftColor: R.rule }]}>
              <Text style={[s.termName, { color: R.text }]}>{t.term}</Text>
              <EmphasizedText style={s.termPlain}>{t.plain}</EmphasizedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------- Keep reading — long form here, researched work elsewhere ---------- */
function FurtherReading({
  deepDive,
  reading,
  accent,
}: {
  deepDive: BillBriefData["deepDive"];
  reading: NonNullable<BillBriefData["reading"]>;
  accent: string;
}) {
  const { t: tr } = useLanguage();
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const markdownStyles = getMarkdownStyles(darkTheme);
  if (!deepDive && reading.length === 0) return null;

  const openExternal = (url: string) => {
    void WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  };

  return (
    <>
      <View style={s.readingList} testID="brief-further-reading">
        {deepDive ? (
          <TouchableOpacity
            style={[s.deepDiveCard, { borderLeftColor: accent }]}
            activeOpacity={0.75}
            onPress={() => setDeepDiveOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={tr("readerUi.readExplainer", {
              title: deepDive.title,
            })}
          >
            <View style={[s.readingIcon, { backgroundColor: `${accent}28` }]}>
              <Icon name="sparkle" size={16} color={accent} />
            </View>
            <View style={s.readingCopy}>
              <Text style={[s.readingPublisher, { color: accent }]}>
                {tr("readerUi.explainer")}
              </Text>
              <Text style={s.deepDiveTitle}>{deepDive.title}</Text>
              <EmphasizedText style={s.readingWhy}>
                {deepDive.dek}
              </EmphasizedText>
              <Text style={[s.readingAction, { color: accent }]}>
                {tr("readerUi.fullExplainer")}
              </Text>
            </View>
            <Icon name="chevR" size={17} color={accent} />
          </TouchableOpacity>
        ) : null}

        {reading.map((item) => (
          <TouchableOpacity
            key={item.url}
            style={s.readingCard}
            activeOpacity={0.75}
            onPress={() => openExternal(item.url)}
            accessibilityRole="link"
            accessibilityLabel={tr("readerUi.readPublisher", {
              title: item.title,
              publisher: item.publisher,
            })}
          >
            <View style={s.readingIcon}>
              <Icon name="external" size={15} color={R.muted} />
            </View>
            <View style={s.readingCopy}>
              <Text style={s.readingPublisher}>{item.publisher}</Text>
              <Text
                style={s.readingTitle}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.title}
              </Text>
              <EmphasizedText
                style={s.readingWhy}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {item.whyRead}
              </EmphasizedText>
            </View>
            <Icon name="chevR" size={16} color={R.muted} />
          </TouchableOpacity>
        ))}
      </View>

      {deepDive ? (
        <Modal
          visible={deepDiveOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setDeepDiveOpen(false)}
        >
          <View style={s.deepDiveModal}>
            <View style={s.modalHead}>
              <View>
                <Text style={[s.modalKicker, { color: accent }]}>
                  {tr("readerUi.explainer")}
                </Text>
                <Text style={s.modalBrand}>{tr("readerUi.beyondBrief")}</Text>
              </View>
              <TouchableOpacity
                style={s.modalClose}
                onPress={() => setDeepDiveOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={tr("readerUi.closeExplainer")}
              >
                <Icon name="close" size={20} color={R.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={s.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.modalTitle}>{deepDive.title}</Text>
              <EmphasizedText style={s.modalDek}>{deepDive.dek}</EmphasizedText>
              <View style={[s.modalRule, { backgroundColor: accent }]} />
              <Markdown style={markdownStyles}>{deepDive.body}</Markdown>

              {reading.length > 0 ? (
                <View style={s.modalSources}>
                  <Text style={s.modalSourcesTitle}>
                    {tr("readerUi.continueSources")}
                  </Text>
                  {reading.map((item) => (
                    <TouchableOpacity
                      key={item.url}
                      style={s.modalSourceRow}
                      onPress={() => openExternal(item.url)}
                      accessibilityRole="link"
                    >
                      <View style={s.readingCopy}>
                        <Text style={s.readingPublisher}>{item.publisher}</Text>
                        <Text style={s.modalSourceTitle}>{item.title}</Text>
                      </View>
                      <Icon name="external" size={15} color={R.muted} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function OptionalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.optionalSection}>
      <TouchableOpacity
        style={s.optionalToggle}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID="brief-perspectives-toggle"
      >
        <Text style={s.optionalTitle}>{title}</Text>
        <Icon name={open ? "minus" : "chevD"} size={16} color={R.muted} />
      </TouchableOpacity>
      {open ? children : null}
    </View>
  );
}

/* ---------- Section heading ---------- */
function BlockTitle({ children }: { children: string }) {
  return <Text style={s.blockTitle}>{children}</Text>;
}

/* ---------- BillBrief ---------- */
export function BillBrief({
  data,
  showSummary = true,
  accent = R.link,
  dualLens,
  onViewSource,
}: {
  data: BillBriefData;
  showSummary?: boolean;
  accent?: string;
  dualLens?: ReactNode;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  const { t: tr } = useLanguage();
  const { fontScale } = useWindowDimensions();
  // Keep fast refresh safe while a screen still holds a pre-v5 brief in memory.
  const reading = data.reading ?? [];
  const figure = getBillFactFigure(data.facts);

  return (
    <View key={fontScale} style={s.root} testID="bill-brief">
      {showSummary && (
        <BillSummary
          summary={data.summary}
          text={data.hook}
          legalStatus={data.legalStatus}
          accent={accent}
        />
      )}

      <BillChangeExplorer
        data={data}
        showFirstTitle
        presentation="comparison"
        testIDPrefix="brief"
        onViewSource={onViewSource}
      />

      {figure ? (
        <BillFactFigure
          figure={figure}
          onViewSource={onViewSource}
          changes={data.changes}
          legalStatus={data.legalStatus}
          sourceStatus={data.sourceStatus}
        />
      ) : null}

      <BlockTitle>{tr("readerUi.whoAffected")}</BlockTitle>
      <Affected affected={data.affected} />

      <Unknowns unknowns={data.unknowns} />

      <Terms terms={data.terms} />
      {data.whyNotBefore ? (
        <WhyNotBefore context={data.whyNotBefore} accent={accent} />
      ) : null}
      {dualLens ? (
        <OptionalSection title={tr("readerUi.arguments")}>
          {dualLens}
        </OptionalSection>
      ) : null}

      {data.deepDive || reading.length > 0 ? (
        <>
          <BlockTitle>{tr("readerUi.keepReading")}</BlockTitle>
          <FurtherReading
            deepDive={data.deepDive}
            reading={reading}
            accent={accent}
          />
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  flatSection: { borderTopWidth: 1, borderTopColor: R.rule },
  flatToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
    minHeight: 60,
  },
  flatTitle: { ...T.body, fontFamily: fontBody.medium, color: R.text },
  root: { gap: 18 },
  compactSummary: { paddingTop: 0, paddingBottom: 0, gap: 6 },
  compactSummaryText: { ...T.body },
  optionalSection: {
    backgroundColor: "transparent",
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  optionalToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
  },
  optionalTitle: {
    ...T.action,
    flex: 1,
    color: R.text,
  },

  /* summary */
  summaryCard: {
    paddingVertical: 12,
    gap: 13,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  summaryTitle: {
    flex: 1,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    color: R.text,
  },
  summaryStatus: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  summaryStatusText: {
    ...T.label,
    color: R.muted,
    fontFamily: fontBody.semibold,
    letterSpacing: 0.8,
  },
  summaryText: {
    fontFamily: fontBody.regular,
    fontSize: 18,
    lineHeight: 27,
    color: R.text,
  },
  summaryToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  summaryToggleText: {
    ...T.label,
    ...T.action,
    fontFamily: fontBody.semibold,
  },
  extendedSummary: {
    borderTopWidth: 1,
    borderTopColor: hair[1],
    paddingTop: 13,
    gap: 7,
  },
  extendedSummaryLabel: {
    ...T.label,
    fontFamily: fontBody.semibold,
    letterSpacing: 0.9,
    color: R.muted,
  },
  extendedSummaryText: {
    ...T.body,
    fontFamily: fontBody.regular,
    color: R.text,
  },

  /* block heading */
  blockTitle: {
    ...T.action,
    color: R.text,
  },

  /* changes */
  kindChipText: {
    ...T.label,
    color: R.muted,
    fontFamily: fontBody.semibold,
    letterSpacing: 0.9,
  },
  changeIndex: {
    ...T.label,
    marginLeft: "auto",
    fontFamily: fontBody.medium,
    color: R.muted,
  },
  inlineStrong: {
    fontFamily: fontBody.semibold,
    color: R.text,
  },
  contextCard: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: hair[1],
    borderRadius: 0,
    paddingVertical: 16,
  },
  contextToggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  contextIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  contextHeadingCopy: { flex: 1, gap: 6 },
  contextTitle: {
    ...T.action,
    color: R.text,
  },
  contextSummary: {
    ...T.body,
    fontFamily: fontBody.regular,
    color: R.text,
  },
  contextDetails: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: hair[1],
    gap: 12,
  },
  contextPoint: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "transparent",
    borderRadius: 10,
    padding: 11,
  },
  contextIndex: {
    ...T.label,
    fontFamily: fontBody.bold,
    letterSpacing: 0.6,
    paddingTop: 2,
  },
  contextPointCopy: { flex: 1, gap: 6 },
  contextPointText: {
    ...T.body,
    fontFamily: fontBody.regular,
    color: R.text,
  },
  contextCitations: {
    ...T.label,
    flexDirection: "row",
    gap: 5,
  },
  contextCitation: {
    fontFamily: fontBody.bold,
  },
  contextSources: {
    ...T.label,
    gap: 8,
  },
  contextSourcesTitle: {
    fontFamily: fontBody.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: R.muted,
  },
  contextSource: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  contextSourceNumber: {
    ...T.label,
    fontFamily: fontBody.bold,
  },
  contextSourceCopy: { flex: 1, gap: 1 },
  contextSourceTitle: {
    ...T.action,
    fontFamily: fontBody.medium,
    color: R.text,
  },
  contextSourcePublisher: {
    ...T.label,
    fontFamily: fontBody.regular,
    color: R.muted,
  },

  /* quote disclosure */
  affectedDirection: {
    ...T.label,
    fontFamily: fontBody.medium,
    color: R.muted,
  },
  unknownCard: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: hair[2],
    borderRadius: 0,
    paddingVertical: 16,
    gap: 10,
  },
  unknownHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  unknownTitle: {
    ...T.action,
    color: R.text,
  },
  unknownList: { gap: 8 },
  unknownRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "transparent",
    borderRadius: 10,
    padding: 11,
  },
  unknownIndex: {
    ...T.label,
    fontFamily: fontBody.bold,
    letterSpacing: 0.6,
    paddingTop: 2,
  },
  unknownText: {
    ...T.body,
    flex: 1,
    fontFamily: fontBody.regular,
    color: R.text,
  },

  /* disclosures */
  chevFlip: { transform: [{ rotate: "180deg" }] },

  /* terms */
  termSection: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: hair[1],
    borderRadius: 0,
    paddingVertical: 16,
    gap: 12,
  },
  termHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  termIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  termHeadingCopy: { flex: 1, gap: 1 },
  termTitle: {
    ...T.action,
    color: R.text,
  },
  termList: { gap: 8 },
  termRow: {
    borderLeftWidth: 3,
    backgroundColor: "transparent",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  termName: {
    ...T.action,
    fontFamily: fontBody.semibold,
    color: R.text,
  },
  termPlain: {
    ...T.body,
    fontFamily: fontBody.regular,
    color: R.text,
  },

  /* further reading */
  readingList: { gap: 10 },
  deepDiveCard: {
    width: "100%",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderRadius: 0,
    paddingVertical: 16,
    overflow: "hidden",
  },
  readingCard: {
    width: "100%",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 0,
    paddingVertical: 16,
    overflow: "hidden",
  },
  readingIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  readingCopy: {
    ...T.label,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
  },
  readingPublisher: {
    fontFamily: fontBody.bold,
    letterSpacing: 0.7,
    color: R.muted,
  },
  deepDiveTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 22,
    color: R.text,
  },
  readingTitle: {
    ...T.action,
    flexShrink: 1,
    fontFamily: fontBody.semibold,
    color: R.text,
  },
  readingWhy: {
    ...T.body,
    flexShrink: 1,
    fontFamily: fontBody.regular,
    color: R.text,
  },
  readingAction: {
    ...T.label,
    ...T.action,
    marginTop: 4,
    fontFamily: fontBody.semibold,
  },
  deepDiveModal: { flex: 1, backgroundColor: R.canvas },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: hair[1],
  },
  modalKicker: {
    ...T.label,
    fontFamily: fontBody.bold,
    letterSpacing: 1.1,
  },
  modalBrand: {
    ...T.label,
    marginTop: 2,
    fontFamily: fontBody.medium,
    color: R.muted,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 56,
  },
  modalTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 31,
    lineHeight: 36,
    color: R.text,
  },
  modalDek: {
    ...T.body,
    marginTop: 12,
    fontFamily: fontBody.regular,
    color: R.text,
  },
  modalRule: {
    width: 44,
    height: 3,
    borderRadius: 2,
    marginTop: 22,
    marginBottom: 12,
  },
  modalSources: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: hair[1],
    gap: 10,
  },
  modalSourcesTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 19,
    color: R.text,
  },
  modalSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  modalSourceTitle: {
    ...T.action,
    fontFamily: fontBody.semibold,
    color: R.text,
  },
});
