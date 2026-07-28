import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "@acme/api";

import { Text, View } from "~/components/Themed";
import { fontBody, fontEditorial, fontSize, rd, sp, useTheme } from "~/styles";
import { trpc } from "~/utils/api";

type Meeting = RouterOutputs["localGovernment"]["listMeetings"][number];

interface UpcomingMeetingsSectionProps {
  onMeetingPress?: (meeting: Meeting) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function UpcomingMeetingsSection({
  onMeetingPress,
}: UpcomingMeetingsSectionProps) {
  const { theme } = useTheme();

  const meetingsQuery = useQuery(
    trpc.localGovernment.listMeetings.queryOptions({ daysAhead: 90 }),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Upcoming Meetings</Text>

      {meetingsQuery.isLoading && (
        <ActivityIndicator color={colors.civicBlue} style={styles.loader} />
      )}

      {meetingsQuery.data?.slice(0, 8).map((meeting, index) => (
        <TouchableOpacity
          key={`${meeting.source}-${meeting.externalId}-${index}`}
          style={[styles.card, { backgroundColor: theme.card }]}
          onPress={() =>
            onMeetingPress
              ? onMeetingPress(meeting)
              : void Linking.openURL(meeting.canonicalUrl)
          }
          activeOpacity={0.8}
        >
          <View style={styles.cardAccent} />
          <View style={styles.cardContent}>
            <View style={styles.meta}>
              <Text style={styles.jurisdiction}>{meeting.jurisdiction}</Text>
              <Text style={styles.date}>
                {formatDate(meeting.startsAt.toString())}
              </Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {meeting.isCancelled ? "Cancelled: " : ""}
              {meeting.title}
            </Text>
            {meeting.location && (
              <Text style={styles.location} numberOfLines={1}>
                {meeting.location}
              </Text>
            )}
            <View style={styles.icons}>
              {meeting.documents.find(
                (document) => document.type === "agenda",
              ) && (
                <TouchableOpacity
                  onPress={() =>
                    void Linking.openURL(
                      meeting.documents.find(
                        (document) => document.type === "agenda",
                      )?.url ?? "",
                    )
                  }
                  hitSlop={8}
                >
                  <FontAwesome
                    name="file-text-o"
                    size={14}
                    color={colors.civicBlue}
                  />
                </TouchableOpacity>
              )}
              {meeting.videoUrl && (
                <TouchableOpacity
                  onPress={() => void Linking.openURL(meeting.videoUrl ?? "")}
                  hitSlop={8}
                >
                  <FontAwesome
                    name="video-camera"
                    size={14}
                    color={colors.civicBlue}
                  />
                </TouchableOpacity>
              )}
              {meeting.documents.find(
                (document) => document.type === "minutes",
              ) && (
                <TouchableOpacity
                  onPress={() =>
                    void Linking.openURL(
                      meeting.documents.find(
                        (document) => document.type === "minutes",
                      )?.url ?? "",
                    )
                  }
                  hitSlop={8}
                >
                  <FontAwesome
                    name="file-o"
                    size={14}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <FontAwesome
            name="chevron-right"
            size={12}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      ))}

      {meetingsQuery.data?.length === 0 && (
        <Text style={styles.noData}>No upcoming meetings</Text>
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
    marginBottom: sp[3],
    overflow: "hidden",
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
    backgroundColor: colors.civicBlue,
  },
  cardContent: {
    flex: 1,
    padding: sp[4],
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: sp[2],
  },
  jurisdiction: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    color: colors.civicBlue,
    textTransform: "uppercase",
  },
  date: {
    fontFamily: fontBody.medium,
    fontSize: 10,
    color: colors.civicBlue,
  },
  title: {
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.white,
    marginBottom: sp[1],
  },
  location: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: sp[2],
  },
  icons: {
    flexDirection: "row",
    gap: sp[3],
  },
  noData: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginVertical: sp[6],
  },
});
