/**
 * Compact local-government preview for existing surfaces. Links into the full
 * decision experience — it never duplicates the list inline.
 */
import type { Href } from "expo-router";
import {
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Icon } from "~/components/ui/Icon";
import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";
import {
  classifyDecision,
  detectJurisdictionKey,
  formatMeetingDate,
  JURISDICTION_FALLBACK_NAMES,
  lifecycleVisual,
} from "~/utils/local-government";

const PREVIEW_COUNT = 3;

export function LocalDecisionsPreview({
  address,
}: {
  address: string | null | undefined;
}) {
  const router = useRouter();

  const jurisdiction = detectJurisdictionKey(address);
  const isSanJoseResident = jurisdiction === "sanjose";
  const jurisdictionName = JURISDICTION_FALLBACK_NAMES.sanjose;

  const query = useQuery({
    ...trpc.legistar.listDecisions.queryOptions({
      jurisdiction: "sanjose",
      timeline: "upcoming",
      limit: PREVIEW_COUNT,
    }),
    enabled: isSanJoseResident,
  });
  const rows = query.data ?? [];

  if (!isSanJoseResident) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push("/local-decisions" as Href)}
      accessibilityRole="button"
      accessibilityHint="Opens the full list of upcoming and recent local decisions"
      style={[s.card, { backgroundColor: planes.slate, borderColor: hair[2] }]}
    >
      <View style={s.head}>
        <Icon name="vote" size={18} color={colors.bill} />
        <RNText style={s.title}>What {jurisdictionName} is deciding</RNText>
        <Icon name="chevR" size={15} color={colors.textSecondary} />
      </View>
      <RNText style={s.subtitle}>
        Upcoming agendas and recently decided items
      </RNText>

      {query.isLoading ? (
        <>
          <View style={[s.skeletonLine, { backgroundColor: planes.surface }]} />
          <View style={[s.skeletonLine, { backgroundColor: planes.surface }]} />
        </>
      ) : rows.length === 0 ? (
        <RNText style={s.empty}>
          No published meetings in the pipeline right now. Open the list for
          details.
        </RNText>
      ) : (
        rows.map((row) => {
          const lifecycle = classifyDecision({
            status: row.status,
            type: row.type,
            outcome: row.outcome,
            passed: row.passed,
            meetingCancelled: row.meetingCancelled,
            meetingStartsAt: row.meetingStartsAt,
          });
          const visual = lifecycleVisual(lifecycle);
          const tint =
            visual.tint === "accent"
              ? colors.bill
              : visual.tint === "success"
                ? colors.green[500]
                : visual.tint === "warning"
                  ? colors.yellow[500]
                  : visual.tint === "danger"
                    ? colors.red[400]
                    : colors.textSecondary;
          return (
            <View key={`${row.id}-${row.meetingItemId}`} style={s.row}>
              <Icon name={visual.icon} size={12} color={tint} />
              <RNText style={s.rowTitle} numberOfLines={1}>
                {row.title}
              </RNText>
              <RNText style={s.rowDate}>
                {formatMeetingDate(row.meetingStartsAt)}
              </RNText>
            </View>
          );
        })
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 9 },
  title: {
    flex: 1,
    fontFamily: fontDisplay.bold,
    fontSize: 17,
    color: colors.white,
  },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 3,
    marginBottom: 10,
  },
  skeletonLine: { height: 14, borderRadius: 7, marginTop: 8 },
  empty: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  rowTitle: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: colors.white,
  },
  rowDate: {
    fontFamily: fontBody.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
