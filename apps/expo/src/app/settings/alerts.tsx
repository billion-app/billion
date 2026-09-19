import type { Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import type { AlertItem } from "~/utils/alert-history";
import { GoldBillionMark } from "~/components/GoldBillionMark";
import { NavHeader } from "~/components/ui";
import { useAlertHistory } from "~/hooks/useAlertHistory";
import {
  DigestHair,
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
import { formatAlertTime, groupAlertsByDay } from "~/utils/alert-history";

export default function AlertsScreen() {
  const router = useRouter();
  const { items } = useAlertHistory();
  const groups = groupAlertsByDay(items, new Date());

  return (
    <View style={s.screen}>
      <NavHeader title="Your alerts" onBack={() => router.back()} large />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {groups.length === 0 ? (
          <View>
            <Text style={s.emptyTitle}>Nothing yet.</Text>
            <Text style={s.emptySub}>
              When something you follow moves, it lands here.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={s.day}>
              <Text style={s.dayLabel}>{group.label}</Text>
              {group.items.map((item, i) => (
                <AlertRow
                  key={item.id}
                  item={item}
                  last={i === group.items.length - 1}
                  onPress={() => {
                    if (item.href) router.push(item.href as Href);
                  }}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function AlertRow({
  item,
  last,
  onPress,
}: {
  item: AlertItem;
  last: boolean;
  onPress: () => void;
}) {
  const at = new Date(item.at);
  const time = Number.isNaN(at.getTime()) ? "" : formatAlertTime(at);
  const pressable = Boolean(item.href);

  return (
    <Pressable
      onPress={pressable ? onPress : undefined}
      disabled={!pressable}
      style={[s.row, !last && s.divider]}
      accessibilityRole={pressable ? "button" : "text"}
      accessibilityLabel={`${time}. ${item.title}. ${item.body}`}
    >
      <View style={s.mark}>
        <GoldBillionMark size={14} />
      </View>
      <View style={s.body}>
        {time ? <Text style={s.time}>{time}</Text> : null}
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.dek}>{item.body}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingTop: 8,
    paddingBottom: 48,
  },
  emptyTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: P.inkOnNight,
    paddingHorizontal: 4,
  },
  emptySub: {
    marginTop: 8,
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 22,
    color: P.quiet,
    paddingHorizontal: 4,
  },
  day: { marginBottom: 28 },
  dayLabel: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    letterSpacing: 2.2,
    color: P.spark,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 16,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: P.night,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  time: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: P.quiet,
  },
  title: {
    marginTop: 3,
    fontFamily: fontBody.semibold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: P.inkOnNight,
  },
  dek: {
    marginTop: 3,
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: P.quiet,
  },
});
