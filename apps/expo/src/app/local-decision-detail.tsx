/**
 * Detail screen for one local-government decision: canonical Matter info,
 * the multi-meeting occurrence timeline, official documents, and honest
 * participation guidance. Only API-supported fields are shown.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { DecisionDetail } from "~/utils/local-government";
import { DecisionSeal, SectionFlourish } from "~/components/digest/CraftMarks";
import { ExternalLink } from "~/components/ExternalLink";
import {
  DocumentsSection,
  ParticipationCard,
} from "~/components/local-government/DocumentsSection";
import { LifecycleChip } from "~/components/local-government/LifecycleChip";
import { LocalDecisionBrief } from "~/components/local-government/LocalDecisionBrief";
import { LocalDecisionFollow } from "~/components/local-government/LocalDecisionFollow";
import { OccurrenceTimeline } from "~/components/local-government/OccurrenceTimeline";
import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui/Icon";
import { NavHeader } from "~/components/ui/NavHeader";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  DigestHair,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { trpc } from "~/utils/api";
import { getBaseUrl } from "~/utils/base-url";
import {
  classifyDecision,
  formatMeetingDate,
  latestOccurrence,
  nextUpcomingOccurrence,
  parseDate,
  scopeInfo,
  topicLabel,
} from "~/utils/local-government";

export default function LocalDecisionDetailScreen() {
  const { t: tx } = useAppTranslation();

  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;

  const query = useQuery({
    ...trpc.legistar.getDecision.queryOptions({ id: id ?? "" }),
    enabled: Boolean(id),
    retry: false,
  });

  const errorCode = query.error?.data?.code;

  if (!id || errorCode === "NOT_FOUND") {
    return (
      <View style={s.screen}>
        <NavHeader
          large
          title={tx("Local decision")}
          tone="dark"
          onBack={() => router.back()}
        />
        <DetailState
          title={tx("This decision isn't available")}
          body={tx(
            "It may have been removed from the official record, or the link is out of date.",
          )}
        />
      </View>
    );
  }

  if (query.isLoading) {
    return (
      <View style={s.screen}>
        <NavHeader
          large
          title={tx("Local decision")}
          tone="dark"
          onBack={() => router.back()}
        />
        <View style={s.center}>
          <ActivityIndicator size="large" color={P.spark} />
        </View>
      </View>
    );
  }

  if (query.error || !query.data) {
    return (
      <View style={s.screen}>
        <NavHeader
          large
          title={tx("Local decision")}
          tone="dark"
          onBack={() => router.back()}
        />
        <DetailState
          title={tx("Couldn't load this decision")}
          body={tx(
            "The official records source didn't respond. Your link is still valid \u2014 try again.",
          )}
        />
      </View>
    );
  }

  return <DecisionBody decision={query.data} onBack={() => router.back()} />;
}

function DecisionBody({
  decision,
  onBack,
}: {
  decision: DecisionDetail;
  onBack: () => void;
}) {
  const { t: tx, language } = useAppTranslation();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [mode, setMode] = useState<"record" | "brief">("record");

  const latest = latestOccurrence(decision.occurrences);
  const lifecycle = classifyDecision({
    status: decision.status,
    type: decision.type,
    outcome: latest?.action ?? null,
    passed: latest?.passed ?? null,
    meetingCancelled: latest?.cancelled ?? false,
    meetingStartsAt: latest?.startsAt ?? null,
  });
  const scope = scopeInfo(
    decision.scope,
    decision.districtNumbers,
    decision.geographicText,
    language,
  );
  const topic = topicLabel(decision.topic, language);
  const upcoming = nextUpcomingOccurrence(decision.occurrences);

  return (
    <View style={s.screen}>
      <NavHeader
        large
        title={tx("Local decision")}
        tone="dark"
        onBack={onBack}
        action={
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={tx("localDetail.share")}
            style={s.shareButton}
            onPress={() => {
              const url = `${getBaseUrl()}/local/${encodeURIComponent(decision.jurisdictionKey)}/${encodeURIComponent(decision.id)}`;
              void Share.share({
                message: `${decision.title}\n${url}`,
                url,
              }).catch(() => Alert.alert(tx("localDetail.shareFailed")));
            }}
          >
            <Icon name="share" size={20} color={P.spark} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.dossierMark}>
          <DecisionSeal size={28} />
        </View>
        {topic ? <Text style={s.kicker}>{topic}</Text> : null}
        <Text style={s.partialNote}>{tx("localDetail.original")}</Text>
        <Text
          style={s.title}
          accessibilityRole="header"
          accessibilityLanguage="en"
        >
          {decision.title}
        </Text>
        <View style={s.flourishWrap}>
          <SectionFlourish width={72} />
        </View>

        <View style={s.factsCard}>
          <SectionHeading>{tx("localDetail.reading")}</SectionHeading>
          <View style={s.statusRow}>
            <LifecycleChip lifecycle={lifecycle} size="md" />
          </View>
          <Text style={s.scopeSentence}>
            {[
              decision.jurisdiction,
              scope.sentence ??
                tx("Geographic area not specified in the official record."),
            ].join(" · ")}
          </Text>
          {decision.sourceUrl && (
            <ExternalLink href={decision.sourceUrl} asChild>
              <TouchableOpacity style={s.shareButton} accessibilityRole="link">
                <Text style={s.sourceButtonText}>
                  {tx("localDetail.evidence")}
                </Text>
              </TouchableOpacity>
            </ExternalLink>
          )}
        </View>
        <LocalDecisionFollow id={decision.id} title={decision.title} />
        {decision.brief && (
          <View style={s.modeRow}>
            <TouchableOpacity
              style={s.modeButton}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "record" }}
              onPress={() => setMode("record")}
            >
              <Text
                style={mode === "record" ? s.sourceButtonText : s.partialNote}
              >
                {tx("localDetail.record")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.modeButton}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "brief" }}
              onPress={() => setMode("brief")}
            >
              <Text
                style={mode === "brief" ? s.sourceButtonText : s.partialNote}
              >
                {tx("localDetail.explanation")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {mode === "brief" && decision.brief ? (
          <LocalDecisionBrief
            brief={decision.brief}
            documents={decision.documents}
          />
        ) : (
          <>
            <SectionHeading>{tx("localDetail.record")}</SectionHeading>
            <View style={s.factsCard}>
              {decision.status?.trim() && (
                <FactRow label={tx("Status")} value={decision.status.trim()} />
              )}
              {upcoming ? (
                <FactRow
                  label={tx("Next public meeting")}
                  value={`${formatMeetingDate(upcoming.startsAt, language)} · ${upcoming.body}`}
                />
              ) : decision.occurrences[0] ? (
                <FactRow
                  label={tx("Most recent meeting")}
                  value={`${formatMeetingDate(latest?.startsAt, language)} · ${latest?.body}`}
                />
              ) : (
                <FactRow
                  label={tx("Meetings")}
                  value={tx("No meeting appearances published yet")}
                />
              )}
              {decision.fileNumber ? (
                <FactRow
                  label={tx("File number")}
                  value={decision.fileNumber}
                />
              ) : null}
              {decision.type ? (
                <FactRow label={tx("Type")} value={decision.type} />
              ) : null}
              {parseDate(decision.introDate) ? (
                <FactRow
                  label={tx("Introduced")}
                  value={formatMeetingDate(decision.introDate, language)}
                />
              ) : null}
              {decision.enactmentNumber && parseDate(decision.enactmentDate) ? (
                <FactRow
                  label={tx("Enacted ({value1})", {
                    value1: decision.enactmentNumber,
                  })}
                  value={formatMeetingDate(decision.enactmentDate, language)}
                />
              ) : null}
            </View>
            {decision.sourceUrl ? (
              <ExternalLink href={decision.sourceUrl} asChild>
                <TouchableOpacity
                  style={s.sourceButton}
                  accessibilityRole="link"
                >
                  <Icon name="link" size={13} color={P.spark} />
                  <Text style={s.sourceButtonText}>
                    {tx("Open on the official {value1} site", {
                      value1: decision.jurisdiction,
                    })}
                  </Text>
                  <Icon name="external" size={12} color={P.spark} />
                </TouchableOpacity>
              </ExternalLink>
            ) : null}
            {decision.occurrences.length > 0 ? (
              <>
                <SectionHeading>
                  {decision.occurrences.length > 1
                    ? tx("Considered at {value1} meetings", {
                        value1: decision.occurrences.length,
                      })
                    : tx("Meeting appearance")}
                </SectionHeading>
                <OccurrenceTimeline
                  occurrences={decision.occurrences}
                  votes={decision.votes}
                />
              </>
            ) : (
              <Text style={s.partialNote}>
                {tx(
                  "This file exists in the official record, but no meeting agenda has published it yet.",
                )}
              </Text>
            )}
            {decision.history.length > 0 ? (
              <>
                <TouchableOpacity
                  onPress={() => setHistoryOpen((open) => !open)}
                  style={s.historyToggle}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: historyOpen }}
                >
                  <Text style={s.historyToggleText}>
                    {tx("{value1} published action history ( {value2})", {
                      value1: historyOpen ? tx("Hide") : tx("Show"),
                      value2: decision.history.length,
                    })}
                  </Text>
                  <Icon
                    name={historyOpen ? "chevD" : "chevR"}
                    size={14}
                    color={P.quiet}
                  />
                </TouchableOpacity>
                {historyOpen && (
                  <View style={s.historyCard}>
                    {decision.history.map((entry) => (
                      <View key={entry.id} style={s.historyRow}>
                        <Text style={s.historyDate}>
                          {entry.actionDate
                            ? formatMeetingDate(entry.actionDate, language)
                            : tx("Undated")}
                        </Text>
                        <Text style={s.historyAction}>
                          {[entry.body, entry.action]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}

            <DocumentsSection
              documents={decision.documents}
              publicComments={decision.publicComments}
            />

            <ParticipationCard participation={decision.participation} />

            <Text style={s.provenance}>
              {tx("localDetail.provenance", {
                date: formatMeetingDate(decision.sourceUpdatedAt, language),
              })}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <Text style={s.sectionHeading}>{children.toUpperCase()}</Text>;
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.factRow}>
      <Text style={s.factLabel}>{label}</Text>
      <Text style={s.factValue}>{value}</Text>
    </View>
  );
}

function DetailState({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.center}>
      <Text style={s.stateTitle}>{title}</Text>
      <Text style={s.stateBody}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  shareButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  modeButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menu,
  },
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: DigestSpace.coverPadX,
    paddingTop: 8,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  dossierMark: { marginBottom: 12, alignItems: "flex-start" },
  flourishWrap: { marginBottom: 16, alignItems: "flex-start" },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 8,
    color: P.spark,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.45,
    marginBottom: 8,
    color: P.inkOnNight,
  },
  statusRow: { flexDirection: "row", marginBottom: 10 },
  scopeSentence: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 16,
    color: P.quiet,
  },
  factsCard: {
    backgroundColor: P.card,
    borderRadius: DigestRadii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: P.spark,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  factLabel: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    flexShrink: 0,
    color: P.quiet,
  },
  factValue: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    textAlign: "right",
    flexShrink: 1,
    color: P.inkOnNight,
  },
  sourceButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.coverBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 24,
  },
  sourceButtonText: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: P.spark,
  },
  sectionHeading: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    marginTop: 16,
    marginBottom: 12,
    color: P.spark,
    textTransform: "uppercase",
  },
  partialNote: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 12,
    color: P.quiet,
  },
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.menu,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  historyToggleText: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: P.inkOnNight,
  },
  historyCard: {
    backgroundColor: P.card,
    borderRadius: DigestRadii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  historyRow: { gap: 2 },
  historyDate: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: P.inkOnNight,
  },
  historyAction: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    color: P.quiet,
  },
  provenance: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 20,
    color: P.quiet,
  },
  stateTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    textAlign: "center",
    color: P.inkOnNight,
  },
  stateBody: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: P.quiet,
  },
});
