import { StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import type { Contest } from "@acme/api";

import { Text, View } from "~/components/Themed";
import { fontBody, fontEditorial, fontSize, rd, sp, useTheme } from "~/styles";

interface BallotMeasuresSectionProps {
  measures: Contest[];
  onMeasurePress?: (measure: Contest) => void;
}

export function BallotMeasuresSection({
  measures,
  onMeasurePress,
}: BallotMeasuresSectionProps) {
  const { theme } = useTheme();

  if (measures.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ballot Measures</Text>
      {measures.map((measure, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.card, { backgroundColor: theme.card }]}
          onPress={() => onMeasurePress?.(measure)}
          activeOpacity={0.8}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MEASURE</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {measure.referendumTitle ?? "Ballot Measure"}
          </Text>
          {measure.referendumSubtitle && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {measure.referendumSubtitle}
            </Text>
          )}
          {(measure.referendumProStatement ??
            measure.referendumConStatement) && (
            <View style={styles.arguments}>
              {measure.referendumProStatement && (
                <Text style={styles.argument} numberOfLines={1}>
                  <Text style={styles.argumentLabel}>Yes: </Text>
                  {measure.referendumProStatement}
                </Text>
              )}
              {measure.referendumConStatement && (
                <Text style={styles.argument} numberOfLines={1}>
                  <Text style={styles.argumentLabel}>No: </Text>
                  {measure.referendumConStatement}
                </Text>
              )}
            </View>
          )}
          <FontAwesome
            name="chevron-right"
            size={14}
            color={colors.textMuted}
            style={styles.chevron}
          />
        </TouchableOpacity>
      ))}
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
    marginHorizontal: sp[4],
    marginBottom: sp[6],
  },
  sectionTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: fontSize.lg,
    color: colors.white,
    marginBottom: sp[3],
  },
  card: {
    padding: sp[4],
    borderRadius: rd.md,
    marginBottom: sp[3],
  },
  badge: {
    backgroundColor: colors.civicBlue,
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: sp[3],
    borderRadius: 4,
    marginBottom: sp[3],
  },
  badgeText: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    color: colors.white,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.base,
    color: colors.white,
    marginBottom: sp[2],
  },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: sp[3],
  },
  arguments: {
    marginTop: sp[2],
  },
  argument: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  argumentLabel: {
    fontFamily: fontBody.semibold,
    color: colors.white,
  },
  chevron: {
    position: "absolute",
    right: sp[4],
    top: "50%",
  },
});
