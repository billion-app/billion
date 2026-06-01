import { ScrollView, StyleSheet } from "react-native";

import { Text, View } from "~/components/Themed";
import { fontBody, fontEditorial, fontSize, rd, sp, useTheme } from "~/styles";
import { daysUntil, formatDate } from "~/utils/dates";

interface KeyDate {
  label: string;
  date: string;
}

interface KeyDatesSectionProps {
  electionDate: string;
}

export function KeyDatesSection({ electionDate }: KeyDatesSectionProps) {
  const { theme } = useTheme();

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
              style={[
                styles.card,
                { backgroundColor: theme.card },
                isNext && styles.cardHighlight,
              ]}
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

const colors = {
  white: "#FFFFFF",
  civicBlue: "#4A7CFF",
  textMuted: "#8A8FA0",
};

const styles = StyleSheet.create({
  container: {
    marginBottom: sp[6],
  },
  sectionTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: fontSize.lg,
    color: colors.white,
    marginHorizontal: sp[4],
    marginBottom: sp[3],
  },
  scrollContent: {
    paddingHorizontal: sp[4],
    gap: sp[3],
  },
  card: {
    padding: sp[4],
    borderRadius: rd.md,
    minWidth: 140,
  },
  cardHighlight: {
    borderWidth: 2,
    borderColor: colors.civicBlue,
  },
  label: {
    fontFamily: fontBody.medium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: sp[2],
  },
  date: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.sm,
    color: colors.white,
    marginBottom: sp[2],
  },
  countdown: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  countdownHighlight: {
    color: colors.civicBlue,
    fontFamily: fontBody.semibold,
  },
  textMuted: {
    color: colors.textMuted,
    opacity: 0.6,
  },
});
