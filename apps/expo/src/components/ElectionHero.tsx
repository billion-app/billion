import { StyleSheet, View } from "react-native";

import type { Election } from "@acme/api";

import { EmptyBallotMark } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { DigestPalette, DigestSpace, fontBody, fontDisplay } from "~/styles";
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
  const { language, locale, t } = useAppTranslation();
  const type = electionType(election.name);
  const days = daysUntil(election.electionDay);

  const date = monthDay(election.electionDay, locale);
  const countdown =
    days > 0
      ? t("relative.daysLeft", { count: days })
      : days === 0
        ? t("common.today")
        : undefined;

  return (
    <View style={s.wrap}>
      <EmptyBallotMark width={72} />
      <Text style={s.kicker}>{electionTypeLabel(type, language)}</Text>
      <Text style={s.name}>{election.name}</Text>
      <Text style={s.date}>{date}</Text>
      <Text style={s.explainer}>
        {type === "primary"
          ? t("elections.explainer.primaryGeneric")
          : electionExplainer(type, language)}
      </Text>

      <View style={s.dates}>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>{t("elections.electionDay")}</Text>
          <Text style={s.dateValue}>
            {date}
            {countdown ? `  ·  ${countdown}` : ""}
          </Text>
        </View>
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
