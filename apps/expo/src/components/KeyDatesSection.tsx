/**
 * KeyDatesSection — the election date, and only the election date.
 *
 * This section previously rendered three cards: "Registration Deadline" at
 * electionDay-15 and "Early Voting Starts" at electionDay-29, alongside the
 * real Election Day. Both were pure offset arithmetic — no source, no hedging,
 * and styled identically to the date we actually get from Google Civic. Those
 * offsets approximate one California cycle and are wrong for most jurisdictions
 * and most years, so they've been removed rather than relabelled.
 *
 * Voting deadlines belong on the How to Vote screen, which shows an explicit
 * "not published" state when Billion has no sourced date.
 */
import { StyleSheet } from "react-native";

import { Text, View } from "~/components/Themed";
import {
  colors,
  fontBody,
  fontEditorial,
  fontSize,
  rd,
  sp,
  useTheme,
} from "~/styles";
import { daysUntil, formatDate } from "~/utils/dates";

interface KeyDatesSectionProps {
  electionDate: string;
}

export function KeyDatesSection({ electionDate }: KeyDatesSectionProps) {
  const { theme } = useTheme();
  const days = daysUntil(electionDate);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Election Day</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={styles.date}>{formatDate(electionDate)}</Text>
        <Text style={styles.countdown}>
          {days < 0
            ? "Voting has closed"
            : days === 0
              ? "Today"
              : `in ${days} day${days === 1 ? "" : "s"}`}
        </Text>
      </View>
    </View>
  );
}

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
  card: {
    marginHorizontal: sp[4],
    padding: sp[4],
    borderRadius: rd.md,
  },
  date: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  countdown: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: sp[1],
  },
});
