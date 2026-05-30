import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { ContentCard, Icon, ScreenShell } from "~/components/ui";
import { colors } from "~/styles";
import { trpc } from "~/utils/api";
import { toCardItem } from "~/utils/content";

export default function SavedArticlesScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery(trpc.user.getSaved.queryOptions());

  const list = (data ?? [])
    .filter((item): item is NonNullable<typeof item> => item != null)
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      type: item.type,
    }));

  return (
    <ScreenShell
      title="Saved"
      action={<Icon name="filter" size={20} color={colors.textSecondary} />}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Text style={s.intro}>
            {list.length} article{list.length === 1 ? "" : "s"} saved to read
            later.
          </Text>
          <View style={{ gap: 12 }}>
            {list.map((item) => (
              <ContentCard
                key={item.id}
                saved
                item={toCardItem(item)}
                onPress={() => router.push(`/article-detail?id=${item.id}`)}
              />
            ))}
          </View>
        </>
      )}
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 18,
  },
});
