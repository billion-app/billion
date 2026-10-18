/**
 * ElectionHero — the "what election is happening" zone of the Elections tab.
 *
 * Names the address-resolved election (from getVoterInfo, not the nationwide
 * getElections list), explains in plain language what that kind of election
 * decides, and shows Election Day.
 */
import { StyleSheet, View } from "react-native";

import type { Election } from "@acme/api";

import { useAppTranslation } from "~/hooks/useAppTranslation";
import { EmptyBallotMark } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import {
  DigestHair,
  DigestPalette,
  DigestSpace,
  fontBody,
  fontDisplay,
} from "~/styles";
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

/**
 * Only Election Day is shown here, and only because Google Civic actually
 * returns it. The "Registration closes" and "Ballots mailed" rows that used
 * to sit alongside it were computed as electionDay-15 and electionDay-8 —
 * a plausible California timeline presented as fact, with no source and no
 * hedging. Deadlines vary by state and county and change between cycles, so
 * an offset is a guess, not a deadline. Voting logistics now belong on the
 * How to Vote screen, which renders an honest "not published" state rather
 * than inventing a date.
 */
export function ElectionHero({ election }: ElectionHeroProps) {
  const { language, locale, t } = useAppTranslation();
  const type = electionType(election.name);
  const days = daysUntil(election.electionDay);

  const dates = [
    {
      label: t("elections.electionDay"),
      value: monthDay(election.electionDay, locale),
      countdown: days > 0 ? t("relative.daysLeft", { count: days }) : days === 0 ? t("common.today") : undefined,
    },
  ];

  return (
    <View style={s.wrap}>
      <EmptyBallotMark width={72} />
      <Text style={s.kicker}>{electionTypeLabel(type, language)}</Text>
      <Text style={s.name}>{election.name}</Text>
      <Text style={s.date}>{monthDay(election.electionDay, locale)}</Text>
      <Text style={s.explainer}>{type === "primary" ? t("elections.explainer.primaryGeneric") : electionExplainer(type, language)}</Text>

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
