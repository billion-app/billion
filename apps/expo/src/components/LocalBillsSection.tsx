import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { legistar, type LegistarMatter } from "@acme/api";

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

interface LocalBillsSectionProps {
  onBillPress?: (bill: LegistarMatter) => void;
}

export function LocalBillsSection({ onBillPress }: LocalBillsSectionProps) {
  const { theme } = useTheme();

  const billsQuery = useQuery({
    queryKey: ["localBills"],
    queryFn: async () => {
      const [sanjose, santaclara] = await Promise.all([
        legistar.getLegislation("sanjose", {}).catch(() => []),
        legistar.getLegislation("santaclara", {}).catch(() => []),
      ]);

      const allBills = [
        ...sanjose.map((b) => ({ ...b, jurisdiction: "San Jose" })),
        ...santaclara.map((b) => ({ ...b, jurisdiction: "Santa Clara County" })),
      ];

      return allBills
        .sort(
          (a, b) =>
            new Date(b.MatterLastModifiedUtc).getTime() -
            new Date(a.MatterLastModifiedUtc).getTime(),
        )
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Local Bills</Text>

      {billsQuery.isLoading && (
        <ActivityIndicator color={colors.civicBlue} style={styles.loader} />
      )}

      {billsQuery.data?.map((bill, index) => (
        <TouchableOpacity
          key={`${bill.MatterId}-${index}`}
          style={[styles.card, { backgroundColor: theme.card }]}
          onPress={() => onBillPress?.(bill as LegistarMatter)}
          activeOpacity={0.8}
        >
          <View style={styles.cardAccent} />
          <View style={styles.cardContent}>
            <View style={styles.meta}>
              <Text style={styles.jurisdiction}>
                {(bill as LegistarMatter & { jurisdiction: string }).jurisdiction}
              </Text>
              <Text style={styles.status}>{bill.MatterStatusName}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {bill.MatterTitle}
            </Text>
            <Text style={styles.file}>{bill.MatterFile}</Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color={colors.textMuted} />
        </TouchableOpacity>
      ))}

      {billsQuery.data?.length === 0 && (
        <Text style={styles.noData}>No recent local legislation</Text>
      )}
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
  loader: {
    marginVertical: sp.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: rd.md,
    marginBottom: sp.sm,
    overflow: "hidden",
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
    backgroundColor: colors.civicBlue,
  },
  cardContent: {
    flex: 1,
    padding: sp.md,
  },
  meta: {
    flexDirection: "row",
    gap: sp.sm,
    marginBottom: sp.xs,
  },
  jurisdiction: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    color: colors.civicBlue,
    textTransform: "uppercase",
  },
  status: {
    fontFamily: fontBody.regular,
    fontSize: 10,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.white,
    marginBottom: sp.xs,
  },
  file: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  noData: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginVertical: sp.lg,
  },
});
