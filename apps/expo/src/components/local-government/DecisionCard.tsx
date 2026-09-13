/**
 * Compact editorial card for one local decision occurrence row. The card is
 * jurisdiction-neutral: everything location-specific arrives via props/data.
 */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { DecisionRow } from "~/utils/local-government";
import { Icon } from "~/components/ui/Icon";
import {
  DigestHair,
  DigestPalette,
  DigestRadii,
  fontBody,
  fontDisplay,
} from "~/styles";
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
      style={s.card}
    >
      <View style={s.spine} />
      <View style={s.content}>
        <View style={s.metaRow}>
          <LifecycleChip lifecycle={lifecycle} />
          {topic ? (
            <Text style={s.metaText} numberOfLines={1}>
              {topic}
            </Text>
          ) : null}
        </View>

        {/* Official title — shown as-is; we never invent a summary for it. */}
        <Text style={s.title} numberOfLines={3}>
          {decision.title}
        </Text>

        <View style={s.facts}>
          <View style={s.fact}>
            <Icon name="users" size={12} color={DigestPalette.quiet} />
            <Text style={s.factText} numberOfLines={1}>
              {decision.body}
            </Text>
          </View>
          <View style={s.fact}>
            <Icon name="calendar" size={12} color={DigestPalette.quiet} />
            <Text style={s.factText}>
              {when}
              {relative ? ` · ${relative}` : ""}
            </Text>
          </View>
        </View>

        <View style={s.footerRow}>
          <View style={s.fileWrap}>
            {decision.fileNumber ? (
              <Text style={s.file} numberOfLines={1}>
                File {decision.fileNumber}
                {decision.agendaNumber
                  ? ` · Agenda ${decision.agendaNumber}`
                  : ""}
              </Text>
            ) : null}
            {scope.label ? (
              <View style={s.scopeBadge}>
                <Icon name="pin" size={10} color={DigestPalette.quiet} />
                <Text style={s.scopeText} numberOfLines={1}>
                  {scope.label}
                </Text>
              </View>
            ) : null}
          </View>
          <Icon name="chevR" size={14} color={DigestPalette.quiet} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: DigestRadii.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.card,
    overflow: "hidden",
  },
  spine: { width: 3, backgroundColor: DigestPalette.spark },
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
    color: DigestPalette.quiet,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.3,
    marginBottom: 10,
    color: DigestPalette.inkOnNight,
  },
  facts: { gap: 5, marginBottom: 10 },
  fact: { flexDirection: "row", alignItems: "center", gap: 6 },
  factText: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    flexShrink: 1,
    color: DigestPalette.inkOnNight,
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
    color: DigestPalette.quiet,
  },
  scopeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestPalette.border,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  scopeText: {
    fontFamily: fontBody.semibold,
    fontSize: 10.5,
    maxWidth: 150,
    color: DigestPalette.quiet,
  },
});
