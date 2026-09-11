import { ScrollView, StyleSheet } from "react-native";

import { Text, View } from "~/components/Themed";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
} from "~/styles";
import { daysUntil, formatDate } from "~/utils/dates";

interface KeyDate {
  label: string;
  date: string;
}

interface KeyDatesSectionProps {
  electionDate: string;
}

export function KeyDatesSection({ electionDate }: KeyDatesSectionProps) {
  const electionDateObj = new Date(electionDate);
  const registrationDeadline = new Date(electionDateObj);
  registrationDeadline.setDate(registrationDeadline.getDate() - 15);

  const earlyVotingStart = new Date(electionDateObj);
  earlyVotingStart.setDate(earlyVotingStart.getDate() - 29);

  const dates: KeyDate[] = [
    {
      label: "Registration Deadline",
      date: registrationDeadline.toISOString().split("T")[0] ?? "",
    },
    {
      label: "Early Voting Starts",
      date: earlyVotingStart.toISOString().split("T")[0] ?? "",
    },
    {
      label: "Election Day",
      date: electionDate,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>CALENDAR</Text>
      <Text style={styles.sectionTitle}>Key Dates</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {dates.map((item, index) => {
          const days = daysUntil(item.date);
          const isPassed = days < 0;
          const isNext =
            !isPassed &&
            dates.findIndex((d) => daysUntil(d.date) >= 0) === index;

          return (
            <View
              key={item.label}
              style={[styles.card, isNext && styles.cardHighlight]}
            >
              <Text style={[styles.label, isPassed && styles.textMuted]}>
                {item.label}
              </Text>
              <Text style={[styles.date, isPassed && styles.textMuted]}>
                {formatDate(item.date)}
              </Text>
              <Text
                style={[
                  styles.countdown,
                  isPassed && styles.textMuted,
                  isNext && styles.countdownHighlight,
                ]}
              >
                {isPassed
                  ? "Passed"
                  : days === 0
                    ? "Today!"
                    : `in ${days} days`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    marginHorizontal: DigestSpace.screenPadX,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    letterSpacing: -0.45,
    color: DigestPalette.inkOnNight,
    marginHorizontal: DigestSpace.screenPadX,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: DigestSpace.screenPadX,
    gap: DigestSpace.railGap,
    alignItems: "flex-start",
  },
  card: {
    padding: DigestSpace.cardBodyPadX,
    borderRadius: DigestRadii.card,
    minWidth: 140,
    backgroundColor: DigestPalette.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  cardHighlight: {
    borderWidth: 1,
    borderColor: DigestHair.coverBorder,
    backgroundColor: DigestHair.tabActivePill,
  },
  label: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: DigestPalette.quiet,
    marginBottom: 6,
  },
  date: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: DigestPalette.inkOnNight,
    marginBottom: 6,
  },
  countdown: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: DigestPalette.quiet,
  },
  countdownHighlight: {
    color: DigestPalette.spark,
    fontFamily: fontBody.semibold,
  },
  textMuted: {
    color: DigestPalette.quiet,
    opacity: 0.6,
  },
});
