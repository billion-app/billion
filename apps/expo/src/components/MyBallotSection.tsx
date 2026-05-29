import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import type { Contest } from "@acme/api";

import { Text, View } from "~/components/Themed";
import { fontBody, fontEditorial, fontSize, rd, sp, useTheme } from "~/styles";
import { trpc } from "~/utils/api";

const colors = {
  white: "#FFFFFF",
  black: "#000000",
  civicBlue: "#4A7CFF",
  textMuted: "#8A8FA0",
};

interface MyBallotSectionProps {
  address: string | null;
  onAddressSubmit: (address: string) => void;
  onEditAddress: () => void;
}

export function MyBallotSection({
  address,
  onAddressSubmit,
  onEditAddress,
}: MyBallotSectionProps) {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState("");

  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: address ?? "" }),
    enabled: !!address,
  });

  if (!address) {
    return (
      <View style={[styles.container, { backgroundColor: theme.card }]}>
        <Text style={styles.sectionTitle}>My Ballot</Text>
        <Text style={styles.hint}>
          We'll show you exactly what's on your ballot
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background }]}
            placeholder="Enter your address"
            placeholderTextColor={colors.textMuted}
            value={inputValue}
            onChangeText={setInputValue}
            autoCapitalize="none"
            textContentType="fullStreetAddress"
            autoComplete="street-address"
          />
          <TouchableOpacity
            style={[styles.button, !inputValue && styles.buttonDisabled]}
            onPress={() => inputValue && onAddressSubmit(inputValue)}
            disabled={!inputValue}
          >
            <Text style={styles.buttonText}>Look Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>My Ballot</Text>
        <TouchableOpacity onPress={onEditAddress} style={styles.editButton}>
          <FontAwesome name="pencil" size={14} color={colors.civicBlue} />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.address}>{address}</Text>

      {voterInfoQuery.isLoading && (
        <ActivityIndicator color={colors.civicBlue} style={styles.loader} />
      )}

      {voterInfoQuery.data?.contests?.map((contest: Contest, index: number) => (
        <TouchableOpacity
          key={index}
          style={[styles.contestCard, { backgroundColor: theme.background }]}
        >
          <Text style={styles.contestTitle}>
            {contest.office ?? contest.referendumTitle ?? "Contest"}
          </Text>
          <Text style={styles.contestMeta}>
            {contest.candidates
              ? `${contest.candidates.length} candidates`
              : contest.referendumTitle
                ? "Ballot Measure"
                : ""}
          </Text>
          <FontAwesome
            name="chevron-right"
            size={12}
            color={colors.textMuted}
            style={styles.chevron}
          />
        </TouchableOpacity>
      ))}

      {voterInfoQuery.data?.contests?.length === 0 && (
        <Text style={styles.noData}>No ballot information available yet</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: sp[4],
    marginBottom: sp[6],
    padding: sp[4],
    borderRadius: rd.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: sp[3],
  },
  sectionTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: fontSize.lg,
    color: colors.white,
    marginBottom: sp[2],
  },
  hint: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: sp[4],
  },
  inputRow: {
    flexDirection: "row",
    gap: sp[3],
  },
  input: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.white,
    padding: sp[3],
    borderRadius: rd.sm,
  },
  button: {
    backgroundColor: colors.white,
    paddingVertical: sp[3],
    paddingHorizontal: sp[4],
    borderRadius: 9999,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: fontBody.semibold,
    fontSize: fontSize.sm,
    color: colors.black,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[2],
  },
  editText: {
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.civicBlue,
  },
  address: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: sp[4],
  },
  loader: {
    marginVertical: sp[6],
  },
  contestCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp[3],
    borderRadius: rd.sm,
    marginBottom: sp[3],
  },
  contestTitle: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  contestMeta: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginRight: sp[3],
  },
  chevron: {
    marginLeft: sp[2],
  },
  noData: {
    fontFamily: fontBody.regular,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginVertical: sp[6],
  },
});
