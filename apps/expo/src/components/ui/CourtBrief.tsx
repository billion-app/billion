import type { ReactNode } from "react";
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
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useLanguage } from "~/hooks/useLanguage";
import {
  fontBody,
  fontEditorial,
  BillReaderPalette as R,
  BillReaderType as T,
} from "~/styles";
import { courtSourceQuote } from "~/utils/source-passage";
import { Icon } from "./Icon";
import { ReaderText } from "./ReaderText";

type CourtDetail = Extract<
  RouterOutputs["content"]["getById"],
  { type: "court_case" }
>;
export type CourtBriefData = NonNullable<CourtDetail["courtBrief"]>;
type Point = CourtBriefData["action"];

const PROCEEDING = {
  emergency_order: {
    badge: "readerUi.temporary",
    label: "readerUi.emergencyOrder",
    detail: "readerUi.temporaryDetail",
  },
  order: {
    badge: "readerUi.order",
    label: "readerUi.courtOrder",
    detail: "readerUi.orderDetail",
  },
  merits_opinion: {
    badge: "readerUi.decision",
    label: "readerUi.fullDecision",
    detail: "readerUi.decisionDetail",
  },
  unknown: {
    badge: "readerUi.scopeUnclear",
    label: "readerUi.filing",
    detail: "readerUi.scopeDetail",
  },
} as const;

const REASON = {
  holding: "readerUi.holding",
  court_reasoning: "readerUi.reasoning",
  party_argument: "readerUi.partyArgument",
  allegation: "readerUi.allegation",
} as const;

const OPINION = {
  majority: { label: "readerUi.majority", color: R.muted },
  per_curiam: { label: "readerUi.perCuriam", color: R.muted },
  concurrence: { label: "readerUi.concurrence", color: R.muted },
  dissent: { label: "readerUi.dissent", color: R.muted },
  unknown: { label: "readerUi.opinion", color: R.muted },
} as const;

function DetailSection({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.detailSection}>
      <TouchableOpacity
        style={s.detailToggle}
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID={testID}
      >
        <Text style={s.detailTitle}>{title}</Text>
        <Icon name={open ? "minus" : "plus"} size={17} color={R.muted} />
      </TouchableOpacity>
      {open ? <View style={s.detailBody}>{children}</View> : null}
    </View>
  );
}

