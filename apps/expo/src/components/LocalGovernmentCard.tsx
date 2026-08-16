/**
 * LocalGovernmentCard — the Browse-tab entry into city and county activity.
 *
 * Lives under the jurisdiction row, where the reader is already being asked
 * "which government am I looking at". Local government is the same question
 * one level down, which is why this sits in Browse rather than on the
 * Elections tab: council meetings aren't voting.
 *
 * The possessive is earned. "Your Local Government" only when the reader's
 * address is inside a jurisdiction Billion covers; otherwise it names the
 * scope, because the underlying feed serves Bay Area content to everyone.
 */
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { colors, fontBody, fontEditorial, hair, planes } from "~/styles";
import { coverageSummary, coveredJurisdiction } from "~/utils/local-government";

export function LocalGovernmentCard({
  address,
  onPress,
}: {
  address: string | null;
  onPress: () => void;
}) {
  const covered = coveredJurisdiction(address);
  const title = covered ? "Your Local Government" : "Local Government";
  const subtitle = covered
    ? `${covered.name} · bills and upcoming meetings`
    : coverageSummary();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={s.card}>
        <View style={s.iconTile}>
          <Icon
            name="home"
            size={21}
            color={covered ? colors.bill : colors.textSecondary}
          />
        </View>
        <View style={s.body}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Icon name="chevR" size={16} color="#5B6172" />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 16,
    minHeight: 60,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 16,
    marginBottom: 16,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    color: colors.white,
  },
  subtitle: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
