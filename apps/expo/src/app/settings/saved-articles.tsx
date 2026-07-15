import { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import { ContentCard, Icon, NavHeader } from "~/components/ui";
import { colors, hair, planes } from "~/styles";
import { queryClient, trpc } from "~/utils/api";
import { toCardItem } from "~/utils/content";

const PAGE_SIZE = 10;

interface SavedItem {
  id: string;
  title: string;
  description: string | null;
  type: "bill" | "government_content" | "court_case";
  billNumber?: string;
}

function SwipeableSavedCard({
  item,
  onPress,
  onUnsave,
}: {
  item: SavedItem;
  onPress: () => void;
  onUnsave: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      renderRightActions={() => (
        <TouchableOpacity
          style={s.unsaveAction}
          activeOpacity={0.8}
          onPress={() => {
            swipeableRef.current?.close();
            onUnsave();
          }}
        >
          <Icon name="bookmarkFill" size={20} color={colors.white} />
        </TouchableOpacity>
      )}
    >
      <ContentCard
        saved
        item={toCardItem({
          id: item.id,
          title: item.title,
          description: item.description ?? "",
          type: item.type,
          billNumber: item.billNumber,
        })}
        onPress={onPress}
      />
    </Swipeable>
  );
}

export default function SavedArticlesScreen() {
  const router = useRouter();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(
      trpc.content.saved.list.infiniteQueryOptions(
        { limit: PAGE_SIZE },
        {
          initialCursor: 0,
          getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
      ),
    );

  const list = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const removeMutation = useMutation({
    ...trpc.content.saved.remove.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.content.saved.list.infiniteQueryKey(),
      });
    },
  });

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };

  return (
    <View style={s.screen}>
      <NavHeader
        title="Saved"
        onBack={() => router.back()}
        action={<Icon name="filter" size={20} color={colors.textSecondary} />}
      />
      {isLoading ? (
        <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={s.intro}>
              {list.length} article{list.length === 1 ? "" : "s"} saved to read
              later.
            </Text>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <SwipeableSavedCard
              item={item}
              onPress={() => router.push(`/article-detail?id=${item.id}`)}
              onUnsave={() => removeMutation.mutate({ contentId: item.id })}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator
                color={colors.white}
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  intro: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  unsaveAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    marginLeft: 12,
    borderRadius: 16,
    backgroundColor: colors.red[500],
    borderWidth: 1,
    borderColor: hair[1],
  },
});
