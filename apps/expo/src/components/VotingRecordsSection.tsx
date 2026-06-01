import { useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import type { Jurisdiction } from "@acme/api/integrations/legistar";

import { Text, View } from "~/components/Themed";
import { fontBody, fontEditorial, fontSize, rd, sp, useTheme } from "~/styles";
import { trpc } from "~/utils/api";

interface VotingRecordsSectionProps {
  jurisdiction: Jurisdiction;
  meetingId: number;
  meetingTitle?: string;
}

function PassFailBadge({ status }: { status: string | null }) {
  const isPass = status === "Pass";
  const isFail = status === "Fail";
  const bg = isPass ? "#1B3A2D" : isFail ? "#3A1B1B" : "#2A2A3A";
  const fg = isPass ? "#4ADE80" : isFail ? "#F87171" : "#8A8FA0";
  const label = status ?? "N/A";

  return (
    <View style={[badgeStyles.badge, { backgroundColor: bg }]}>
      <Text style={[badgeStyles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    textTransform: "uppercase",
  },
});

export function VotingRecordsSection({
  jurisdiction,
  meetingId,
  meetingTitle,
}: VotingRecordsSectionProps) {
  const { theme } = useTheme();
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const itemsQuery = useQuery(
    trpc.legistar.getMeetingVotes.queryOptions({ jurisdiction, meetingId }),
  );

  const votesQuery = useQuery({
    ...trpc.legistar.getVotes.queryOptions({
      jurisdiction,
      eventItemId: expandedItem ?? 0,
    }),
    enabled: expandedItem !== null,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        {meetingTitle ?? "Voting Records"}
      </Text>

      {itemsQuery.isLoading && (
        <ActivityIndicator color={colors.civicBlue} style={styles.loader} />
      )}

      {itemsQuery.data
        ?.filter((item) => item.EventItemTitle ?? item.EventItemMatterFile)
        .map((item, index) => {
          const isExpanded = expandedItem === item.EventItemId;

          return (
            <View key={`${item.EventItemId}-${index}`}>
              <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.card }]}
                onPress={() =>
                  setExpandedItem(isExpanded ? null : item.EventItemId)
                }
                activeOpacity={0.8}
              >
                <View style={styles.cardContent}>
                  <View style={styles.meta}>
                    {item.EventItemMatterFile && (
                      <Text style={styles.file}>
                        {item.EventItemMatterFile}
                      </Text>
                    )}
                    <PassFailBadge status={item.EventItemPassedFlagName} />
                  </View>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.EventItemTitle ??
                      item.EventItemMatterName ??
                      "Untitled"}
                  </Text>
                  {item.EventItemTally && (
                    <Text style={styles.tally}>
                      Tally: {item.EventItemTally}
                    </Text>
                  )}
                </View>
                <FontAwesome
                  name={isExpanded ? "chevron-down" : "chevron-right"}
                  size={12}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View
                  style={[styles.votesPanel, { backgroundColor: theme.card }]}
                >
                  {votesQuery.isLoading && (
                    <ActivityIndicator
                      color={colors.civicBlue}
                      size="small"
                      style={{ marginVertical: sp[2] }}
                    />
                  )}
                  {votesQuery.data?.map((vote) => (
                    <View key={vote.VoteId} style={styles.voteRow}>
                      <Text style={styles.voterName}>
                        {vote.VotePersonName}
                      </Text>
                      <Text
                        style={[
                          styles.voteValue,
                          {
                            color:
                              vote.VoteValueName === "Aye"
                                ? "#4ADE80"
                                : vote.VoteValueName === "No"
                                  ? "#F87171"
                                  : colors.textMuted,
                          },
                        ]}
                      >
                        {vote.VoteValueName}
                      </Text>
                    </View>
                  ))}
                  {votesQuery.data?.length === 0 && (
                    <Text style={styles.noVotes}>
                      No individual votes recorded
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

      {itemsQuery.data?.length === 0 && (
        <Text style={styles.noData}>No voting records available</Text>
      )}
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
  loader: {
    marginVertical: sp[6],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: rd.md,
    marginBottom: sp[2],
    padding: sp[4],
  },
  cardContent: {
    flex: 1,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: sp[1],
  },
  file: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    color: colors.civicBlue,
  },
  title: {
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.white,
    marginBottom: sp[1],
  },
  tally: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  votesPanel: {
    marginBottom: sp[2],
    marginTop: -sp[1],
    borderBottomLeftRadius: rd.md,
    borderBottomRightRadius: rd.md,
    paddingHorizontal: sp[4],
    paddingVertical: sp[3],
  },
  voteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: sp[1],
  },
  voterName: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.white,
  },
  voteValue: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.xs,
  },
  noVotes: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
  noData: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginVertical: sp[6],
  },
});
