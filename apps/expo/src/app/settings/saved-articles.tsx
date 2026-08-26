import { useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { ContentItem } from "~/utils/content";
import { Text } from "~/components/Themed";
import { ContentCard, Icon, NavHeader } from "~/components/ui";
import { useSavedContent } from "~/hooks/useSavedContent";
import { colors, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";
import { toCardItem } from "~/utils/content";

function SwipeableSavedCard({
  item,
  onPress,
  onUnsave,
}: {
  item: ContentItem;
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
          accessibilityRole="button"
          accessibilityLabel="Remove from saved"
        >
          <Icon name="bookmarkFill" size={20} color={colors.white} />
        </TouchableOpacity>
      )}
    >
      <ContentCard
        saved
        item={toCardItem(item, { showJurisdiction: true })}
        onPress={onPress}
      />
    </Swipeable>
  );
}

export default function SavedArticlesScreen() {
  const router = useRouter();
  const { savedIds, toggleSave } = useSavedContent();

  // The saved set lives on the device, so the screen arrives holding ids and
  // has to turn them into something renderable. Order is save order, newest
  // first, and the server returns them in the order it was asked for.
  const { data, isLoading } = useQuery({
    ...trpc.content.byIds.queryOptions({ ids: savedIds }),
    enabled: savedIds.length > 0,
  });

  const list = data?.items ?? [];

  return (
    <View style={s.screen}>
      <NavHeader title="Saved" onBack={() => router.back()} />
      {isLoading && savedIds.length > 0 ? (
        <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            list.length > 0 ? (
              <Text style={s.intro}>{list.length} saved to read later.</Text>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <SwipeableSavedCard
              item={item}
              onPress={() => router.push(`/article-detail?id=${item.id}`)}
              onUnsave={() =>
                toggleSave({
                  id: item.id,
                  type: item.type,
                  title: item.title,
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="bookmark" size={26} color={colors.textSecondary} />
              <Text style={s.emptyTitle}>Nothing saved yet</Text>
              <Text style={s.emptySub}>
                Tap the bookmark on anything you want to come back to. Saved
                items stay on this device — no account needed.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  content: { paddingHorizontal: 20, paddingBottom: 48, flexGrow: 1 },
  intro: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  emptyTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 19,
    color: colors.white,
  },
  emptySub: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: colors.textSecondary,
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
