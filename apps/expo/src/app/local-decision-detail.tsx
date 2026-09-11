/**
 * Detail screen for one local-government decision: canonical Matter info,
 * the multi-meeting occurrence timeline, official documents, and honest
 * participation guidance. Only API-supported fields are shown.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { DecisionDetail } from "~/utils/local-government";
import { ExternalLink } from "~/components/ExternalLink";
import {
  DocumentsSection,
  ParticipationCard,
} from "~/components/local-government/DocumentsSection";
import { LifecycleChip } from "~/components/local-government/LifecycleChip";
import { OccurrenceTimeline } from "~/components/local-government/OccurrenceTimeline";
import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui/Icon";
import { NavHeader } from "~/components/ui/NavHeader";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette as P,
  DigestRadii,
  DigestSpace,
} from "~/styles";
import { DecisionSeal, SectionFlourish } from "~/components/digest/CraftMarks";
import { trpc } from "~/utils/api";
import {
  classifyDecision,
  formatMeetingDate,
  latestOccurrence,
  lifecycleLabel,
  nextUpcomingOccurrence,
  parseDate,
  scopeInfo,
  topicLabel,
} from "~/utils/local-government";

export default function LocalDecisionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;

  const query = useQuery({
    ...trpc.legistar.getDecision.queryOptions({ id: id ?? "" }),
    enabled: Boolean(id),
    retry: false,
  });

  const errorCode = (query.error as { data?: { code?: string } } | null)?.data
    ?.code;

  if (!id || errorCode === "NOT_FOUND") {
    return (
      <View style={s.screen}>
        <NavHeader title="Local decision" tone="dark" onBack={() => router.back()} />
        <DetailState
          title="This decision isn't available"
          body="It may have been removed from the official record, or the link is out of date."
        />
      </View>
    );
  }

  if (query.isLoading) {
    return (
      <View style={s.screen}>
        <NavHeader title="Local decision" tone="dark" onBack={() => router.back()} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={P.spark} />
        </View>
      </View>
    );
  }

  if (query.error || !query.data) {
    return (
      <View style={s.screen}>
        <NavHeader title="Local decision" tone="dark" onBack={() => router.back()} />
        <DetailState
          title="Couldn't load this decision"
          body="The official records source didn't respond. Your link is still valid — try again."
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
  const [historyOpen, setHistoryOpen] = useState(false);

  const latest = latestOccurrence(decision.occurrences);
  const lifecycle = classifyDecision({
    status: decision.status,
    type: decision.type,
    outcome: latest?.action ?? null,
    passed: null,
    meetingCancelled: latest?.cancelled ?? false,
    meetingStartsAt: latest?.startsAt ?? null,
  });
  const scope = scopeInfo(
    decision.scope,
    decision.districtNumbers,
    decision.geographicText,
  );
  const topic = topicLabel(decision.topic);
  const upcoming = nextUpcomingOccurrence(decision.occurrences);

  return (
    <View style={s.screen}>
      <NavHeader title="Local decision" tone="dark" onBack={onBack} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dossier header — unique rhythm vs contest/measure */}
        <View style={s.dossierMark}>
          <DecisionSeal size={28} />
        </View>
        {topic ? <Text style={s.kicker}>{topic}</Text> : null}
        <Text style={s.title} accessibilityRole="header">
          {decision.title}
        </Text>
        <View style={s.flourishWrap}>
          <SectionFlourish width={72} />
        </View>

        <View style={s.statusRow}>
          <LifecycleChip lifecycle={lifecycle} size="md" />
        </View>
        <Text style={s.scopeSentence}>
          {[
            decision.jurisdiction,
            scope.sentence ??
              "Geographic area not specified in the official record.",
          ].join(" · ")}
        </Text>

        {/* Key facts */}
        <View style={s.factsCard}>
          <FactRow
            label="Status"
            value={
              decision.status?.trim()
                ? `${lifecycleLabel(lifecycle)} (listed as “${decision.status.trim()}”)`
                : lifecycleLabel(lifecycle)
            }
          />
          {upcoming ? (
            <FactRow
              label="Next public meeting"
              value={`${formatMeetingDate(upcoming.startsAt)} · ${upcoming.body}`}
            />
          ) : decision.occurrences[0] ? (
            <FactRow
              label="Most recent meeting"
              value={`${formatMeetingDate(decision.occurrences.at(-1)?.startsAt)} · ${decision.occurrences.at(-1)?.body}`}
            />
          ) : (
            <FactRow
              label="Meetings"
              value="No meeting appearances published yet"
            />
          )}
          {decision.fileNumber ? (
            <FactRow label="File number" value={decision.fileNumber} />
          ) : null}
          {decision.type ? (
            <FactRow label="Type" value={decision.type} />
          ) : null}
          {parseDate(decision.introDate) ? (
            <FactRow
              label="Introduced"
              value={formatMeetingDate(decision.introDate)}
            />
          ) : null}
          {decision.enactmentNumber && parseDate(decision.enactmentDate) ? (
            <FactRow
              label={`Enacted (${decision.enactmentNumber})`}
              value={formatMeetingDate(decision.enactmentDate)}
            />
          ) : null}
        </View>

        {/* Official source */}
        {decision.sourceUrl ? (
          <ExternalLink href={decision.sourceUrl}>
            <View style={s.sourceButton}>
              <Icon name="link" size={13} color={P.spark} />
              <Text style={s.sourceButtonText}>
                Open on the official {decision.jurisdiction} site
              </Text>
              <Icon name="external" size={12} color={P.spark} />
            </View>
          </ExternalLink>
        ) : null}

        {/* Timeline of meeting occurrences */}
        {decision.occurrences.length > 0 ? (
          <>
            <SectionHeading>
              {decision.occurrences.length > 1
                ? `Considered at ${decision.occurrences.length} meetings`
                : "Meeting appearance"}
            </SectionHeading>
            <OccurrenceTimeline
              occurrences={decision.occurrences}
              votes={decision.votes}
            />
          </>
        ) : (
          <Text style={s.partialNote}>
            This file exists in the official record, but no meeting agenda has
            published it yet.
          </Text>
        )}

        {/* Published matter history (when Legistar provides structured history) */}
        {decision.history.length > 0 ? (
          <>
            <TouchableOpacity
              onPress={() => setHistoryOpen((open) => !open)}
              style={s.historyToggle}
              accessibilityRole="button"
              accessibilityState={{ expanded: historyOpen }}
            >
              <Text style={s.historyToggleText}>
                {historyOpen ? "Hide" : "Show"} published action history (
                {decision.history.length})
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
                        ? formatMeetingDate(entry.actionDate)
                        : "Undated"}
                    </Text>
                    <Text style={s.historyAction}>
                      {[entry.body, entry.action].filter(Boolean).join(" · ")}
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

        {/* Honest provenance footer */}
        <Text style={s.provenance}>
          Everything above comes from {decision.jurisdiction}'s published
          records, last updated {formatMeetingDate(decision.sourceUpdatedAt)}.
          Blank fields mean the city hasn't published that information — not
          that it doesn't exist.
        </Text>
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
