import { StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { FontAwesome } from "@expo/vector-icons";

import type { Contest } from "@acme/api";

import { Text, View } from "~/components/Themed";
import { fontBody, fontEditorial, fontSize, rd, sp, useTheme } from "~/styles";

interface CandidatesSectionProps {
  contests: Contest[];
  onCandidatePress?: (contest: Contest, candidateIndex: number) => void;
}

export function CandidatesSection({
  contests,
  onCandidatePress,
}: CandidatesSectionProps) {
  const { theme } = useTheme();

  const candidateContests = contests.filter(
    (c) => c.candidates && c.candidates.length > 0,
  );

  if (candidateContests.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Candidates</Text>
      {candidateContests.map((contest, contestIndex) => (
        <View key={contestIndex} style={styles.raceGroup}>
          <Text style={styles.raceTitle}>{contest.office ?? "Race"}</Text>
          {contest.candidates?.map((candidate, candidateIndex) => (
            <TouchableOpacity
              key={candidateIndex}
              style={[styles.candidateCard, { backgroundColor: theme.card }]}
              onPress={() => onCandidatePress?.(contest, candidateIndex)}
              activeOpacity={0.8}
            >
              {candidate.photoUrl ? (
                <Image
                  source={{ uri: candidate.photoUrl }}
                  style={styles.photo}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.photoPlaceholder,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <FontAwesome name="user" size={20} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.candidateInfo}>
                <Text style={styles.candidateName}>{candidate.name}</Text>
                {candidate.party && (
                  <Text style={styles.candidateParty}>{candidate.party}</Text>
                )}
              </View>
              <FontAwesome
                name="chevron-right"
                size={12}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const colors = {
  white: "#FFFFFF",
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
  raceGroup: {
    marginBottom: sp[4],
  },
  raceTitle: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: sp[3],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  candidateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp[3],
    borderRadius: rd.md,
    marginBottom: sp[2],
  },
  photo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: sp[3],
  },
  photoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: sp[3],
    justifyContent: "center",
    alignItems: "center",
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  candidateParty: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
