/**
 * ElectionHero — the "what election is happening" zone of the Elections tab.
 *
 * Names the single active election, explains in plain language what that kind
 * of election decides, and lays out the key dates. When more than one election
 * is currently active (rare — e.g. a special election overlapping the regular
 * cycle), a switcher lets the voter flip between them.
 */
import { LayoutAnimation, StyleSheet, TouchableOpacity, View } from "react-native";

import type { Election } from "@acme/api";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { daysUntil, monthDay, shiftDays } from "~/utils/dates";
import {
  electionExplainer,
  electionType,
  electionTypeLabel,
} from "~/utils/elections";

interface ElectionHeroProps {
  /** All currently-active (not-yet-passed) elections, soonest first. */
  elections: Election[];
  /** The election the ballot is currently showing. */
  selected: Election;
  /** Switch to a different active election (only used when >1 is active). */
  onSelect: (id: string) => void;
}

export function ElectionHero({
  elections,
  selected,
  onSelect,
}: ElectionHeroProps) {
  const type = electionType(selected.name);
  const days = daysUntil(selected.electionDay);
  const hasAlternatives = elections.length > 1;

  // Key dates. TODO(backend): exact per-jurisdiction registration / VBM dates;
  // these offsets approximate a typical California timeline.
  const dates = [
    {
      icon: "clock" as const,
      label: "Registration closes",
      value: monthDay(shiftDays(selected.electionDay, -15)),
      accent: colors.yellow[500],
    },
    {
      icon: "calendar" as const,
      label: "Ballots mailed",
      value: monthDay(shiftDays(selected.electionDay, -8)),
      accent: colors.textSecondary,
    },
    {
      icon: "flag" as const,
      label: "Election Day",
      value: monthDay(selected.electionDay),
      accent: colors.green[500],
      countdown:
        days > 0 ? `${days} day${days !== 1 ? "s" : ""} left` : "Today",
    },
  ];

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={s.badge}>
          <Text style={s.badgeText}>{electionTypeLabel(type)}</Text>
        </View>
        {hasAlternatives && (
          <ElectionSwitcher
            elections={elections}
            selected={selected}
            onSelect={onSelect}
          />
        )}
      </View>

      <Text style={s.name}>{selected.name}</Text>
      <Text style={s.date}>{monthDay(selected.electionDay)}</Text>

      <View style={s.divider} />

      <Text style={s.explainer}>{electionExplainer(type)}</Text>

      <View style={s.dates}>
        {dates.map((d) => (
          <View key={d.label} style={s.dateRow}>
            <Icon name={d.icon} size={14} color={d.accent} />
            <Text style={s.dateLabel}>{d.label}</Text>
            <Text style={[s.dateValue, { color: d.accent }]}>{d.value}</Text>
            {d.countdown && <Text style={s.countdown}>· {d.countdown}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Inline dropdown of the other active elections. */
function ElectionSwitcher({
  elections,
  selected,
  onSelect,
}: ElectionHeroProps) {
  const others = elections.filter((e) => e.id !== selected.id);
  return (
    <View>
      {others.slice(0, 1).map((e) => (
        <TouchableOpacity
          key={e.id}
          style={s.switchChip}
          activeOpacity={0.8}
          onPress={() => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
            onSelect(e.id);
          }}
        >
          <Icon name="undo" size={12} color={colors.bill} />
          <Text style={s.switchText} numberOfLines={1}>
            {e.name} · {monthDay(e.electionDay)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 16,
    padding: 18,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: planes.surface,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    color: colors.bill,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  switchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 180,
  },
  switchText: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: colors.bill,
    flexShrink: 1,
  },
  name: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 21,
    color: colors.white,
    marginTop: 10,
    lineHeight: 27,
  },
  date: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: hair[2],
    marginVertical: 14,
  },
  explainer: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 20,
  },
  dates: {
    marginTop: 16,
    gap: 10,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateLabel: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  dateValue: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
  },
  countdown: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
