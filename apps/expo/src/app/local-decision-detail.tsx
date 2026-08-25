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
import { Text, View as ThemedView } from "~/components/Themed";
import { Icon } from "~/components/ui/Icon";
import { NavHeader } from "~/components/ui/NavHeader";
import { colors, fontBody, fontDisplay, useTheme } from "~/styles";
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
  const { theme } = useTheme();
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
      <ThemedView style={[s.screen, { backgroundColor: theme.background }]}>
        <NavHeader title="Local decision" onBack={() => router.back()} />
        <DetailState
          title="This decision isn't available"
          body="It may have been removed from the official record, or the link is out of date."
        />
      </ThemedView>
    );
  }

  if (query.isLoading) {
    return (
      <ThemedView style={[s.screen, { backgroundColor: theme.background }]}>
        <NavHeader title="Local decision" onBack={() => router.back()} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      </ThemedView>
    );
  }

  if (query.error || !query.data) {
    return (
      <ThemedView style={[s.screen, { backgroundColor: theme.background }]}>
        <NavHeader title="Local decision" onBack={() => router.back()} />
        <DetailState
          title="Couldn't load this decision"
          body="The official records source didn't respond. Your link is still valid — try again."
        />
      </ThemedView>
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
  const { theme } = useTheme();
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
    <ThemedView style={[s.screen, { backgroundColor: theme.background }]}>
      <NavHeader title="Local decision" onBack={onBack} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        {topic ? (
          <Text style={[s.kicker, { color: colors.bill }]}>{topic}</Text>
        ) : null}
        <Text
          style={[s.title, { color: theme.foreground }]}
          accessibilityRole="header"
        >
          {decision.title}
        </Text>

        <View style={s.statusRow}>
          <LifecycleChip lifecycle={lifecycle} size="md" />
        </View>
        <Text style={[s.scopeSentence, { color: theme.textSecondary }]}>
          {[
            decision.jurisdiction,
            scope.sentence ??
              "Geographic area not specified in the official record.",
          ].join(" · ")}
        </Text>

        {/* Key facts */}
        <View style={[s.factsCard, { backgroundColor: theme.card }]}>
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
            <View style={[s.sourceButton, { borderColor: theme.border }]}>
              <Icon name="link" size={13} color={theme.accent} />
              <Text style={[s.sourceButtonText, { color: theme.accent }]}>
                Open on the official {decision.jurisdiction} site
              </Text>
              <Icon name="external" size={12} color={theme.accent} />
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
          <Text style={[s.partialNote, { color: theme.textSecondary }]}>
            This file exists in the official record, but no meeting agenda has
            published it yet.
          </Text>
        )}

        {/* Published matter history (when Legistar provides structured history) */}
        {decision.history.length > 0 ? (
          <>
            <TouchableOpacity
              onPress={() => setHistoryOpen((open) => !open)}
              style={[s.historyToggle, { borderColor: theme.border }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: historyOpen }}
            >
              <Text style={[s.historyToggleText, { color: theme.foreground }]}>
                {historyOpen ? "Hide" : "Show"} published action history (
                {decision.history.length})
              </Text>
              <Icon
                name={historyOpen ? "chevD" : "chevR"}
                size={14}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            {historyOpen && (
              <View style={[s.historyCard, { backgroundColor: theme.card }]}>
                {decision.history.map((entry) => (
                  <View key={entry.id} style={s.historyRow}>
                    <Text style={[s.historyDate, { color: theme.foreground }]}>
                      {entry.actionDate
                        ? formatMeetingDate(entry.actionDate)
                        : "Undated"}
                    </Text>
                    <Text
                      style={[s.historyAction, { color: theme.textSecondary }]}
                    >
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
        <Text style={[s.provenance, { color: theme.textSecondary }]}>
          Everything above comes from {decision.jurisdiction}'s published
          records, last updated {formatMeetingDate(decision.sourceUpdatedAt)}.
          Blank fields mean the city hasn't published that information — not
          that it doesn't exist.
        </Text>
      </ScrollView>
    </ThemedView>
  );
}

function SectionHeading({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[s.sectionHeading, { color: theme.textSecondary }]}>
      {children.toUpperCase()}
    </Text>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={s.factRow}>
      <Text style={[s.factLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[s.factValue, { color: theme.foreground }]}>{value}</Text>
    </View>
  );
}

function DetailState({ title, body }: { title: string; body: string }) {
  const { theme } = useTheme();
  return (
    <View style={s.center}>
      <Text style={[s.stateTitle, { color: theme.foreground }]}>{title}</Text>
      <Text style={[s.stateBody, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 64,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  kicker: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 12,
  },
  statusRow: { flexDirection: "row", marginBottom: 10 },
  scopeSentence: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 16,
  },
  factsCard: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  factLabel: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    flexShrink: 0,
  },
  factValue: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    textAlign: "right",
    flexShrink: 1,
  },
  sourceButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 24,
  },
  sourceButtonText: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
  },
  sectionHeading: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 12,
  },
  partialNote: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 12,
  },
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  historyToggleText: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
  },
  historyCard: {
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    gap: 8,
  },
  historyRow: { gap: 2 },
  historyDate: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
  },
  historyAction: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  provenance: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 20,
  },
  stateTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    textAlign: "center",
  },
  stateBody: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
