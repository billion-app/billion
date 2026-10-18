import { StyleSheet } from "react-native";

import { Text, View } from "~/components/Themed";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { DigestPalette, DigestSpace, fontBody } from "~/styles";
import { daysUntil, formatDate } from "~/utils/dates";

interface KeyDatesSectionProps {
  /** Civic `election.electionDay` (ISO date). */
  electionDate: string;
}

export function KeyDatesSection({ electionDate }: KeyDatesSectionProps) {
  const { locale, t } = useAppTranslation();
  const days = daysUntil(electionDate);
  const countdown =
    days < 0
      ? t("elections.keyDates.passed")
      : days === 0
        ? t("common.today")
        : t("elections.keyDates.days", { count: days });

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>{t("elections.keyDates.calendar")}</Text>
      <View style={styles.row}>
        <Text style={styles.label}>{t("elections.electionDay")}</Text>
        <Text style={styles.value}>
          {formatDate(electionDate, locale)} · {countdown}
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
