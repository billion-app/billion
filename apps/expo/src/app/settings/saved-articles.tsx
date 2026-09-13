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
import { EmptySearchMark } from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import { ContentCard, NavHeader } from "~/components/ui";
import { useSavedContent } from "~/hooks/useSavedContent";
import {
  DigestHair,
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";
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
          accessibilityLabel="Stop following"
        >
          <Text style={s.unsaveText}>Remove</Text>
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

  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.content.byIds.queryOptions({ ids: savedIds }),
    enabled: savedIds.length > 0,
  });

  const list = data?.items ?? [];

  return (
    <View style={s.screen}>
      <NavHeader title="Following" onBack={() => router.back()} />
      {isLoading && savedIds.length > 0 ? (
        <ActivityIndicator color={P.inkOnNight} style={{ marginTop: 40 }} />
      ) : error && savedIds.length > 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Didn’t load</Text>
          <Text style={s.emptySub}>
            Followed records are still on this device.
          </Text>
          <TouchableOpacity
            style={s.retry}
            onPress={() => void refetch()}
            accessibilityRole="button"
          >
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            list.length > 0 ? (
              <Text style={s.intro}>{list.length} followed</Text>
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: DigestHair.sectionRule,
              }}
            />
          )}
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
              <EmptySearchMark width={88} />
              <Text style={s.emptyTitle}>Nothing followed yet</Text>
              <Text style={s.emptySub}>
                Follow a bill, a case, or an order to see it move.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  content: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingBottom: 48,
    flexGrow: 1,
  },
  intro: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: P.quiet,
    marginBottom: 16,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  emptyTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 20,
    color: P.inkOnNight,
  },
  emptySub: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: P.quiet,
  },
  retry: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: P.inkOnNight,
  },
  unsaveAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    marginLeft: 12,
    borderRadius: 16,
    backgroundColor: P.stone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
  },
  unsaveText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: P.inkOnNight,
  },
});
