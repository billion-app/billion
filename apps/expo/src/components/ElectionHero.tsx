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
import { colors, fontBody, hair, planes } from "~/styles";
import { daysUntil, monthDay } from "~/utils/dates";
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

  // Only Election Day is shown here, and only because Google Civic actually
  // returns it. The "Registration closes" and "Ballots mailed" rows that used
  // to sit alongside it were computed as electionDay-15 and electionDay-8 —
  // a plausible California timeline presented as fact, with no source and no
  // hedging. Deadlines vary by state and county and change between cycles, so
  // an offset is a guess, not a deadline. Voting logistics now live on the How
  // to Vote screen, which renders an honest "not published" state rather than
  // inventing a date.
  const dates = [
    {
      icon: "flag" as const,
      label: "Election Day",
      value: monthDay(election.electionDay),
      accent: colors.green[500],
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
    marginHorizontal: 20,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 16,
    padding: 18,
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
