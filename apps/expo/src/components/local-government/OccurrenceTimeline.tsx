/**
 * Chronological timeline of every meeting at which a decision appeared.
 * Each occurrence can carry its own agenda number, action, tally and votes.
 */
import { StyleSheet, Text, View } from "react-native";

import type { DecisionDetail } from "~/utils/local-government";
import { ExternalLink } from "~/components/ExternalLink";
import { colors, fontBody, useTheme } from "~/styles";
import {
  formatMeetingDateTime,
  groupVotesByOccurrence,
  sortTimeline,
  voteAvailability,
  voteValueLabel,
  voteValueTone,
} from "~/utils/local-government";

type Occurrence = DecisionDetail["occurrences"][number];

export function OccurrenceTimeline({
  occurrences,
  votes,
}: {
  occurrences: readonly Occurrence[];
  votes: DecisionDetail["votes"];
}) {
  const grouped = groupVotesByOccurrence(votes);
  const ordered = sortTimeline(occurrences);

  return (
    <View style={s.wrap}>
      {ordered.map((occurrence, index) => (
        <OccurrenceRow
          key={occurrence.id}
          occurrence={occurrence}
          isLast={index === ordered.length - 1}
          votes={grouped.get(occurrence.id) ?? []}
        />
      ))}
    </View>
  );
}

function OccurrenceRow({
  occurrence,
  isLast,
  votes,
}: {
  occurrence: Occurrence;
  isLast: boolean;
  votes: DecisionDetail["votes"];
}) {
  const { theme } = useTheme();
  const availability = voteAvailability(occurrence, votes.length > 0);

  return (
    <View style={s.row}>
      {/* Rail */}
      <View style={s.rail}>
        <View
          style={[
            s.dot,
            {
              backgroundColor: occurrence.cancelled
                ? theme.textSecondary
                : theme.accent,
            },
          ]}
        />
        {!isLast && (
          <View style={[s.stem, { backgroundColor: theme.border }]} />
        )}
      </View>

      {/* Body */}
      <View style={[s.body, isLast && { paddingBottom: 0 }]}>
        <Text style={[s.date, { color: theme.foreground }]}>
          {formatMeetingDateTime(occurrence.startsAt)}
          {occurrence.cancelled ? " · Cancelled" : ""}
        </Text>
        <Text style={[s.bodyName, { color: theme.foreground }]}>
          {occurrence.body}
        </Text>
        {occurrence.agendaNumber ? (
          <Text style={[s.meta, { color: theme.textSecondary }]}>
            Agenda item {occurrence.agendaNumber}
          </Text>
        ) : null}

        {occurrence.action ? (
          <View style={[s.actionBox, { backgroundColor: theme.muted }]}>
            <Text style={[s.actionLabel, { color: theme.textSecondary }]}>
              Action taken
            </Text>
            <Text style={[s.actionText, { color: theme.foreground }]}>
              {occurrence.action}
            </Text>
            {occurrence.tally ? (
              <Text style={[s.tally, { color: theme.foreground }]}>
                Result: {occurrence.tally}
              </Text>
            ) : null}
          </View>
        ) : occurrence.proposedAction ? (
          <View style={[s.actionBox, { backgroundColor: theme.muted }]}>
            <Text style={[s.actionLabel, { color: theme.textSecondary }]}>
              Recommended action
            </Text>
            <Text style={[s.actionText, { color: theme.foreground }]}>
              {occurrence.proposedAction}
            </Text>
          </View>
        ) : null}

        {availability.visible ? (
          <View style={[s.actionBox, { backgroundColor: theme.muted }]}>
            <Text style={[s.actionLabel, { color: theme.textSecondary }]}>
              {availability.headline}
            </Text>
            {votes.map((vote) => {
              const tone = voteValueTone(vote.value);
              const tint =
                tone === "for"
                  ? colors.green[500]
                  : tone === "against"
                    ? colors.red[400]
                    : theme.textSecondary;
              return (
                <View
                  key={`${vote.meetingItemId}-${vote.sort}`}
                  style={s.voteRow}
                >
                  <Text
                    style={[s.voteName, { color: theme.foreground }]}
                    numberOfLines={1}
                  >
                    {vote.personName}
                  </Text>
                  <Text style={[s.voteValue, { color: tint }]}>
                    {voteValueLabel(vote.value)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          availability.detail && (
            <Text style={[s.noVotes, { color: theme.textSecondary }]}>
              {availability.headline}. {availability.detail}
            </Text>
          )
        )}

        <View style={s.links}>
          {occurrence.agendaUrl ? (
            <ExternalLink href={occurrence.agendaUrl}>
              <Text style={[s.link, { color: theme.accent }]}>
                Meeting agenda
              </Text>
            </ExternalLink>
          ) : null}
          {occurrence.minutesUrl ? (
            <ExternalLink href={occurrence.minutesUrl}>
              <Text style={[s.link, { color: theme.accent }]}>Minutes</Text>
            </ExternalLink>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {},
  row: { flexDirection: "row" },
  rail: { width: 18, alignItems: "center" },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  stem: { flex: 1, width: StyleSheet.hairlineWidth, marginVertical: 4 },
  body: { flex: 1, paddingLeft: 10, paddingBottom: 22 },
  date: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
  },
  bodyName: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    marginTop: 2,
  },
  meta: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    marginTop: 2,
  },
  actionBox: {
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    gap: 4,
  },
  actionLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  actionText: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  tally: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    marginTop: 2,
  },
  voteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  voteName: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    flexShrink: 1,
  },
  voteValue: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
  },
  noVotes: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  links: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  link: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
  },
});
