import { StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
} from "~/styles";
interface ElectionBannerProps {
  daysUntil: number;
  electionName: string;
  onPress: () => void;
}

export function ElectionBanner({
  daysUntil,
  electionName,
  onPress,
}: ElectionBannerProps) {
  return (
    <View style={styles.container}>
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
          <FontAwesome name="arrow-right" size={12} color={DigestPalette.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: DigestSpace.screenPadX,
    marginBottom: 16,
    borderRadius: DigestRadii.card,
    overflow: "hidden",
    backgroundColor: DigestPalette.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  accent: {
    width: 4,
    backgroundColor: DigestPalette.spark,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: DigestSpace.cardBodyPadX,
  },
  textContainer: {
    flex: 1,
    marginRight: 14,
  },
  headline: {
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    color: DigestPalette.inkOnNight,
    marginBottom: 4,
  },
  days: {
    fontFamily: fontDisplay.bold,
    fontSize: 15,
    color: DigestPalette.spark,
  },
  subtext: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: DigestPalette.quiet,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DigestPalette.paper,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: DigestRadii.menuRow,
    gap: 6,
  },
  ctaText: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    color: DigestPalette.ink,
  },
});
