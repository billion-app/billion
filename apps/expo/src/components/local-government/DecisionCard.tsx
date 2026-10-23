/**
 * Compact editorial card for one local decision occurrence row. The card is
 * jurisdiction-neutral: everything location-specific arrives via props/data.
 */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { DecisionRow } from "~/utils/local-government";
import { Icon } from "~/components/ui/Icon";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useSavedContent } from "~/hooks/useSavedContent";
import {
  DigestHair,
  DigestPalette,
  DigestRadii,
  fontBody,
  fontDisplay,
} from "~/styles";
import { followAccessibilityLabel } from "~/utils/follow-copy";
import {
  classifyDecision,
  formatMeetingDate,
  relativeDay,
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
  const { t: tx, language } = useAppTranslation();
  const { isSaved, toggleSave } = useSavedContent();
  const saved = isSaved(decision.id);

  const lifecycle = classifyDecision({
    status: decision.status,
    type: decision.type,
    outcome: decision.outcome,
    passed: decision.passed,
    meetingCancelled: decision.meetingCancelled,
    meetingStartsAt: decision.meetingStartsAt,
  });
  const topic = topicLabel(decision.topic, language);
  const when = formatMeetingDate(decision.meetingStartsAt, language);
  const relative = relativeDay(decision.meetingStartsAt, undefined, language);

  return (
    <View style={s.card}>
      <View style={s.spine} />
      <View style={s.content}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${decision.title}. ${decision.body}, ${when}.`}
          accessibilityHint={tx("Opens the full decision")}
        >
          <View style={s.metaRow}>
            <LifecycleChip lifecycle={lifecycle} />
            {topic ? (
              <Text style={s.metaText} numberOfLines={1}>
                {topic}
              </Text>
            ) : null}
          </View>

          <Text style={s.sourceCaption}>{tx("localDetail.original")}</Text>
          <Text style={s.title} numberOfLines={3} accessibilityLanguage="en">
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
        </TouchableOpacity>
        <View style={s.footerRow}>
          <View style={s.fileWrap}>
            {decision.fileNumber ? (
              <Text style={s.file} numberOfLines={1}>
                {tx("File {value1}{value2}", {
                  value1: decision.fileNumber,
                  value2: decision.agendaNumber
                    ? ` · ${tx("local.agendaItem", { item: decision.agendaNumber })}`
                    : "",
                })}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={followAccessibilityLabel(
              "local_decision",
              saved,
              decision.title,
              language,
            )}
            accessibilityState={{ selected: saved }}
            style={s.follow}
            onPress={() => {
              toggleSave({
                id: decision.id,
                type: "local_decision",
                title: decision.title,
              });
            }}
          >
            <Icon
              name={saved ? "bookmarkFill" : "bookmark"}
              size={18}
              color={saved ? DigestPalette.spark : DigestPalette.quiet}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  follow: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
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
  sourceCaption: {
    fontFamily: fontBody.regular,
    fontSize: 10.5,
    color: DigestPalette.quiet,
    marginBottom: 4,
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
});
