import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { useState } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { RouterOutputs } from "@acme/api";

import type { BriefQuote } from "./BillBrief";
import { colors, fontBody, fontEditorial, hair, planes } from "~/styles";
import { courtSourceQuote } from "~/utils/source-passage";
import { Icon } from "./Icon";

type CourtDetail = Extract<
  RouterOutputs["content"]["getById"],
  { type: "court_case" }
>;
export type CourtBriefData = NonNullable<CourtDetail["courtBrief"]>;
type Point = CourtBriefData["action"];
type CourtTerm = CourtBriefData["terms"][number];

const PROCEEDING = {
  emergency_order: {
    badge: "TEMPORARY",
    label: "Emergency order",
    detail: "Temporary decision while the case continues",
  },
  order: {
    badge: "ORDER",
    label: "Court order",
    detail: "Scope limited to the request before the court",
  },
  merits_opinion: {
    badge: "DECISION",
    label: "Full decision",
    detail: "The court decided the legal questions before it",
  },
  unknown: {
    badge: "SCOPE UNCLEAR",
    label: "Court filing",
    detail: "The procedural scope is not established",
  },
} as const;

const REASON = {
  holding: "HOLDING",
  court_reasoning: "COURT REASONING",
  party_argument: "PARTY ARGUMENT",
  allegation: "ALLEGATION",
} as const;

const OPINION = {
  majority: { label: "COURT'S MAIN OPINION", color: "#55D6BE" },
  per_curiam: { label: "COURT OPINION · UNSIGNED", color: "#55D6BE" },
  concurrence: { label: "AGREES · CONCURRENCE", color: "#B8A1FF" },
  dissent: { label: "DISAGREES · DISSENT", color: "#FF9575" },
  unknown: { label: "OPINION", color: "#F4C95D" },
} as const;

