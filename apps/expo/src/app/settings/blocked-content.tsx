import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { Icon, ScreenShell } from "~/components/ui";
import { DigestHair, fontBody, DigestPalette as P } from "~/styles";
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
    <ScreenShell title="Blocked">
      {blockedQuery.isLoading ? (
        <ActivityIndicator color={P.inkOnNight} style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <Text style={s.emptyText}>Nothing blocked.</Text>
      ) : (
        <View>
          {items.map((it, i) => (
            <View
              key={it.id}
              style={[s.blockedRow, i < items.length - 1 && s.divider]}
            >
              <View style={s.tile}>
                <Icon
                  name={it.type === "source" ? "globe" : "filter"}
                  size={18}
                  color={P.spark}
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
                style={s.pill}
              >
                <Text style={s.pillText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DigestHair.cardBorder,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DigestHair.tabActivePill,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: P.inkOnNight,
  },
  type: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: P.quiet,
    marginTop: 2,
  },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: P.inkOnNight,
  },
  emptyText: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: P.quiet,
    marginTop: 12,
  },
});
