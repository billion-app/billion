import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "~/components/Themed";
import { Card, Icon, ScreenShell } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";

interface BlockedItem {
  id: number;
  name: string;
  type: "Source" | "Topic";
  blocked: boolean;
}

// TODO(backend): real blocked sources/topics per user.
const SEED: BlockedItem[] = [
  { id: 1, name: "PartisanPost.com", type: "Source", blocked: true },
  { id: 2, name: "Gun policy", type: "Topic", blocked: true },
  { id: 3, name: "DailyOutrage", type: "Source", blocked: true },
];

export default function BlockedContentScreen() {
  const [items, setItems] = useState<BlockedItem[]>(SEED);
  const toggle = (id: number) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, blocked: !i.blocked } : i)),
    );

  return (
    <ScreenShell title="Blocked Content">
      <Text style={s.intro}>
        Hidden from your feed and search. Unblock anything — we&apos;ll keep it
        out until you change your mind.
      </Text>

      <View style={{ gap: 10 }}>
        {items.map((it) => (
          <Card
            key={it.id}
            style={[s.blockedCard, { opacity: it.blocked ? 1 : 0.5 }]}
          >
            <View style={s.tile}>
              <Icon
                name={it.type === "Source" ? "globe" : "filter"}
                size={18}
                color={colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{it.name}</Text>
              <Text style={s.type}>
                {it.type}
                {!it.blocked && " · restored"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => toggle(it.id)}
              activeOpacity={0.8}
              style={[
                s.pill,
                it.blocked
                  ? { borderColor: hair[2] }
                  : { backgroundColor: colors.white, borderColor: colors.white },
              ]}
            >
              {it.blocked ? (
                <Text style={s.pillText}>Unblock</Text>
              ) : (
                <View style={s.undoRow}>
                  <Icon name="undo" size={14} color={planes.ink} />
                  <Text style={[s.pillText, { color: planes.ink }]}>Undo</Text>
                </View>
              )}
            </TouchableOpacity>
          </Card>
        ))}
      </View>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 21,
  },
  blockedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 14,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fontBody.semibold, fontSize: 15, color: colors.white },
  type: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
  },
  pill: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  undoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
});
