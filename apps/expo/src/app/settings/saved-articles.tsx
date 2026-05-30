import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { ContentCard, Icon, ScreenShell } from "~/components/ui";
import { colors } from "~/styles";
import { trpc } from "~/utils/api";
import type { ContentItem } from "~/utils/content";
import { toCardItem } from "~/utils/content";

// TODO(backend): real saved-articles list per user. For now we show a sample
// drawn from live content so the screen is representative.
export default function SavedArticlesScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery(
    trpc.content.getByType.queryOptions({ type: "all" }),
  );

  const list = useMemo<ContentItem[]>(
    () => ((data as ContentItem[] | undefined) ?? []).slice(0, 3),
    [data],
  );

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
