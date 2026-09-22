/**
 * KeyDatesSection — the election date, and only the election date.
 *
 * This section previously rendered a "Register by" row computed as
 * electionDay-15, alongside the real Election Day. That was pure offset
 * arithmetic — no source, no hedging, and styled identically to the date we
 * actually get from Google Civic. The offset approximates one California
 * cycle and is wrong for most jurisdictions and most years, so it has been
 * removed rather than relabelled. The optional `earlyVoteStart` row was also
 * dropped: without per-jurisdiction sourcing it invited the same treatment.
 *
 * Voting deadlines belong on the How to Vote screen (#272), which shows an
 * explicit "not published" state when Billion has no sourced date.
 */
import { StyleSheet } from "react-native";

import { Text, View } from "~/components/Themed";
import { DigestPalette, DigestSpace, fontBody } from "~/styles";
import { daysUntil, formatDate } from "~/utils/dates";

interface KeyDatesSectionProps {
  /** Civic `election.electionDay` (ISO date). */
  electionDate: string;
}

export function KeyDatesSection({ electionDate }: KeyDatesSectionProps) {
  const days = daysUntil(electionDate);
  const countdown =
    days < 0 ? "Passed" : days === 0 ? "Today" : `${days} days`;

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Calendar</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Election Day</Text>
        <Text style={styles.value}>
          {formatDate(electionDate)} · {countdown}
        </Text>
      </View>
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
});
