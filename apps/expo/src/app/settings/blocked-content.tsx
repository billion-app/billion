import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { Card, Icon, ScreenShell } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { queryClient, trpc } from "~/utils/api";

export default function BlockedContentScreen() {
  const blockedQuery = useQuery(trpc.user.getBlocked.queryOptions());
  const items = blockedQuery.data ?? [];

  const removeMutation = useMutation({
    ...trpc.user.removeBlocked.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.user.getBlocked.queryKey(),
      });
    },
  });

  return (
    <ScreenShell title="Blocked Content">
      <Text style={s.intro}>
        Hidden from your feed and search. Unblock anything — we&apos;ll keep it
        out until you change your mind.
      </Text>

      {blockedQuery.isLoading ? (
        <ActivityIndicator color={colors.white} style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <Card>
          <Text style={s.emptyText}>No blocked content yet.</Text>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((it) => (
            <Card key={it.id} style={s.blockedCard}>
              <View style={s.tile}>
                <Icon
                  name={it.type === "source" ? "globe" : "filter"}
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{it.name}</Text>
                <Text style={s.type}>
                  {it.type === "source" ? "Source" : "Topic"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeMutation.mutate({ id: it.id })}
                activeOpacity={0.8}
                style={[s.pill, { borderColor: hair[2] }]}
              >
                <Text style={s.pillText}>Unblock</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      )}
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
  emptyText: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
