/**
 * HowToVoteEntryCard — the Elections-tab entry into voting logistics.
 *
 * Sits directly under the election hero, above the ballot tabs: the hero has
 * just said *which election and when*, so "how do I vote in it" is the next
 * sentence — and a voter who came only for logistics never has to scroll past
 * a single contest to find it.
 *
 * It renders in every state, including with no address, because a section that
 * silently disappears reads as a feature that doesn't exist.
 */
import { StyleSheet, TouchableOpacity, View } from "react-native";

import type { ElectionPhase, VotingPlan } from "~/utils/voting";
import { Text } from "~/components/Themed";
import { Icon } from "~/components/ui";
import { colors, fontBody, fontEditorial, hair, planes } from "~/styles";
import { entryCardSubtitle } from "~/utils/voting";

export function HowToVoteEntryCard({
  hasAddress,
  plan,
  phase,
  onPress,
}: {
  hasAddress: boolean;
  plan?: VotingPlan;
  phase: ElectionPhase;
  onPress: () => void;
}) {
  const subtitle = entryCardSubtitle(hasAddress, plan, phase);
  const isElectionDay = phase === "electionDay";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`How to Vote. ${subtitle}`}
    >
      <View style={[s.card, isElectionDay && s.cardToday]}>
        <View style={s.iconTile}>
          <Icon
            name={isElectionDay ? "flag" : "vote"}
            size={21}
            color={
              isElectionDay
                ? colors.green[500]
                : hasAddress
                  ? colors.bill
                  : colors.textSecondary
            }
          />
        </View>
        <View style={s.body}>
          <Text style={s.title}>How to Vote</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
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
  },
  cardToday: { borderColor: "rgba(16,185,129,0.34)" },
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