function BlockTitle({ children }: { children: string }) {
  return <Text style={s.blockTitle}>{children}</Text>;
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Keep definitions tied to the generated case vocabulary, not a global legal dictionary. */
function DefinedText({
  text,
  terms,
  accent,
  style,
}: {
  text: string;
  terms: CourtBriefData["terms"];
  accent: string;
  style: StyleProp<TextStyle>;
}) {
  const [openTerm, setOpenTerm] = useState<CourtTerm | null>(null);
  const usableTerms = terms
    .filter((term) => term.term.trim())
    .sort((left, right) => right.term.length - left.term.length);
  const byName = new Map(
    usableTerms.map((term) => [term.term.toLocaleLowerCase(), term]),
  );
  const pattern = usableTerms.length
    ? new RegExp(
        `\\b(${usableTerms.map((term) => escapePattern(term.term)).join("|")})\\b`,
        "gi",
      )
    : null;
  const parts = pattern ? text.split(pattern) : [text];

  return (
    <View style={s.definedWrap}>
      <Text style={style}>
        {parts.map((part, index) => {
          const term = byName.get(part.toLocaleLowerCase());
          if (!term) return part;
          const expanded = openTerm?.term === term.term;
          return (
            <Text
              key={`${term.term}-${index}`}
              style={[s.definedTerm, { color: accent }]}
              onPress={() => setOpenTerm(expanded ? null : term)}
              accessibilityRole="button"
              accessibilityLabel={`Define ${term.term}`}
              accessibilityHint="Shows a plain-language definition"
              accessibilityState={{ expanded }}
            >
              {part}
            </Text>
          );
        })}
      </Text>
      {openTerm ? (
        <View
          style={[
            s.definitionCard,
            {
              backgroundColor: `${accent}12`,
              borderColor: `${accent}55`,
            },
          ]}
          accessibilityLiveRegion="polite"
          testID="court-term-definition"
        >
          <View style={s.definitionHead}>
            <Icon name="book" size={13} color={accent} />
            <Text style={[s.definitionTerm, { color: accent }]}>
              {openTerm.term}
            </Text>
          </View>
          <Text style={s.definitionPlain}>{openTerm.plain}</Text>
        </View>
      ) : null}
    </View>
  );
}

function QuoteDisclosure({
  point,
  accent,
  onViewSource,
}: {
  point: Point;
  accent: string;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!point.quote) return null;

  const quote: BriefQuote = courtSourceQuote(point.quote);

  return (
    <View style={s.quoteWrap}>
      <TouchableOpacity
        style={s.quoteToggle}
        activeOpacity={0.7}
        onPress={() => setOpen((value) => !value)}
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
      {open ? (
        <View style={s.quoteBody}>
          <Text style={s.quoteText}>{quote.text}</Text>
        </View>
      ) : null}
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

function SourcePills({ data, point }: { data: CourtBriefData; point: Point }) {
  return (
    <View style={s.sourcePills}>
      {point.documentIds.map((id) => {
        const source = data.sources.find((entry) => entry.id === id);
        if (!source) return null;
        return (
          <TouchableOpacity
            key={id}
            style={s.sourcePill}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={`Open official source ${id}`}
            onPress={() => void Linking.openURL(source.url)}
          >
            <Icon name="doc" size={11} color={colors.textSecondary} />
            <Text style={s.sourcePillText}>
              Official source {id.replace("document-", "")}
            </Text>
            <Icon name="external" size={10} color={colors.textSecondary} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PointCard({
  data,
  point,
  accent,
  label,
  onViewSource,
}: {
  data: CourtBriefData;
  point: Point;
  accent: string;
  label?: string;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  return (
    <View style={s.pointCard}>
      {label ? (
        <View style={[s.kindChip, { borderColor: `${accent}80` }]}>
          <Text style={[s.kindChipText, { color: accent }]}>{label}</Text>
        </View>
      ) : null}
      <DefinedText
        text={point.text}
        terms={data.terms}
        accent={accent}
        style={s.pointText}
      />
      <QuoteDisclosure
        point={point}
        accent={accent}
        onViewSource={onViewSource}
      />
      <SourcePills data={data} point={point} />
    </View>
  );
}

function OpinionsSection({
  data,
  accent,
  onViewSource,
}: {
  data: CourtBriefData;
  accent: string;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  if (!data.opinions.length) return null;
  return (
    <>
      <BlockTitle>Separate opinions</BlockTitle>
      <View style={s.cardList} testID="court-brief-opinions">
        {data.opinions.map((opinion, index) => {
          const treatment = OPINION[opinion.kind];
          return (
            <View
              key={index}
              style={[s.opinionCard, { borderLeftColor: treatment.color }]}
            >
              <View style={s.opinionHead}>
                <Text style={[s.opinionKind, { color: treatment.color }]}>
                  {treatment.label}
                </Text>
                <Text style={s.opinionAuthor}>
                  {opinion.author ?? "Author not established"}
                </Text>
              </View>
              <DefinedText
                text={opinion.text}
                terms={data.terms}
                accent={accent}
                style={s.opinionText}
              />
              <QuoteDisclosure
                point={opinion}
                accent={accent}
                onViewSource={onViewSource}
              />
              <SourcePills data={data} point={opinion} />
            </View>
          );
        })}
      </View>
    </>
  );
}

function UnknownsCard({
  data,
  accent,
}: {
  data: CourtBriefData;
  accent: string;
}) {
  return (
    <View style={s.unknownCard} testID="court-brief-unknowns">
      <View style={s.unknownHead}>
        <Icon name="help" size={15} color={colors.textSecondary} />
        <Text style={s.unknownTitle}>What the ruling doesn&apos;t settle</Text>
      </View>
      <View style={s.unknownList}>
        {data.unknowns.map((unknown, index) => (
          <View key={index} style={s.unknownRow}>
            <Text style={[s.unknownIndex, { color: accent }]}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <DefinedText
              text={unknown}
              terms={data.terms}
              accent={accent}
              style={s.unknownText}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function OfficialDocuments({ data }: { data: CourtBriefData }) {
  return (
    <>
      <BlockTitle>Official documents</BlockTitle>
      <View style={s.documentList} testID="court-brief-sources">
        {data.sources.map((source, index) => (
          <TouchableOpacity
            key={source.id}
            style={s.documentCard}
            activeOpacity={0.75}
            accessibilityRole="link"
            accessibilityLabel={`Open full official document ${source.id}`}
            onPress={() => void Linking.openURL(source.url)}
          >
            <View style={s.documentIcon}>
              <Icon name="doc" size={15} color={colors.textSecondary} />
            </View>
            <View style={s.documentCopy}>
              <Text style={s.documentEyebrow}>OFFICIAL COURT RECORD</Text>
              <Text style={s.documentTitle}>Document {index + 1}</Text>
              <Text style={s.documentUrl} numberOfLines={1}>
                {source.url}
              </Text>
            </View>
            <Icon name="external" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

export function CourtBrief({
  data,
  accent = colors.civicBlue,
  dualLens,
  onViewSource,
  includeOpinions = true,
}: {
  data: CourtBriefData;
  accent?: string;
  dualLens?: ReactNode;
  onViewSource?: (quote: BriefQuote) => void;
  includeOpinions?: boolean;
}) {
  const proceeding = PROCEEDING[data.proceeding];

  return (
    <View testID="court-brief" style={s.root}>
      <View
        style={[s.summaryCard, { borderLeftColor: accent }]}
        testID="court-brief-summary"
      >
        <View style={s.summaryHead}>
          <View style={[s.summaryIcon, { backgroundColor: `${accent}28` }]}>
            <Icon name="sparkle" size={16} color={accent} />
          </View>
          <Text style={s.summaryTitle}>The short version</Text>
          <View style={[s.summaryStatus, { borderColor: `${accent}66` }]}>
            <Text style={[s.summaryStatusText, { color: accent }]}>
              {proceeding.badge}
            </Text>
          </View>
        </View>
        <DefinedText
          text={data.takeaway.text}
          terms={data.terms}
          accent={accent}
          style={s.summaryText}
        />
        <QuoteDisclosure
          point={data.takeaway}
          accent={accent}
          onViewSource={onViewSource}
        />
        <SourcePills data={data} point={data.takeaway} />
      </View>

      <View style={s.scopeCard} testID="court-brief-scope">
        <View style={[s.scopeIcon, { backgroundColor: `${accent}28` }]}>
          <Icon name="scale" size={16} color={accent} />
        </View>
        <View style={s.scopeCopy}>
          <Text style={s.scopeLabel}>{proceeding.label}</Text>
          <Text style={s.scopeDetail}>{proceeding.detail}</Text>
          <Text style={s.scopeMeta}>
            {data.court} · {data.docket}
            {data.decisionDate ? ` · ${data.decisionDate}` : " · Date unknown"}
          </Text>
        </View>
      </View>

      {data.terms.length ? (
        <View style={s.definitionHint} testID="court-brief-definition-hint">
          <Icon name="book" size={13} color={accent} />
          <Text style={s.definitionHintText}>
            Tap any blue legal term for a plain-language definition.
          </Text>
        </View>
      ) : null}

      <BlockTitle>What the court did</BlockTitle>
      <View style={[s.rulingCard, { borderLeftColor: accent }]}>
        <View style={s.rulingHead}>
          <View style={[s.rulingIcon, { backgroundColor: `${accent}28` }]}>
            <Icon name="check" size={15} color={accent} />
          </View>
          <Text style={s.rulingLabel}>THE RULING</Text>
        </View>
        <DefinedText
          text={data.action.text}
          terms={data.terms}
          accent={accent}
          style={s.rulingText}
        />
        <View style={s.postureBlock}>
          <Text style={s.postureLabel}>WHAT THE COURT WAS DECIDING</Text>
          <DefinedText
            text={data.posture}
            terms={data.terms}
            accent={accent}
            style={s.postureText}
          />
        </View>
        <QuoteDisclosure
          point={data.action}
          accent={accent}
          onViewSource={onViewSource}
        />
        <SourcePills data={data} point={data.action} />
      </View>

      {data.questions.length ? (
        <>
          <BlockTitle>Questions before the court</BlockTitle>
          <View style={s.numberedList} testID="court-brief-questions">
            {data.questions.map((question, index) => (
              <View key={index} style={s.numberedRow}>
                <Text style={[s.numberedIndex, { color: accent }]}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <View style={s.numberedCopy}>
                  <DefinedText
                    text={question.text}
                    terms={data.terms}
                    accent={accent}
                    style={s.numberedText}
                  />
                  <SourcePills data={data} point={question} />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {data.reasoning.length ? (
        <>
          <BlockTitle>How the court got there</BlockTitle>
          <View style={s.cardList} testID="court-brief-reasoning">
            {data.reasoning.map((reason, index) => (
              <PointCard
                key={index}
                data={data}
                point={reason}
                accent={accent}
                label={REASON[reason.kind]}
                onViewSource={onViewSource}
              />
            ))}
          </View>
        </>
      ) : null}

      {data.effects.length ? (
        <>
          <BlockTitle>Who it lands on</BlockTitle>
          <View style={s.cardList} testID="court-brief-effects">
            {data.effects.map((effect, index) => {
              const ordered = effect.certainty === "court_order";
              const outcomeColor = ordered ? "#55D6BE" : "#F4C95D";
              return (
                <View
                  key={index}
                  style={[
                    s.effectCard,
                    {
                      backgroundColor: `${outcomeColor}0D`,
                      borderColor: `${outcomeColor}4A`,
                      borderLeftColor: outcomeColor,
                    },
                  ]}
                >
                  <View style={s.effectHead}>
                    <View
                      style={[
                        s.effectIcon,
                        {
                          backgroundColor: `${outcomeColor}24`,
                          borderColor: `${outcomeColor}4A`,
                        },
                      ]}
                    >
                      <Icon
                        name={ordered ? "check" : "help"}
                        size={14}
                        color={outcomeColor}
                      />
                    </View>
                    <Text style={s.effectGroup}>{effect.group}</Text>
                    <View
                      style={[
                        s.effectChip,
                        {
                          backgroundColor: `${outcomeColor}18`,
                          borderColor: `${outcomeColor}70`,
                        },
                      ]}
                    >
                      <Text style={[s.effectChipText, { color: outcomeColor }]}>
                        {ordered ? "ORDERED" : "POSSIBLE"}
                      </Text>
                    </View>
                  </View>
                  <DefinedText
                    text={effect.text}
                    terms={data.terms}
                    accent={accent}
                    style={s.effectText}
                  />
                  <QuoteDisclosure
                    point={effect}
                    accent={accent}
                    onViewSource={onViewSource}
                  />
                  <SourcePills data={data} point={effect} />
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {includeOpinions ? (
        <OpinionsSection
          data={data}
          accent={accent}
          onViewSource={onViewSource}
        />
      ) : null}

      <UnknownsCard data={data} accent={accent} />

      {dualLens ? (
        <View style={s.lensSection}>
          <BlockTitle>How people make the case</BlockTitle>
          {dualLens}
        </View>
      ) : null}

      <OfficialDocuments data={data} />
    </View>
  );
}

/** Court opinions are a first-class reading mode, not a bill-style footnote. */
export function CourtOpinions({
  data,
  accent = colors.civicBlue,
  onViewSource,
}: {
  data: CourtBriefData;
  accent?: string;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  return (
    <View style={s.root} testID="court-opinions">
      <View style={[s.opinionsIntro, { borderLeftColor: accent }]}>
        <View style={[s.summaryIcon, { backgroundColor: `${accent}28` }]}>
          <Icon name="message" size={16} color={accent} />
        </View>
        <View style={s.opinionsIntroCopy}>
          <Text style={s.opinionsIntroTitle}>Read the opinions</Text>
          <Text style={s.opinionsIntroText}>
            Separate writings explain why individual justices agreed or
            disagreed. They do not change what the court ordered.
          </Text>
          <Text style={s.scopeMeta}>
            {data.court} · {data.docket}
          </Text>
        </View>
      </View>
      <OpinionsSection
        data={data}
        accent={accent}
        onViewSource={onViewSource}
      />
      <UnknownsCard data={data} accent={accent} />
      <OfficialDocuments data={data} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 18, paddingBottom: 24 },
  definedWrap: { flexShrink: 1, gap: 8 },
  definedTerm: {
    fontFamily: fontBody.semibold,
    textDecorationLine: "underline",
  },
  definitionCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    gap: 5,
  },
  definitionHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  definitionTerm: {
    fontFamily: fontBody.semibold,
    fontSize: 11.5,
  },
  definitionPlain: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.8)",
  },
  blockTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 18,
    color: colors.white,
    marginBottom: -6,
  },
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
  scopeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
  },
  scopeIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeCopy: { flex: 1, gap: 4 },
  scopeLabel: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    color: colors.white,
  },
  scopeDetail: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
  },
  scopeMeta: {
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  definitionHint: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    marginTop: -8,
    paddingHorizontal: 3,
  },
  definitionHintText: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  opinionsIntro: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 15,
  },
  opinionsIntroCopy: { flex: 1, gap: 5 },
  opinionsIntroTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    color: colors.white,
  },
  opinionsIntroText: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.74)",
  },
  rulingCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 15,
    gap: 11,
  },
  rulingHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rulingIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rulingLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 9.5,
    letterSpacing: 0.9,
    color: colors.textSecondary,
  },
  rulingText: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.white,
  },
  postureBlock: {
    backgroundColor: planes.surface,
    borderRadius: 10,
    padding: 12,
    gap: 5,
  },
  postureLabel: {
    fontFamily: fontBody.medium,
    fontSize: 9,
    letterSpacing: 0.9,
    color: colors.textSecondary,
  },
  postureText: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.78)",
  },
  numberedList: { gap: 8 },
  numberedRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 12,
    padding: 12,
  },
  numberedIndex: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    paddingTop: 2,
  },
  numberedCopy: { flex: 1, gap: 6 },
  numberedText: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: "rgba(255,255,255,0.82)",
  },
  cardList: { gap: 10 },
  pointCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  kindChip: {
    alignSelf: "flex-start",
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
  pointText: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.86)",
  },
  sourcePills: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  sourcePillText: {
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
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
  quoteBody: { backgroundColor: planes.ink, borderRadius: 10, padding: 12 },
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
  chevFlip: { transform: [{ rotate: "180deg" }] },
  effectCard: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  effectHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  effectIcon: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  effectGroup: {
    flex: 1,
    fontFamily: fontBody.bold,
    fontSize: 14.5,
    color: colors.white,
  },
  effectChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  effectChipText: {
    fontFamily: fontBody.medium,
    fontSize: 9.5,
    letterSpacing: 0.7,
  },
  effectText: {
    fontFamily: fontEditorial.regular,
    fontSize: 15.5,
    lineHeight: 21,
    color: "rgba(255,255,255,0.75)",
  },
  opinionCard: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  opinionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  opinionKind: {
    fontFamily: fontBody.semibold,
    fontSize: 9.5,
    letterSpacing: 0.9,
  },
  opinionAuthor: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  opinionText: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.82)",
  },
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
  lensSection: { gap: 12 },
  documentList: { gap: 10 },
  documentCard: {
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
  documentIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: planes.slate,
    alignItems: "center",
    justifyContent: "center",
  },
  documentCopy: { flex: 1, minWidth: 0, gap: 2 },
  documentEyebrow: {
    fontFamily: fontBody.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  documentTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: colors.white,
  },
  documentUrl: {
    fontFamily: fontBody.regular,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
});
