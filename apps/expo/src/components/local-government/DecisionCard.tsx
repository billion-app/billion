/**
 * Compact editorial card for one local decision occurrence row. The card is
 * jurisdiction-neutral: everything location-specific arrives via props/data.
 */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { DecisionRow } from "~/utils/local-government";
import { Icon } from "~/components/ui/Icon";
import { colors, fontBody, fontEditorial, useTheme } from "~/styles";
import {
  classifyDecision,
  formatMeetingDate,
  relativeDay,
  scopeInfo,
  topicLabel,
} from "~/utils/local-government";
import { LifecycleChip } from "./LifecycleChip";

export function DecisionCard({
  decision,
  onPress,
}: {
  decision: DecisionRow;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const lifecycle = classifyDecision({
    status: decision.status,
    type: decision.type,
    outcome: decision.outcome,
    passed: decision.passed,
    meetingCancelled: decision.meetingCancelled,
    meetingStartsAt: decision.meetingStartsAt,
  });
  const scope = scopeInfo(
    decision.scope,
    decision.districtNumbers,
    decision.geographicText,
  );
  const topic = topicLabel(decision.topic);
  const when = formatMeetingDate(decision.meetingStartsAt);
  const relative = relativeDay(decision.meetingStartsAt);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Opens the full decision"
      style={[
        s.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={[s.spine, { backgroundColor: theme.accent }]} />
      <View style={s.content}>
        <View style={s.metaRow}>
          <LifecycleChip lifecycle={lifecycle} />
          {topic ? (
            <Text
              style={[s.metaText, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {topic}
            </Text>
          ) : null}
        </View>

        {/* Official title — shown as-is; we never invent a summary for it. */}
        <Text style={[s.title, { color: theme.foreground }]} numberOfLines={3}>
          {decision.title}
        </Text>

        <View style={s.facts}>
          <View style={s.fact}>
            <Icon name="users" size={12} color={theme.textSecondary} />
            <Text
              style={[s.factText, { color: theme.foreground }]}
              numberOfLines={1}
            >
              {decision.body}
            </Text>
          </View>
          <View style={s.fact}>
            <Icon name="calendar" size={12} color={theme.textSecondary} />
            <Text style={[s.factText, { color: theme.foreground }]}>
              {when}
              {relative ? ` · ${relative}` : ""}
            </Text>
          </View>
        </View>

        <View style={s.footerRow}>
          <View style={s.fileWrap}>
            {decision.fileNumber ? (
              <Text
                style={[s.file, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                File {decision.fileNumber}
                {decision.agendaNumber
                  ? ` · Agenda ${decision.agendaNumber}`
                  : ""}
              </Text>
            ) : null}
            {scope.label ? (
              <View style={[s.scopeBadge, { borderColor: theme.border }]}>
                <Icon name="pin" size={10} color={theme.textSecondary} />
                <Text
                  style={[s.scopeText, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {scope.label}
                </Text>
              </View>
            ) : null}
          </View>
          <Icon name="chevR" size={14} color={colors.textSecondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  spine: { width: 3 },
  content: { flex: 1, padding: 14 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  metaText: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    flexShrink: 1,
  },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 15.5,
    lineHeight: 21,
    marginBottom: 10,
  },
  facts: { gap: 5, marginBottom: 10 },
  fact: { flexDirection: "row", alignItems: "center", gap: 6 },
  factText: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fileWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  file: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    flexShrink: 1,
  },
  scopeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  scopeText: {
    fontFamily: fontBody.semibold,
    fontSize: 10.5,
    maxWidth: 150,
  },
});
