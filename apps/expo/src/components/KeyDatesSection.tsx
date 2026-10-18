import { StyleSheet } from "react-native";

import { Text, View } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { DigestHair, DigestPalette, DigestSpace, fontBody } from "~/styles";
import { daysUntil, formatDate } from "~/utils/dates";

interface KeyDate {
  key: string;
  label: string;
  date: string;
}

interface KeyDatesSectionProps {
  /** Civic `election.electionDay` (ISO date). */
  electionDate: string;
  /** Civic `earlyVoteSites[].startDate` when voterinfo returned one. */
  earlyVoteStart?: string;
}

export function KeyDatesSection({
  electionDate,
  earlyVoteStart,
}: KeyDatesSectionProps) {
  const { locale, t } = useAppTranslation();
  const electionDateObj = new Date(electionDate);
  const registrationDeadline = new Date(electionDateObj);
  registrationDeadline.setDate(registrationDeadline.getDate() - 15);

  const dates: KeyDate[] = [
    {
      key: "register",
      label: t("elections.keyDates.registerBy"),
      date: registrationDeadline.toISOString().split("T")[0] ?? "",
    },
    {
      key: "electionDay",
      label: t("elections.electionDay"),
      date: electionDate,
    },
  ];
  if (earlyVoteStart) {
    dates.splice(1, 0, {
      key: "early",
      label: t("elections.keyDates.earlyVoting"),
      date: earlyVoteStart,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>{t("elections.keyDates.calendar")}</Text>
      {dates.map((item, index) => {
        const days = daysUntil(item.date);
        const isPassed = days < 0;
        const isNext =
          !isPassed && dates.findIndex((d) => daysUntil(d.date) >= 0) === index;
        const countdown = isPassed
          ? t("elections.keyDates.passed")
          : days === 0
            ? t("common.today")
            : t("elections.keyDates.days", { count: days });

        return (
          <View key={item.key}>
            {index > 0 ? <View style={styles.hair} /> : null}
            <View style={styles.row}>
              <Text style={[styles.label, isPassed && styles.textMuted]}>
                {item.label}
              </Text>
              <Text
                style={[
                  styles.value,
                  isPassed && styles.textMuted,
                  isNext && styles.valueOn,
                ]}
              >
                {formatDate(item.date, locale)} · {countdown}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: DigestSpace.screenPadX,
    marginBottom: 16,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  hair: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DigestHair.sectionRule,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  label: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: DigestPalette.quiet,
  },
  value: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
    textAlign: "right",
    flexShrink: 1,
  },
  valueOn: {
    color: DigestPalette.spark,
  },
  textMuted: {
    color: DigestPalette.quiet,
    opacity: 0.55,
  },
});
