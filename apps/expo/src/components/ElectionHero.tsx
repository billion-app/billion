/**
 * ElectionHero — the "what election is happening" zone of the Elections tab.
 *
 * Names the address-resolved election (from getVoterInfo, not the nationwide
 * getElections list), explains in plain language what that kind of election
 * decides, and lays out the key dates.
 */
import { StyleSheet, View } from "react-native";

import type { Election } from "@acme/api";

import { EmptyBallotMark } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import {
  DigestHair,
  DigestPalette,
  DigestSpace,
  fontBody,
  fontDisplay,
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
  /**
   * Civic `earlyVoteSites[].startDate` when the voterinfo payload includes it.
   * Registration close remains a CA 15-day offset from `election.electionDay`
   * (Civic has no registration-deadline field).
   */
  earlyVoteStart?: string;
}

export function ElectionHero({ election, earlyVoteStart }: ElectionHeroProps) {
  const type = electionType(election.name);
  const days = daysUntil(election.electionDay);

  const dates = [
    {
      label: "Register by",
      value: monthDay(shiftDays(election.electionDay, -15)),
    },
    {
      label: earlyVoteStart ? "Early voting" : "Ballots mailed",
      value: monthDay(earlyVoteStart ?? shiftDays(election.electionDay, -8)),
    },
    {
      label: "Election Day",
      value: monthDay(election.electionDay),
      countdown: days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "Today",
    },
  ];

  return (
    <View style={s.wrap}>
      <EmptyBallotMark width={72} />
      <Text style={s.kicker}>{electionTypeLabel(type)}</Text>
      <Text style={s.name}>{election.name}</Text>
      <Text style={s.date}>{monthDay(election.electionDay)}</Text>
      <Text style={s.explainer}>{electionExplainer(type)}</Text>

      <View style={s.dates}>
        {dates.map((d, i) => (
          <View key={d.label}>
            {i > 0 ? <View style={s.hair} /> : null}
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>{d.label}</Text>
              <Text style={s.dateValue}>
                {d.value}
                {d.countdown ? `  ·  ${d.countdown}` : ""}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: DigestPalette.spark,
    marginTop: 10,
  },
  name: {
    fontFamily: fontDisplay.bold,
    fontSize: 32,
    color: DigestPalette.inkOnNight,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  date: {
    fontFamily: fontBody.medium,
    fontSize: 15,
    color: DigestPalette.quiet,
  },
  explainer: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: DigestPalette.quiet,
    lineHeight: 22,
    marginTop: 8,
  },
  dates: {
    marginTop: 16,
  },
  hair: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DigestHair.sectionRule,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  dateLabel: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: DigestPalette.quiet,
  },
  dateValue: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
  },
});
