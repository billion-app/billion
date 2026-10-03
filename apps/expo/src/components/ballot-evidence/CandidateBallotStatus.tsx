import { StyleSheet, View } from "react-native";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui/Icon";
import { fontBody, DigestPalette as P } from "~/styles";
import { candidateStatusLabel } from "./election-status";

export function CandidateBallotStatus({
  status,
  inStatementGuide = false,
  compact = false,
}: {
  status?: string;
  inStatementGuide?: boolean;
  compact?: boolean;
}) {
  const withdrawn = status === "withdrewStillOnBallot";
  const icon = withdrawn
    ? "minusCircle"
    : status === "onBallot"
      ? "doc"
      : inStatementGuide
        ? "book"
        : "help";

  return (
    <View style={[s.container, compact && s.compact]}>
      <View style={s.row}>
        <View
          style={s.icon}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name={icon} size={16} color={P.quiet} />
        </View>
        <Text style={[s.label, compact && s.compactLabel]}>
          {withdrawn
            ? "Withdrawn"
            : candidateStatusLabel(status, inStatementGuide)}
        </Text>
      </View>
      {withdrawn && (
        <Text style={s.detail}>Name remains listed by the ballot source.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 3 },
  compact: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  icon: { paddingTop: 1 },
  label: {
    flex: 1,
    color: P.inkOnNight,
    fontFamily: fontBody.semibold,
    fontSize: 13,
    lineHeight: 19,
  },
  compactLabel: { fontSize: 12, lineHeight: 18 },
  detail: {
    marginLeft: 23,
    color: P.quiet,
    fontFamily: fontBody.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});
