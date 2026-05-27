import { StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import type { Contest } from "@acme/api";

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
          {(measure.referendumProStatement ?? measure.referendumConStatement) && (
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

const styles = StyleSheet.create({
  container: {
    marginHorizontal: sp.md,
    marginBottom: sp.lg,
  },
  sectionTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: fontSize.lg,
    color: colors.white,
    marginBottom: sp.sm,
  },
  card: {
    padding: sp.md,
    borderRadius: rd.md,
    marginBottom: sp.sm,
  },
  badge: {
    backgroundColor: colors.civicBlue,
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: sp.sm,
    borderRadius: rd.xs,
    marginBottom: sp.sm,
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
    marginBottom: sp.xs,
  },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: sp.sm,
  },
  arguments: {
    marginTop: sp.xs,
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
    right: sp.md,
    top: "50%",
  },
});
