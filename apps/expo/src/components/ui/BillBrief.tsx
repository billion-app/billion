/**
 * BillBrief — the structured replacement for a wall of markdown.
 *
 * The old explainer rendered one long markdown blob, so the reader's only
 * choices were "read all of it" or "read none of it". A brief is a stack of
 * self-contained blocks the reader can leave at any point and still have
 * learned something true:
 *
 *   hook      → one coherent "What this means for you" paragraph
 *   facts     → retained as structured data for cards and future visuals
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
 *  - Nothing color-codes a verdict. A group that "loses" access is drawn with
 *    the same neutral treatment as one that "gains" it — direction is carried
 *    by an arrow and a word, never by green/red. Coloring outcomes would read
 *    as an editorial position, and red-vs-green sits one step from
 *    red-vs-blue.
 *  - Every claim keeps a path back to the source. Change cards expose the
 *    verbatim provision that backs them, and the block ends by pointing at the
 *    official text rather than presenting itself as the last word.
 */
import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";
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
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import Markdown from "@ronradtke/react-native-markdown-display";

import type { IconName } from "./Icon";
import {
  colors,
  darkTheme,
  fontBody,
  fontEditorial,
  getMarkdownStyles,
  hair,
  planes,
} from "~/styles";
import dataPrivacyImage from "../../../assets/article-brief/algorithm-transparency.jpg";
import infrastructureRepairImage from "../../../assets/article-brief/infrastructure-repair.jpg";
import publicTransitImage from "../../../assets/article-brief/public-transit.jpg";
import { Icon } from "./Icon";

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
}