function BlockTitle({ children }: { children: string }) {
  return (
    <Text style={s.blockTitle} accessibilityRole="header">
      {children}
    </Text>
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
  const { t: tr } = useLanguage();
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
          open ? tr("readerUi.hideSource") : tr("readerUi.showSource")
        }
      >
        <Icon name="quote" size={11} color={R.muted} />
        <Text style={s.quoteToggleText}>
          {quote.locator
            ? `${tr("readerUi.inText")} · ${quote.locator}`
            : tr("readerUi.inText")}
        </Text>
        <View style={open ? s.chevFlip : undefined}>
          <Icon name="chevD" size={13} color={R.muted} />
        </View>
      </TouchableOpacity>
      {open ? (
        <View style={s.quoteBody}>
          <Text style={s.quoteText}>{quote.text}</Text>
        </View>
      ) : null}
      {open && onViewSource ? (
        <TouchableOpacity
          style={s.viewSourceButton}
          activeOpacity={0.78}
          onPress={() => onViewSource(quote)}
          accessibilityRole="button"
          accessibilityLabel={
            quote.locator
              ? tr("readerUi.viewSourceAt", { locator: quote.locator })
              : tr("readerUi.viewSource")
          }
        >
          <Text style={[s.viewSourceText, { color: accent }]}>
            {tr("readerUi.viewSource")}
          </Text>
          <Icon name="arrowRight" size={13} color={accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function SourcePills({ data, point }: { data: CourtBriefData; point: Point }) {
  const { t: tr } = useLanguage();
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
            accessibilityLabel={tr("readerUi.openSourceId", { id })}
            onPress={() => void Linking.openURL(source.url)}
          >
            <Icon name="doc" size={11} color={R.muted} />
            <Text style={s.sourcePillText}>
              {data.criminalCaseStatus
                ? tr("readerUi.docketSource")
                : tr("readerUi.sourceNumber", {
                    number: id.replace("document-", ""),
                  })}
            </Text>
            <Icon name="external" size={10} color={R.muted} />
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
        <View style={s.kindChip}>
          <Text style={s.kindChipText}>{label}</Text>
        </View>
      ) : null}
      <ReaderText text={point.text} terms={data.terms} style={s.pointText} />
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
  const { t: tr } = useLanguage();
  if (!data.opinions.length) return null;
  return (
    <>
      <BlockTitle>{tr("readerUi.separateOpinions")}</BlockTitle>
      <View style={s.cardList} testID="court-brief-opinions">
        {data.opinions.map((opinion, index) => {
          const treatment = OPINION[opinion.kind];
          return (
            <View key={index} style={s.opinionCard}>
              <View style={s.opinionHead}>
                <Text style={[s.opinionKind, { color: treatment.color }]}>
                  {tr(treatment.label)}
                </Text>
                <Text style={s.opinionAuthor}>
                  {opinion.author ?? tr("readerUi.unknownAuthor")}
                </Text>
              </View>
              <ReaderText
                text={opinion.text}
                terms={data.terms}
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

function UnknownsCard({ data }: { data: CourtBriefData }) {
  const { t: tr } = useLanguage();
  return (
    <View style={s.unknownCard} testID="court-brief-unknowns">
      <View style={s.unknownHead}>
        <Icon name="help" size={15} color={R.muted} />
        <Text style={s.unknownTitle}>
          {data.criminalCaseStatus
            ? tr("readerUi.docketUnknowns")
            : tr("readerUi.rulingUnknowns")}
        </Text>
      </View>
      <View style={s.unknownList}>
        {data.unknowns.map((unknown, index) => (
          <View key={index} style={s.unknownRow}>
            <Text style={s.unknownIndex}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <ReaderText
              text={unknown}
              terms={data.terms}
              style={s.unknownText}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function OfficialDocuments({ data }: { data: CourtBriefData }) {
  const { t: tr } = useLanguage();
  return (
    <>
      <BlockTitle>
        {data.criminalCaseStatus
          ? tr("readerUi.docketSource")
          : tr("readerUi.sourceMaterial")}
      </BlockTitle>
      {data.criminalCaseStatus ? (
        <Text style={s.scopeDetail}>{tr("readerUi.docketNote")}</Text>
      ) : null}
      <View style={s.documentList} testID="court-brief-sources">
        {data.sources.map((source, index) => (
          <TouchableOpacity
            key={source.id}
            style={s.documentCard}
            activeOpacity={0.75}
            accessibilityRole="link"
            accessibilityLabel={tr("readerUi.openSourceId", { id: source.id })}
            onPress={() => void Linking.openURL(source.url)}
          >
            <View style={s.documentIcon}>
              <Icon name="doc" size={15} color={R.muted} />
            </View>
            <View style={s.documentCopy}>
              <Text style={s.documentEyebrow}>
                {data.criminalCaseStatus
                  ? tr("readerUi.linkedDocket")
                  : tr("readerUi.linkedSource")}
              </Text>
              <Text style={s.documentTitle}>
                {data.criminalCaseStatus
                  ? tr("readerUi.docketNumber", { number: index + 1 })
                  : tr("readerUi.documentNumber", { number: index + 1 })}
              </Text>
              <Text style={s.documentUrl} numberOfLines={1}>
                {source.url}
              </Text>
            </View>
            <Icon name="external" size={14} color={R.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function useProceeding(data: CourtBriefData) {
  const { t: tr } = useLanguage();
  const { t: tx } = useAppTranslation();
  const template = PROCEEDING[data.proceeding];
  const proceeding = data.criminalCaseStatus
    ? {
        badge: /^pending$/i.test(data.criminalCaseStatus)
          ? tr("readerUi.pendingCase")
          : tr("readerUi.criminalCase"),
        label: tr("readerUi.criminalDocket"),
        detail: tr("readerUi.archiveStatus", {
          status: /^pending$/i.test(data.criminalCaseStatus)
            ? tx("Pending")
            : /^disposed$/i.test(data.criminalCaseStatus)
              ? tx("Disposed")
              : /^status not reported$/i.test(data.criminalCaseStatus)
                ? tx("Status not reported")
                : data.criminalCaseStatus,
        }),
      }
    : {
        badge: tr(template.badge),
        label: tr(template.label),
        detail: tr(template.detail),
      };

  return proceeding;
}

export function CourtProceeding({ data }: { data: CourtBriefData }) {
  const proceeding = useProceeding(data);
  return (
    <Text style={[s.summaryStatusText, { color: R.text }]}>
      {proceeding.badge}
    </Text>
  );
}

export function CourtTakeaway({
  data,
  accent = R.link,
  onViewSource,
  showStatus = true,
}: {
  data: CourtBriefData;
  accent?: string;
  onViewSource?: (quote: BriefQuote) => void;
  showStatus?: boolean;
}) {
  const proceeding = useProceeding(data);
  return (
    <View style={s.summaryCard} testID="court-brief-summary">
      {showStatus ? (
        <View style={s.summaryHead}>
          <View style={s.summaryStatus}>
            <Text style={s.summaryStatusText}>{proceeding.badge}</Text>
          </View>
        </View>
      ) : null}
      <ReaderText
        text={data.takeaway.text}
        terms={data.terms}
        style={s.summaryText}
      />
      <QuoteDisclosure
        point={data.takeaway}
        accent={accent}
        onViewSource={onViewSource}
      />
      {!data.takeaway.quote || !onViewSource ? (
        <SourcePills data={data} point={data.takeaway} />
      ) : null}
    </View>
  );
}

export function CourtBrief({
  data,
  accent = R.link,
  dualLens,
  onViewSource,
  includeOpinions = true,
  showTakeaway = true,
}: {
  data: CourtBriefData;
  accent?: string;
  dualLens?: ReactNode;
  onViewSource?: (quote: BriefQuote) => void;
  includeOpinions?: boolean;
  showTakeaway?: boolean;
}) {
  const { t: tr } = useLanguage();
  const proceeding = useProceeding(data);

  return (
    <View testID="court-brief" style={s.root}>
      {showTakeaway ? (
        <CourtTakeaway
          data={data}
          accent={accent}
          onViewSource={onViewSource}
        />
      ) : null}

      <View style={s.scopeCard} testID="court-brief-scope">
        <View style={s.scopeCopy}>
          <Text style={s.scopeLabel}>{proceeding.label}</Text>
          <Text style={s.scopeDetail}>{proceeding.detail}</Text>
          <Text style={s.scopeMeta}>
            {data.court} · {data.docket}
            {data.latestDocketDate
              ? ` · ${tr("readerUi.latestDocket", { date: data.latestDocketDate })}`
              : data.decisionDate
                ? ` · ${data.decisionDate}`
                : tr("readerUi.dateUnknown")}
          </Text>
        </View>
      </View>

      {data.terms.length ? (
        <View style={s.definitionHint} testID="court-brief-definition-hint">
          <Icon name="book" size={13} color={accent} />
          <Text style={s.definitionHintText}>
            {tr("readerUi.definitionHint")}
          </Text>
        </View>
      ) : null}

      <BlockTitle>
        {data.criminalCaseStatus
          ? tr("readerUi.docketRecords")
          : tr("readerUi.courtDid")}
      </BlockTitle>
      <View style={s.rulingCard}>
        <ReaderText
          text={data.action.text}
          terms={data.terms}
          style={s.rulingText}
        />
        <View style={s.postureBlock}>
          <Text style={s.postureLabel}>
            {data.criminalCaseStatus
              ? tr("readerUi.posture")
              : tr("readerUi.courtDeciding")}
          </Text>
          <ReaderText
            text={data.posture}
            terms={data.terms}
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
        <DetailSection
          title={tr("readerUi.questions")}
          testID="court-questions-toggle"
        >
          <View style={s.numberedList} testID="court-brief-questions">
            {data.questions.map((question, index) => (
              <View key={index} style={s.numberedRow}>
                <Text style={s.numberedIndex}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <View style={s.numberedCopy}>
                  <ReaderText
                    text={question.text}
                    terms={data.terms}
                    style={s.numberedText}
                  />
                  <SourcePills data={data} point={question} />
                </View>
              </View>
            ))}
          </View>
        </DetailSection>
      ) : null}

      {data.reasoning.length ? (
        <DetailSection
          title={tr(
            data.criminalCaseStatus
              ? "readerUi.recordSays"
              : "readerUi.courtReasoning",
          )}
          testID="court-reasoning-toggle"
        >
          <View style={s.cardList} testID="court-brief-reasoning">
            {data.reasoning.map((reason, index) => (
              <PointCard
                key={index}
                data={data}
                point={reason}
                accent={accent}
                label={tr(REASON[reason.kind])}
                onViewSource={onViewSource}
              />
            ))}
          </View>
        </DetailSection>
      ) : null}

      {data.effects.length ? (
        <>
          <BlockTitle>{tr("readerUi.affected")}</BlockTitle>
          <View style={s.cardList} testID="court-brief-effects">
            {data.effects.map((effect, index) => {
              const ordered = effect.certainty === "court_order";
              return (
                <View key={index} style={s.effectCard}>
                  <View style={s.effectHead}>
                    <Text style={s.effectGroup}>{effect.group}</Text>
                    <View style={s.effectChip}>
                      <Text style={s.effectChipText}>
                        {ordered
                          ? tr("readerUi.ordered")
                          : tr("readerUi.possible")}
                      </Text>
                    </View>
                  </View>
                  <ReaderText
                    text={effect.text}
                    terms={data.terms}
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

      <UnknownsCard data={data} />

      {dualLens ? (
        <DetailSection
          title={tr("readerUi.arguments")}
          testID="court-perspectives-toggle"
        >
          {dualLens}
        </DetailSection>
      ) : null}

      <OfficialDocuments data={data} />
    </View>
  );
}

/** Court opinions are a first-class reading mode, not a bill-style footnote. */
export function CourtOpinions({
  data,
  accent = R.link,
  onViewSource,
}: {
  data: CourtBriefData;
  accent?: string;
  onViewSource?: (quote: BriefQuote) => void;
}) {
  const { t: tr } = useLanguage();
  return (
    <View style={s.root} testID="court-opinions">
      <View style={s.opinionsIntro}>
        <View style={s.summaryIcon}>
          <Icon name="message" size={16} color={accent} />
        </View>
        <View style={s.opinionsIntroCopy}>
          <Text style={s.opinionsIntroTitle}>
            {tr("readerUi.readOpinions")}
          </Text>
          <Text style={s.opinionsIntroText}>{tr("readerUi.opinionsNote")}</Text>
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
      <UnknownsCard data={data} />
      <OfficialDocuments data={data} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 24, paddingBottom: 24 },
  blockTitle: { ...T.title, color: R.text, marginTop: 8 },
  detailSection: { borderTopWidth: 1, borderTopColor: R.rule },
  detailToggle: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  detailTitle: {
    ...T.body,
    fontFamily: fontBody.medium,
    color: R.reading,
    flex: 1,
  },
  detailBody: { paddingTop: 8, paddingBottom: 16 },
  summaryCard: { gap: 12 },
  summaryHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  summaryIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryStatus: { flexShrink: 1 },
  summaryStatusText: { ...T.label, color: R.muted },
  summaryText: { ...T.body, color: R.reading },
  scopeCard: { borderTopWidth: 1, borderTopColor: R.rule, paddingTop: 20 },
  scopeCopy: { gap: 8 },
  scopeLabel: { ...T.body, fontFamily: fontBody.medium, color: R.text },
  scopeDetail: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: R.reading,
  },
  scopeMeta: { ...T.label, color: R.muted },
  definitionHint: { flexDirection: "row", alignItems: "center", gap: 8 },
  definitionHintText: { ...T.label, color: R.muted, flex: 1 },
  opinionsIntro: { flexDirection: "row", gap: 12 },
  opinionsIntroCopy: { flex: 1, gap: 8 },
  opinionsIntroTitle: { ...T.title, color: R.text },
  opinionsIntroText: { ...T.body, color: R.reading },
  rulingCard: { gap: 16 },
  rulingText: { ...T.body, color: R.reading },
  postureBlock: { gap: 8, paddingTop: 8 },
  postureLabel: { ...T.label, color: R.muted },
  postureText: { ...T.body, color: R.reading },
  numberedList: { gap: 24 },
  numberedRow: { flexDirection: "row", gap: 16 },
  numberedIndex: { ...T.label, paddingTop: 5, color: R.muted },
  numberedCopy: { flex: 1, gap: 8 },
  numberedText: { ...T.body, color: R.reading },
  cardList: { gap: 28 },
  pointCard: { gap: 12 },
  kindChip: { alignSelf: "flex-start" },
  kindChipText: { ...T.label, color: R.muted },
  pointText: { ...T.body, color: R.reading },
  sourcePills: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  sourcePill: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sourcePillText: { ...T.label, color: R.muted },
  quoteWrap: { gap: 8 },
  quoteToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quoteToggleText: { ...T.label, color: R.muted, flex: 1 },
  quoteBody: {
    borderLeftWidth: 1,
    borderLeftColor: R.rule,
    paddingLeft: 16,
    paddingVertical: 8,
  },
  quoteText: {
    fontFamily: fontEditorial.regular,
    fontSize: 16,
    lineHeight: 24,
    color: R.reading,
  },
  viewSourceButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewSourceText: { ...T.action, color: R.link },
  chevFlip: { transform: [{ rotate: "180deg" }] },
  effectCard: { gap: 12 },
  effectHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 12,
  },
  effectGroup: {
    ...T.body,
    fontFamily: fontBody.medium,
    color: R.text,
    flexGrow: 1,
    flexShrink: 1,
  },
  effectChip: { alignSelf: "flex-start" },
  effectChipText: { ...T.label, color: R.muted },
  effectText: { ...T.body, color: R.reading },
  opinionCard: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: R.rule,
    paddingTop: 20,
  },
  opinionHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "baseline",
  },
  opinionKind: { ...T.label },
  opinionAuthor: { ...T.label, color: R.muted, flexShrink: 1 },
  opinionText: { ...T.body, color: R.reading },
  unknownCard: {
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: R.rule,
    paddingTop: 24,
  },
  unknownHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  unknownTitle: { ...T.title, color: R.text, flex: 1 },
  unknownList: { gap: 20 },
  unknownRow: { flexDirection: "row", gap: 16 },
  unknownIndex: { ...T.label, color: R.muted, paddingTop: 5 },
  unknownText: { ...T.body, color: R.reading },
  documentList: { gap: 16 },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: R.rule,
    paddingTop: 16,
    minHeight: 60,
  },
  documentIcon: { width: 24, alignItems: "center" },
  documentCopy: { flex: 1, minWidth: 0, gap: 4 },
  documentEyebrow: { ...T.label, color: R.muted },
  documentTitle: { ...T.body, color: R.text },
  documentUrl: { ...T.label, color: R.muted },
});
