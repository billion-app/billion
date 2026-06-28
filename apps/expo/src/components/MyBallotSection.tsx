import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import { Text, View } from "~/components/Themed";
import { fontBody, fontEditorial, fontSize, rd, sp, useTheme } from "~/styles";

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
  /** Navigate to the full ballot (main Your Ballot tab). */
  onViewBallot?: () => void;
}

/**
 * Address card for the civic hub. Captures / displays the registered address
 * and links out to the full ballot — it deliberately does NOT re-list the
 * contests, which live on the main "Your Ballot" tab. This screen is for
 * voting logistics, not a second copy of the ballot.
 */
export function MyBallotSection({
  address,
  onAddressSubmit,
  onEditAddress,
  onViewBallot,
}: MyBallotSectionProps) {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState("");

  if (!address) {
    return (
      <View style={[styles.container, { backgroundColor: theme.card }]}>
        <Text style={styles.sectionTitle}>Your Address</Text>
        <Text style={styles.hint}>
          We'll show your polling place, key dates, and who represents you
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
        <Text style={styles.sectionTitle}>Your Address</Text>
        <TouchableOpacity onPress={onEditAddress} style={styles.editButton}>
          <FontAwesome name="pencil" size={14} color={colors.civicBlue} />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.address}>{address}</Text>

      {onViewBallot && (
        <TouchableOpacity
          style={[styles.ballotLink, { backgroundColor: theme.background }]}
          onPress={onViewBallot}
          activeOpacity={0.8}
        >
          <FontAwesome
            name="check-square-o"
            size={15}
            color={colors.civicBlue}
          />
          <Text style={styles.ballotLinkText}>View your full ballot</Text>
          <FontAwesome
            name="chevron-right"
            size={12}
            color={colors.textMuted}
          />
        </TouchableOpacity>
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
  },
  ballotLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[3],
    padding: sp[3],
    borderRadius: rd.sm,
    marginTop: sp[4],
  },
  ballotLinkText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: fontSize.sm,
    color: colors.white,
  },
});
