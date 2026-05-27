import { StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
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
  raceGroup: {
    marginBottom: sp.md,
  },
  raceTitle: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: sp.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  candidateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp.sm,
    borderRadius: rd.md,
    marginBottom: sp.xs,
  },
  photo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: sp.sm,
  },
  photoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: sp.sm,
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
