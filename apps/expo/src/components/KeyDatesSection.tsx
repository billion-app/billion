import { StyleSheet } from "react-native";

import { Text, View } from "~/components/Themed";
import { DigestHair, DigestPalette, DigestSpace, fontBody } from "~/styles";
import { daysUntil, formatDate } from "~/utils/dates";

interface KeyDate {
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
  const electionDateObj = new Date(electionDate);
  const registrationDeadline = new Date(electionDateObj);
  registrationDeadline.setDate(registrationDeadline.getDate() - 15);

  const dates: KeyDate[] = [
    {
      label: "Register by",
      date: registrationDeadline.toISOString().split("T")[0] ?? "",
    },
    {
      label: "Election Day",
      date: electionDate,
    },
  ];
  if (earlyVoteStart) {
    dates.splice(1, 0, { label: "Early voting", date: earlyVoteStart });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Calendar</Text>
      {dates.map((item, index) => {
        const days = daysUntil(item.date);
        const isPassed = days < 0;
        const isNext =
          !isPassed && dates.findIndex((d) => daysUntil(d.date) >= 0) === index;
        const countdown = isPassed
          ? "Passed"
          : days === 0
            ? "Today"
            : `${days} days`;

        return (
          <View key={item.label}>
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
                {formatDate(item.date)} · {countdown}
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