export interface BillBriefData {
  hook: string;
  legalStatus: "proposed" | "enacted";
  facts: { label: string; value: string; note?: string; quote?: BriefQuote }[];
  changes: {
    kind: BriefChangeKind;
    title: string;
    before: string;
    after: string;
    visual?: "infrastructure-repair" | "public-transit" | "data-privacy";
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

const CHANGE_KIND_LABEL: Record<BriefChangeKind, string> = {
  creates: "CREATES",
  repeals: "REPEALS",
  expands: "EXPANDS",
  restricts: "RESTRICTS",
  requires: "REQUIRES",
  waives: "WAIVES",
  funds: "FUNDS",
  transfers: "TRANSFERS",
};

const CHANGE_VISUALS = {
  "infrastructure-repair": {
    source: infrastructureRepairImage,
    alt: "Engineers reviewing plans beside an active bridge rehabilitation project",
    caption: "Bridge rehabilitation and long-range project planning",
  },
  "public-transit": {
    source: publicTransitImage,
    alt: "A light-rail train and city bus serving the same transit station",
    caption: "Light rail and bus rapid transit",
  },
  "data-privacy": {
    source: dataPrivacyImage,
    alt: "A laptop showing an abstract network of connected personal data",
    caption: "How companies collect, connect, and use personal data",
  },
} as const;

/**
 * Direction glyphs are all one neutral color on purpose — see the file header.
 * The arrow encodes flow (toward or away from the group); the label spells it
 * out for anyone who reads the arrow differently.
 */
const DIRECTION: Record<
  BillBriefData["affected"][number]["direction"],
  { icon: IconName; label: string }
> = {
  gains: { icon: "arrowUp", label: "Gains" },
  loses: { icon: "arrowDown", label: "Loses" },
  mixed: { icon: "minus", label: "Mixed" },
  unclear: { icon: "help", label: "Unclear" },
};

/* ---------- Inline emphasis — useful phrases, not whole paragraphs ---------- */
function EmphasizedText({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <Text key={index} style={s.inlineStrong}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/* ---------- Hook — the one sentence that must land ---------- */
function Hook({
  text,
  legalStatus,
  accent,
}: {
  text: string;
  legalStatus: BillBriefData["legalStatus"];
  accent: string;
}) {
  return (
    <View
      style={[s.summaryCard, { borderLeftColor: accent }]}
      testID="brief-summary"
    >
      <View style={s.summaryHead}>
        <View style={[s.summaryIcon, { backgroundColor: `${accent}28` }]}>
          <Icon name="sparkle" size={16} color={accent} />
        </View>
        <Text style={s.summaryTitle}>What this means for you</Text>
        <View style={[s.summaryStatus, { borderColor: `${accent}66` }]}>
          <Text style={[s.summaryStatusText, { color: accent }]}>
            {legalStatus === "enacted" ? "LAW" : "PROPOSAL"}
          </Text>
        </View>
      </View>
      <Text style={s.summaryText} testID="brief-hook">
        {text}
      </Text>
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
          open
            ? "Hide why this was not implemented before"
            : "Explain why this was not implemented before"
        }
      >
        <View style={[s.contextIcon, { backgroundColor: `${accent}28` }]}>
          <Icon name="clock" size={15} color={accent} />
        </View>
        <View style={s.contextHeadingCopy}>
          <Text style={s.contextTitle}>
            Why wasn&apos;t this implemented before?
          </Text>
          <Text style={s.contextSummary}>{context.summary}</Text>
        </View>
        <View style={open ? s.chevFlip : undefined}>
          <Icon name="chevD" size={16} color={accent} />
        </View>
      </TouchableOpacity>

      {open ? (
        <View style={s.contextDetails}>
          {context.points.map((point, index) => (
            <View key={index} style={s.contextPoint}>
              <Text style={[s.contextIndex, { color: accent }]}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <View style={s.contextPointCopy}>
                <Text style={s.contextPointText}>{point.text}</Text>
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
            <Text style={s.contextSourcesTitle}>Sources</Text>
            {sources.map((source, index) => (
              <TouchableOpacity
                key={source.url}
                style={s.contextSource}
                activeOpacity={0.7}
                onPress={() => void WebBrowser.openBrowserAsync(source.url)}
                accessibilityRole="link"
                accessibilityLabel={`Open source ${index + 1}: ${source.title}`}
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
                <Icon name="external" size={13} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Quote disclosure — provenance, one tap away ---------- */
// Collapsed by default: the reader asked for plain language, so raw statutory
// text is opt-in. But it is always one tap away, never a dead end.
function QuoteDisclosure({
  quote,
  accent,
  onViewSource,
}: {
  quote: BriefQuote;
  accent: string;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.quoteWrap}>
      <TouchableOpacity
        style={s.quoteToggle}
        activeOpacity={0.7}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          open ? "Hide the source text" : "Show the source text"
        }
      >
        <Icon name="quote" size={11} color={colors.textSecondary} />
        <Text style={s.quoteToggleText}>
          {quote.locator ? `In the text · ${quote.locator}` : "In the text"}
        </Text>
        <View style={open ? s.chevFlip : undefined}>
          <Icon name="chevD" size={13} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={s.quoteBody}>
          <Text style={s.quoteText}>{quote.text}</Text>
        </View>
      )}
      {onViewSource ? (
        <TouchableOpacity
          style={[s.viewSourceButton, { backgroundColor: accent }]}
          activeOpacity={0.78}
          onPress={() => onViewSource(quote)}
          accessibilityRole="button"
          accessibilityLabel={`View source${quote.locator ? ` at ${quote.locator}` : ""}`}
        >
          <Text style={s.viewSourceText}>View source</Text>
          <Icon name="arrowRight" size={13} color={colors.white} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ---------- Changes — before → after ---------- */
function Changes({
  changes,
  accent,
  onViewSource,
}: {
  changes: BillBriefData["changes"];
  accent: string;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const cardWidth = Math.max(260, Math.min(screenWidth - 64, 390));
  const snapInterval = cardWidth + 12;

  return (
    <View style={s.changeCarouselWrap} testID="brief-changes">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.changeCarouselContent}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled
        onMomentumScrollEnd={(event) => {
          const next = Math.round(
            event.nativeEvent.contentOffset.x / snapInterval,
          );
          setActiveIndex(Math.max(0, Math.min(changes.length - 1, next)));
        }}
      >
        {changes.map((c, i) => (
          <View key={i} style={[s.changeCard, { width: cardWidth }]}>
            <View style={s.changeHead}>
              <View style={[s.kindChip, { borderColor: accent }]}>
                <Text style={[s.kindChipText, { color: accent }]}>
                  {CHANGE_KIND_LABEL[c.kind]}
                </Text>
              </View>
              <Text style={s.changeIndex}>
                {i + 1}/{changes.length}
              </Text>
            </View>
            <Text style={s.changeTitle}>{c.title}</Text>

            {c.visual ? (
              <View style={s.changeVisualWrap}>
                <Image
                  source={CHANGE_VISUALS[c.visual].source}
                  style={s.changeVisual}
                  contentFit="cover"
                  transition={180}
                  accessible
                  accessibilityLabel={CHANGE_VISUALS[c.visual].alt}
                />
                <View style={s.changeVisualShade} />
                <Text style={s.changeVisualCaption}>
                  {CHANGE_VISUALS[c.visual].caption}
                </Text>
              </View>
            ) : null}

            <View style={s.deltaStack}>
              <View style={s.deltaBefore}>
                <Text style={s.deltaLabel}>NOW</Text>
                <EmphasizedText style={s.deltaText}>{c.before}</EmphasizedText>
              </View>
              <View style={s.deltaTransition}>
                <View
                  style={[s.deltaTransitionLine, { backgroundColor: accent }]}
                />
                <Icon name="arrowDown" size={13} color={accent} />
                <Text style={[s.deltaTransitionText, { color: accent }]}>
                  THE PROPOSAL CHANGES THIS
                </Text>
              </View>
              <View
                style={[
                  s.deltaAfter,
                  {
                    borderColor: `${accent}66`,
                    backgroundColor: `${accent}18`,
                  },
                ]}
              >
                <Text style={s.deltaLabel}>UNDER THIS BILL</Text>
                <EmphasizedText style={[s.deltaText, s.deltaTextAfter]}>
                  {c.after}
                </EmphasizedText>
              </View>
            </View>

            {c.quote ? (
              <QuoteDisclosure
                quote={c.quote}
                accent={accent}
                onViewSource={onViewSource}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>

      {changes.length > 1 ? (
        <View style={s.changePager}>
          {changes.map((change, index) => (
            <View
              key={`${change.title}-${index}`}
              style={[
                s.changePagerDot,
                index === activeIndex
                  ? [s.changePagerDotActive, { backgroundColor: accent }]
                  : null,
              ]}
            />
          ))}
          <Text style={s.changePagerText}>
            {activeIndex < changes.length - 1
              ? `Swipe for change ${activeIndex + 2} of ${changes.length}`
              : `Showing change ${activeIndex + 1} of ${changes.length}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Affected — who this lands on ---------- */
function Affected({
  affected,
  accent,
}: {
  affected: BillBriefData["affected"];
  accent: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <View style={s.affectedList} testID="brief-affected">
      {affected.map((a, i) => {
        const d = DIRECTION[a.direction];
        const takeaway = a.takeaway;
        const open = openIndex === i;
        return (
          <View key={i} style={s.affectedRow}>
            <View style={s.affectedBody}>
              <View style={s.affectedHead}>
                <View
                  style={[s.affectedIcon, { backgroundColor: `${accent}28` }]}
                >
                  <Icon name={d.icon} size={14} color={accent} />
                </View>
                <Text style={s.affectedGroup}>{a.group}</Text>
                <View style={[s.directionChip, { borderColor: `${accent}55` }]}>
                  <Text style={[s.affectedDirection, { color: accent }]}>
                    {d.label}
                  </Text>
                </View>
              </View>
              <Text style={s.affectedTakeaway}>
                {takeaway ?? a.effect.replaceAll("**", "")}
              </Text>
              {takeaway ? (
                <>
                  <TouchableOpacity
                    style={s.affectedMore}
                    activeOpacity={0.7}
                    onPress={() => setOpenIndex(open ? null : i)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                  >
                    <Text style={[s.affectedMoreText, { color: accent }]}>
                      {open ? "Hide context" : "Why this matters"}
                    </Text>
                    <View style={open ? s.chevFlip : undefined}>
                      <Icon name="chevD" size={13} color={accent} />
                    </View>
                  </TouchableOpacity>
                  {open ? (
                    <EmphasizedText style={s.affectedContext}>
                      {a.effect}
                    </EmphasizedText>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ---------- Unknowns — the honesty block ---------- */
// Deliberately given the same visual weight as the analysis blocks. Burying it
// would let a brief read as more settled than the source actually is.
function Unknowns({
  unknowns,
  accent,
}: {
  unknowns: string[];
  accent: string;
}) {
  if (unknowns.length === 0) return null;
  return (
    <View style={s.unknownCard} testID="brief-unknowns">
      <View style={s.unknownHead}>
        <Icon name="help" size={15} color={colors.textSecondary} />
        <Text style={s.unknownTitle}>What the text doesn&apos;t settle</Text>
      </View>
      <View style={s.unknownList}>
        {unknowns.map((u, i) => (
          <View key={i} style={s.unknownRow}>
            <Text style={[s.unknownIndex, { color: accent }]}>
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
function Terms({
  terms,
  accent,
}: {
  terms: BillBriefData["terms"];
  accent: string;
}) {
  if (terms.length === 0) return null;
  return (
    <View style={s.termSection} testID="brief-key-terms">
      <View style={s.termHeading}>
        <View style={[s.termIcon, { backgroundColor: `${accent}28` }]}>
          <Icon name="book" size={15} color={accent} />
        </View>
        <View style={s.termHeadingCopy}>
          <Text style={s.termTitle}>Key terms</Text>
          <Text style={s.termSubtitle}>Know these before you read further</Text>
        </View>
      </View>
      <View style={s.termList}>
        {terms.map((t, i) => (
          <View
            key={i}
            style={[
              s.termRow,
              { borderLeftColor: i % 2 === 0 ? accent : "#8B7CFF" },
            ]}
          >
            <Text
              style={[s.termName, { color: i % 2 === 0 ? accent : "#A99EFF" }]}
            >
              {t.term}
            </Text>
            <Text style={s.termPlain}>{t.plain}</Text>
          </View>
        ))}
      </View>
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
            accessibilityLabel={`Read Billion explainer: ${deepDive.title}`}
          >
            <View style={[s.readingIcon, { backgroundColor: `${accent}28` }]}>
              <Icon name="sparkle" size={16} color={accent} />
            </View>
            <View style={s.readingCopy}>
              <Text style={[s.readingPublisher, { color: accent }]}>
                BILLION EXPLAINER
              </Text>
              <Text style={s.deepDiveTitle}>{deepDive.title}</Text>
              <Text style={s.readingWhy}>{deepDive.dek}</Text>
              <Text style={[s.readingAction, { color: accent }]}>
                Read the full explainer
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
            accessibilityLabel={`Read ${item.title} from ${item.publisher}`}
          >
            <View style={s.readingIcon}>
              <Icon name="external" size={15} color={colors.textSecondary} />
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
              <Text style={s.readingWhy} numberOfLines={3} ellipsizeMode="tail">
                {item.whyRead}
              </Text>
            </View>
            <Icon name="chevR" size={16} color={colors.textSecondary} />
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
                  BILLION EXPLAINER
                </Text>
                <Text style={s.modalBrand}>Go beyond the brief</Text>
              </View>
              <TouchableOpacity
                style={s.modalClose}
                onPress={() => setDeepDiveOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close explainer"
              >
                <Icon name="close" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={s.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.modalTitle}>{deepDive.title}</Text>
              <Text style={s.modalDek}>{deepDive.dek}</Text>
              <View style={[s.modalRule, { backgroundColor: accent }]} />
              <Markdown style={markdownStyles}>{deepDive.body}</Markdown>

              {reading.length > 0 ? (
                <View style={s.modalSources}>
                  <Text style={s.modalSourcesTitle}>Continue with sources</Text>
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
                      <Icon
                        name="external"
                        size={15}
                        color={colors.textSecondary}
                      />
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

/* ---------- Section heading ---------- */
function BlockTitle({ children }: { children: string }) {
  return <Text style={s.blockTitle}>{children}</Text>;
}

/* ---------- BillBrief ---------- */
export function BillBrief({
  data,
  accent = colors.civicBlue,
  dualLens,
  onViewSource,
}: {
  data: BillBriefData;
  accent?: string;
  dualLens?: ReactNode;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  // Keep fast refresh safe while a screen still holds a pre-v5 brief in memory.
  const reading = data.reading ?? [];

  return (
    <View style={s.root} testID="bill-brief">
      <Hook text={data.hook} legalStatus={data.legalStatus} accent={accent} />
      {data.whyNotBefore ? (
        <WhyNotBefore context={data.whyNotBefore} accent={accent} />
      ) : null}
      <Terms terms={data.terms} accent={accent} />

      <BlockTitle>What would change</BlockTitle>
      <Changes
        changes={data.changes}
        accent={accent}
        onViewSource={onViewSource}
      />

      <BlockTitle>Who it lands on</BlockTitle>
      <Affected affected={data.affected} accent={accent} />

      <Unknowns unknowns={data.unknowns} accent={accent} />

      {dualLens ? (
        <View style={s.lensSection}>
          <BlockTitle>How people make the case</BlockTitle>
          {dualLens}
        </View>
      ) : null}

      {data.deepDive || reading.length > 0 ? (
        <>
          <BlockTitle>Keep reading</BlockTitle>
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
  root: { gap: 18 },

  /* summary */
  summaryCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 16,
    gap: 13,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    flex: 1,
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    color: colors.white,
  },
  summaryStatus: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  summaryStatusText: {
    fontFamily: fontBody.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  summaryText: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.white,
  },

  /* block heading */
  blockTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    color: colors.white,
    marginBottom: -6,
  },

  /* changes */
  changeCarouselWrap: { gap: 10, marginHorizontal: -4 },
  changeCarouselContent: {
    gap: 12,
    paddingHorizontal: 4,
    paddingRight: 28,
  },
  changeCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 15,
    gap: 11,
  },
  changePager: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
  },
  changePagerDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: hair[2],
  },
  changePagerDotActive: { width: 18 },
  changePagerText: {
    marginLeft: 4,
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  changeHead: { flexDirection: "row", alignItems: "center" },
  kindChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  kindChipText: {
    fontFamily: fontBody.semibold,
    fontSize: 9.5,
    letterSpacing: 0.9,
  },
  changeIndex: {
    marginLeft: "auto",
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  changeTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  deltaStack: { gap: 8 },
  deltaBefore: {
    backgroundColor: planes.surface,
    borderRadius: 10,
    padding: 12,
    gap: 5,
  },
  deltaAfter: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 5,
  },
  deltaLabel: {
    fontFamily: fontBody.medium,
    fontSize: 9,
    letterSpacing: 0.9,
    color: colors.textSecondary,
  },
  deltaText: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.66)",
  },
  // The "after" column carries the actual change, so it reads at full strength
  // while "now" recedes. This is emphasis, not endorsement.
  deltaTextAfter: { color: "rgba(255,255,255,0.92)" },
  deltaTransition: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
  },
  deltaTransitionLine: { width: 2, height: 18, borderRadius: 2 },
  deltaTransitionText: {
    fontFamily: fontBody.semibold,
    fontSize: 8.5,
    letterSpacing: 0.7,
  },
  inlineStrong: {
    fontFamily: fontBody.semibold,
    color: colors.white,
  },
  changeVisualWrap: {
    height: 142,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: planes.ink,
    justifyContent: "flex-end",
  },
  changeVisual: {
    position: "absolute",
    inset: 0,
  },
  changeVisualShade: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(8,13,29,0.14)",
  },
  changeVisualCaption: {
    fontFamily: fontBody.semibold,
    fontSize: 10.5,
    color: colors.white,
    backgroundColor: "rgba(8,13,29,0.74)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  /* cited historical context */
  contextCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
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
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.white,
  },
  contextSummary: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
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
    backgroundColor: planes.surface,
    borderRadius: 10,
    padding: 11,
  },
  contextIndex: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    paddingTop: 2,
  },
  contextPointCopy: { flex: 1, gap: 6 },
  contextPointText: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.82)",
  },
  contextCitations: { flexDirection: "row", gap: 5 },
  contextCitation: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
  },
  contextSources: { gap: 8 },
  contextSourcesTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  contextSource: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  contextSourceNumber: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
  },
  contextSourceCopy: { flex: 1, gap: 1 },
  contextSourceTitle: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: colors.white,
  },
  contextSourcePublisher: {
    fontFamily: fontBody.regular,
    fontSize: 10.5,
    color: colors.textSecondary,
  },

  /* quote disclosure */
  quoteWrap: {
    borderTopWidth: 1,
    borderTopColor: hair[1],
    paddingTop: 10,
    gap: 9,
  },
  quoteToggle: { flexDirection: "row", alignItems: "center", gap: 7 },
  quoteToggleText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  quoteBody: {
    backgroundColor: planes.ink,
    borderRadius: 10,
    padding: 12,
  },
  quoteText: {
    fontFamily: fontEditorial.italic,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.8)",
  },
  viewSourceButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  viewSourceText: {
    fontFamily: fontBody.semibold,
    fontSize: 11.5,
    color: colors.white,
  },

  /* affected */
  affectedList: { gap: 10 },
  affectedRow: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
  },
  affectedIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  affectedBody: { flex: 1, gap: 9 },
  affectedHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  affectedGroup: {
    flex: 1,
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
  affectedDirection: {
    fontFamily: fontBody.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  directionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  affectedTakeaway: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.white,
  },
  affectedEffect: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.78)",
  },
  affectedMore: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  affectedMoreText: {
    fontFamily: fontBody.semibold,
    fontSize: 11.5,
  },
  affectedContext: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.68)",
  },

  /* unknowns */
  unknownCard: {
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 14,
    padding: 15,
    gap: 10,
  },
  unknownHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  unknownTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 15,
    color: colors.white,
  },
  unknownList: { gap: 8 },
  unknownRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: planes.slate,
    borderRadius: 10,
    padding: 11,
  },
  unknownIndex: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    paddingTop: 2,
  },
  unknownText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.78)",
  },

  /* disclosures */
  chevFlip: { transform: [{ rotate: "180deg" }] },

  /* terms */
  termSection: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  termHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  termIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  termHeadingCopy: { flex: 1, gap: 1 },
  termTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    color: colors.white,
  },
  termSubtitle: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  termList: { gap: 8 },
  termRow: {
    borderLeftWidth: 3,
    backgroundColor: planes.surface,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  termName: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  termPlain: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.74)",
  },

  /* further reading */
  lensSection: { gap: 12 },
  readingList: { gap: 10 },
  deepDiveCard: {
    width: "100%",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 14,
    overflow: "hidden",
  },
  readingCard: {
    width: "100%",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
    overflow: "hidden",
  },
  readingIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: planes.slate,
    alignItems: "center",
    justifyContent: "center",
  },
  readingCopy: { flex: 1, flexShrink: 1, minWidth: 0, gap: 4 },
  readingPublisher: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: colors.textSecondary,
  },
  deepDiveTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.white,
  },
  readingTitle: {
    flexShrink: 1,
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    lineHeight: 19,
    color: colors.white,
  },
  readingWhy: {
    flexShrink: 1,
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.68)",
  },
  readingAction: {
    marginTop: 4,
    fontFamily: fontBody.semibold,
    fontSize: 12,
  },
  deepDiveModal: { flex: 1, backgroundColor: planes.navy },
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
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  modalBrand: {
    marginTop: 2,
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: planes.slate,
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
    color: colors.white,
  },
  modalDek: {
    marginTop: 12,
    fontFamily: fontBody.regular,
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.7)",
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
    color: colors.white,
  },
  modalSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  modalSourceTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.white,
  },
});
