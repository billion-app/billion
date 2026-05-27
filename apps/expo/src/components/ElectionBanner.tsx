import { StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { fontBody, fontSize, rd, sp, useTheme } from "~/styles";

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
            <Text style={styles.days}>{daysUntil} days</Text> until{" "}
            {electionName}
          </Text>
          <Text style={styles.subtext}>Know what's on your ballot</Text>
        </View>
        <TouchableOpacity
          style={styles.cta}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>See My Ballot</Text>
          <FontAwesome name="arrow-right" size={12} color={colors.black} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.dismiss} onPress={onDismiss}>
        <FontAwesome name="times" size={16} color="#8A8FA0" />
      </TouchableOpacity>
    </View>
  );
}

const colors = {
  white: "#FFFFFF",
  black: "#000000",
  civicBlue: "#4A7CFF",
  textMuted: "#8A8FA0",
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: sp[4],
    marginBottom: sp[4],
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
    padding: sp[4],
  },
  textContainer: {
    flex: 1,
    marginRight: sp[4],
  },
  headline: {
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.white,
    marginBottom: sp[2],
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
    paddingVertical: sp[3],
    paddingHorizontal: sp[4],
    borderRadius: 9999,
    gap: sp[2],
  },
  ctaText: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.xs,
    color: colors.black,
  },
  dismiss: {
    position: "absolute",
    top: sp[3],
    right: sp[3],
    padding: sp[2],
  },
});
