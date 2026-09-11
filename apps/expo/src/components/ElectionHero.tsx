/**
 * ElectionHero — the "what election is happening" zone of the Elections tab.
 *
 * Names the address-resolved election (from getVoterInfo, not the nationwide
 * getElections list), explains in plain language what that kind of election
 * decides, and lays out the key dates.
 */
import { StyleSheet, View } from "react-native";

import type { Election } from "@acme/api";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
} from "~/styles";
import { daysUntil, monthDay, shiftDays } from "~/utils/dates";
import {
  electionExplainer,
  electionType,
  electionTypeLabel,
} from "~/utils/elections";

interface ElectionHeroProps {
  /** The election the ballot belongs to, as resolved for the user's address. */
  election: Election;
}

export function ElectionHero({ election }: ElectionHeroProps) {
  const type = electionType(election.name);
  const days = daysUntil(election.electionDay);

  // Key dates. TODO(backend): exact per-jurisdiction registration / VBM dates;
  // these offsets approximate a typical California timeline.
  const dates = [
    {
      icon: "clock" as const,
      label: "Registration closes",
      value: monthDay(shiftDays(election.electionDay, -15)),
      accent: DigestPalette.spark,
    },
    {
      icon: "calendar" as const,
      label: "Ballots mailed",
      value: monthDay(shiftDays(election.electionDay, -8)),
      accent: DigestPalette.quiet,
    },
    {
      icon: "flag" as const,
      label: "Election Day",
      value: monthDay(election.electionDay),
      accent: DigestPalette.spark,
      countdown:
        days > 0 ? `${days} day${days !== 1 ? "s" : ""} left` : "Today",
    },
  ];

  return (
    <View style={s.card}>
      <View style={s.badge}>
        <Text style={s.badgeText}>{electionTypeLabel(type)}</Text>
      </View>

      <Text style={s.name}>{election.name}</Text>
      <Text style={s.date}>{monthDay(election.electionDay)}</Text>

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

const s = StyleSheet.create({
  card: {
    marginHorizontal: DigestSpace.screenPadX,
    backgroundColor: DigestPalette.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
    padding: DigestSpace.cardBodyPadX,
    paddingBottom: DigestSpace.cardBodyPadBottom,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: DigestHair.tabActivePill,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    color: DigestPalette.spark,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  name: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    color: DigestPalette.inkOnNight,
    marginTop: 10,
    lineHeight: 29,
    letterSpacing: -0.45,
  },
  date: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.quiet,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: DigestHair.sectionRule,
    marginVertical: 14,
  },
  explainer: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: DigestPalette.quiet,
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
    color: DigestPalette.quiet,
    flex: 1,
  },
  dateValue: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
  },
  countdown: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: DigestPalette.quiet,
  },
});
