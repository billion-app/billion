import { StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { colors, fontBody, fontSize, rd, sp, useTheme } from "~/styles";

interface ElectionBannerProps {
  daysUntil: number;
  electionName: string;
  onPress: () => void;
  onDismiss: () => void;
}

export function ElectionBanner({
  daysUntil,
  electionName,
  onPress,
  onDismiss,
}: ElectionBannerProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.accent} />
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.headline}>
            <Text style={styles.days}>{daysUntil} days</Text> until {electionName}
          </Text>
          <Text style={styles.subtext}>Know what's on your ballot</Text>
        </View>
        <TouchableOpacity style={styles.cta} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.ctaText}>See My Ballot</Text>
          <FontAwesome name="arrow-right" size={12} color={colors.black} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.dismiss} onPress={onDismiss}>
        <FontAwesome name="times" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: sp.md,
    marginBottom: sp.md,
    borderRadius: rd.md,
    overflow: "hidden",
  },
  accent: {
    width: 4,
    backgroundColor: colors.civicBlue,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: sp.md,
  },
  textContainer: {
    flex: 1,
    marginRight: sp.md,
  },
  headline: {
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.white,
    marginBottom: sp.xs,
  },
  days: {
    fontFamily: fontBody.bold,
    fontSize: fontSize.base,
  },
  subtext: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: 9999,
    gap: sp.xs,
  },
  ctaText: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.xs,
    color: colors.black,
  },
  dismiss: {
    position: "absolute",
    top: sp.sm,
    right: sp.sm,
    padding: sp.xs,
  },
});
