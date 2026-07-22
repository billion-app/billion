import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import type { VideoPost } from "@acme/api";

import { Text } from "~/components/Themed";
import { Badge, Icon, LensStrip, Placeholder } from "~/components/ui";
import { posthog } from "~/config/posthog";
import {
  colors,
  contentType,
  fontBody,
  fontDisplay,
  hair,
  planes,
  resolveType,
} from "~/styles";
import { queryClient, trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

const TYPE_TAG: Record<string, string> = {
  bill: "Bill",
  government_content: "Exec Order",
  court_case: "Court Case",
  general: "Briefing",
};

// Bottom tab bar height (see TabBar) so the CTA clears it.
const TAB_BAR_HEIGHT = 74;

const SAVEABLE_TYPES = new Set(["bill", "government_content", "court_case"]);

function FeedCard({
  item,
  height,
  topInset,
  bottomInset,
  onOpen,
}: {
  item: VideoPost;
  height: number;
  topInset: number;
  bottomInset: number;
  onOpen: () => void;
}) {
  const canSave = SAVEABLE_TYPES.has(item.type);
  const contentId = item.originalContentId;

  // content.saved.isSaved is a protected procedure — only query it when signed in,
  // otherwise it throws UNAUTHORIZED.
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;

  const savedQuery = useQuery({
    ...trpc.content.saved.isSaved.queryOptions({ contentId }),
    enabled: canSave && isSignedIn,
    staleTime: 5 * 60 * 1000,
  });
  const saved = savedQuery.data?.saved ?? false;

  const saveMutation = useMutation({
    ...trpc.content.saved.add.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.content.saved.isSaved.queryKey({ contentId }),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.content.saved.list.infiniteQueryKey(),
      });
    },
  });
  const unsaveMutation = useMutation({
    ...trpc.content.saved.remove.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.content.saved.isSaved.queryKey({ contentId }),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.content.saved.list.infiniteQueryKey(),
      });
    },
  });

  const toggleSave = () => {
    if (!canSave) return;
    if (!isSignedIn) {
      Alert.alert(
        "Sign in to save",
        "Sign in to bookmark and revisit content.",
      );
      return;
    }
    if (saved) {
      unsaveMutation.mutate({ contentId });
    } else {
      saveMutation.mutate({
        contentId,
        contentType: item.type as "bill" | "government_content" | "court_case",
      });
    }
  };

  const typeKey = resolveType(item.type);
  const t = contentType[typeKey];

  return (
    <LinearGradient
      testID="feed-card"
      colors={[planes.navy, "#181F38"]}
      style={[
        s.card,
        {
          height,
          paddingTop: topInset + 14,
          paddingBottom: TAB_BAR_HEIGHT + bottomInset + 18,
        },
      ]}
    >
      {/* top meta */}
      <View style={s.meta}>
        <View testID="feed-badge">
          <Badge type={typeKey} />
        </View>
        <Text style={s.tag}>{TYPE_TAG[item.type] ?? "Briefing"}</Text>
        <Text style={s.time}>Recent</Text>
      </View>

      {/* hero */}
      {(item.imageUri ?? item.thumbnailUrl) ? (
        <Image
          style={s.hero}
          source={{ uri: item.imageUri ?? item.thumbnailUrl }}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <Placeholder
          label={`${(TYPE_TAG[item.type] ?? "briefing").toLowerCase()} · visual explainer`}
          height={150}
          radius={14}
          style={{ marginBottom: 18 }}
        />
      )}

      {/* headline */}
      <Text style={s.headline} testID="feed-title">
        {item.title}
      </Text>

      {/* gist */}
      {item.articlePreview ? (
        <Text style={s.gist} numberOfLines={4} testID="feed-description">
          {item.articlePreview}
        </Text>
      ) : null}

      {/* key-fact chips — TODO(backend): real stat/status/chamber per item */}
      <View style={s.chips}>
        <View style={[s.chip, { flex: 1 }]}>
          <Text style={[s.chipStat, { color: t.color }]}>{t.label}</Text>
          <Text style={s.chipLabel}>type</Text>
        </View>
        <View style={[s.chip, { flex: 1.4 }]}>
          <Text style={s.chipStatus}>{item.author || "Public record"}</Text>
          <Text style={s.chipLabel}>source</Text>
        </View>
      </View>

      {/* dual-lens strip */}
      <View style={{ marginBottom: "auto" }}>
        <LensStrip label="See it across the spectrum" onExpand={onOpen} />
      </View>

      {/* exit point */}
      <View style={s.actions}>
        <TouchableOpacity
          style={s.cta}
          onPress={onOpen}
          activeOpacity={0.85}
          testID="feed-cta"
        >
          <Text style={s.ctaText}>Dig into the source</Text>
          <Icon name="external" size={17} color={planes.ink} />
        </TouchableOpacity>
        {__DEV__ && canSave && (
          <TouchableOpacity
            style={s.saveBtn}
            onPress={toggleSave}
            activeOpacity={0.8}
          >
            <Icon
              name={saved ? "bookmarkFill" : "bookmark"}
              size={20}
              color={saved ? colors.white : "rgba(255,255,255,0.7)"}
            />
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    error,
  } = useInfiniteQuery(
    trpc.video.getInfinite.infiniteQueryOptions(
      { limit: 10 },
      {
        initialCursor: 0,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );

  const videos = useMemo(
    () =>
      data ? data.pages.flatMap((p: { videos: VideoPost[] }) => p.videos) : [],
    [data],
  );

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };

  if (isPending) {
    return (
      <View style={[s.fullCenter, { backgroundColor: planes.navy }]}>
        <ActivityIndicator size="large" color={colors.white} />
        <Text style={s.loadingText}>Loading feed…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.fullCenter, { backgroundColor: planes.navy }]}>
        <Text style={s.errorTitle}>Error loading feed</Text>
        <Text style={s.errorSub}>Please try again later</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard
            item={item}
            height={SCREEN_H}
            topInset={insets.top}
            bottomInset={insets.bottom}
            onOpen={() => {
              posthog.capture("feed_item_detail_opened", {
                content_id: item.originalContentId,
                content_type: item.type,
                content_title: item.title,
              });
              router.push(`/article-detail?id=${item.originalContentId}`);
            }}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        getItemLayout={(_d, index) => ({
          length: SCREEN_H,
          offset: SCREEN_H * index,
          index,
        })}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  fullCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: {
    fontFamily: "AlbertSans-Regular",
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 18,
    color: colors.red[500],
  },
  errorSub: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  card: { width: SCREEN_W, paddingHorizontal: 22 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 16,
  },
  tag: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  time: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12.5,
    color: colors.textSecondary,
    marginLeft: "auto",
  },
  hero: { width: "100%", height: 150, borderRadius: 14, marginBottom: 18 },
  headline: {
    fontFamily: fontDisplay.bold,
    fontSize: 29,
    color: colors.white,
    marginBottom: 14,
    lineHeight: 33,
  },
  gist: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 16.5,
    lineHeight: 25,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 18,
  },
  chips: { flexDirection: "row", gap: 10, marginBottom: 18 },
  chip: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipStat: { fontFamily: "IBMPlexSerif-Bold", fontSize: 20 },
  chipStatus: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  chipLabel: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 18,
  },
  cta: {
    flex: 1,
    height: 50,
    borderRadius: 9999,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { fontFamily: fontBody.semibold, fontSize: 16, color: planes.ink },
  saveBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    alignItems: "center",
    justifyContent: "center",
  },
});
