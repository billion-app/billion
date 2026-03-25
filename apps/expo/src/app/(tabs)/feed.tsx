import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { VideoPost } from "@acme/api";
import { Button } from "@acme/ui/button-native";

import { Text, View } from "~/components/Themed";
import {
  badges,
  cards,
  colors,
  fontSize,
  fontWeight,
  getTypeBadgeColor,
  layout,
  rd,
  sp,
  typography,
  useTheme,
} from "~/styles";
import { trpc } from "~/utils/api";
import { getBaseUrl } from "~/utils/base-url";

const { height: screenHeight } = Dimensions.get("window");

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();

  // Debug: log base URL
  useEffect(() => {
    console.warn("[FeedScreen] Base URL:", getBaseUrl());
  }, []);

  // Use infinite query for video feed
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    ...trpc.video.getInfinite.infiniteQueryOptions({
      limit: 10,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // Flatten all pages into a single array of videos
  const videos = useMemo(
    () => data?.pages.flatMap((page) => page.videos) ?? [],
    [data],
  );

  const loadMoreVideos = () => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  const renderVideoItem = ({ item }: { item: VideoPost; index: number }) => (
    <View
      style={[
        styles.videoContainer,
        { height: screenHeight, backgroundColor: theme.background },
      ]}
      lightColor={theme.background}
      darkColor={theme.background}
    >
      {/* Content Card */}
      <View
        style={[
          cards.elevated,
          {
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
          },
        ]}
        lightColor={theme.card}
        darkColor={theme.card}
        testID="feed-card"
      >
        {/* Type Badge */}
        <View
          style={[
            badges.base,
            { backgroundColor: getTypeBadgeColor(item.type) },
          ]}
          lightColor="transparent"
          darkColor="transparent"
          testID="feed-badge"
        >
          <Text style={badges.text}>
            {item.type == "bill"
              ? "BILL"
              : item.type == "government_content"
                ? "ORDER"
                : item.type == "court_case"
                  ? "CASE"
                  : "NEWS"}
          </Text>
        </View>

        {/* Title */}
        <Text
          style={[typography.h1, styles.cardTitle, { color: theme.foreground }]}
        >
          {item.title}
        </Text>

        {/* Hybrid Image Display - prioritize AI-generated imageUri */}
        {item.imageUri ? (
          <Image
            style={{ width: "100%", height: 200, borderRadius: rd.xl }}
            source={{ uri: item.imageUri }}
            contentFit="cover"
            transition={300}
          />
        ) : item.thumbnailUrl ? (
          <Image
            style={{ width: "100%", height: 200, borderRadius: rd.xl }}
            source={{ uri: item.thumbnailUrl }}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 200,
              borderRadius: rd.xl,
              backgroundColor: theme.muted,
              justifyContent: "center",
              alignItems: "center",
            }}
            lightColor={theme.muted}
            darkColor={theme.muted}
          >
            <Text style={{ fontSize: 48 }}>
              {item.type === "bill"
                ? "📜"
                : item.type === "court_case"
                  ? "⚖️"
                  : "🏛️"}
            </Text>
          </View>
        )}

        {/* Article Preview */}
        <Text
          style={[
            styles.articlePreview,
            { color: theme.mutedForeground, marginTop: 20 },
          ]}
        >
          {item.articlePreview}
        </Text>

        {/* Author */}
        <Text style={[styles.author, { color: theme.accent }]}>
          {item.author}
        </Text>

        {/* Read Full Article Button */}
        <Button
          variant="default"
          size="lg"
          style={styles.readButton}
          onPress={() => {
            // Use originalContentId from video
            router.push(`/article-detail?id=${item.originalContentId}`);
          }}
        >
          Read Full Article
        </Button>
      </View>

      {/* Action Buttons - Floating with no background */}
      {/*<View
        style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 80 }]}
        lightColor="transparent"
        darkColor="transparent"
      >
        <View
          style={actions.container}
          lightColor="transparent"
          darkColor="transparent"
        >
          <TouchableOpacity
            style={actions.button}
            onPress={() => handleLike(item.id)}
          >
            <Text
              style={[
                actions.icon,
                { filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" },
                likedVideos.has(item.id) && styles.actionIconLiked,
              ]}
            >
              {likedVideos.has(item.id) ? "❤️" : "🤍"}
            </Text>
            <Text style={[actions.text, { color: theme.foreground }]}>
              {item.likes + (likedVideos.has(item.id) ? 1 : 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={actions.button}>
            <Text style={actions.icon}>💬</Text>
            <Text style={[actions.text, { color: theme.foreground }]}>
              {item.comments}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={actions.button}>
            <Text style={actions.icon}>📤</Text>
            <Text style={[actions.text, { color: theme.foreground }]}>
              {item.shares}
            </Text>
          </TouchableOpacity>
        </View>
      </View>*/}
    </View>
  );

  // Show loading state while fetching initial videos
  if (isLoading) {
    return (
      <View style={[layout.fullCenter, { backgroundColor: theme.background }]}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading videos...
        </Text>
      </View>
    );
  }

  // Show error state if fetching failed
  if (error) {
    console.error("[FeedScreen] Error loading videos:", error);
    return (
      <View style={[layout.fullCenter, { backgroundColor: theme.background }]}>
        <StatusBar hidden />
        <Text style={[typography.h4, { color: theme.danger }]}>
          Error loading videos
        </Text>
        <Text
          style={[
            typography.body,
            styles.errorSubtext,
            { color: theme.textSecondary },
          ]}
        >
          Please try again later
        </Text>
      </View>
    );
  }

  return (
    <View style={layout.container}>
      <StatusBar hidden />
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={screenHeight}
        snapToAlignment="start"
        decelerationRate={0}
        bounces={false}
        onEndReached={loadMoreVideos}
        onEndReachedThreshold={0.5}
        getItemLayout={(_data, index) => ({
          length: screenHeight,
          offset: screenHeight * index,
          index,
        })}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
      />
    </View>
  );
}

// import {
//   spacing,
// } from "@acme/ui/theme-tokens";
// const sp = (key: keyof typeof spacing): number => spacing[key] * 16;
const styles = StyleSheet.create({
  loadingText: {
    fontFamily: "AlbertSans_400Regular",
    marginTop: sp[4],
    fontSize: fontSize.base,
  },
  errorSubtext: {
    fontFamily: "AlbertSans_400Regular",
    marginTop: sp[2],
  },
  videoContainer: {
    position: "relative",
    width: "100%",
    padding: sp[5],
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: "IBMPlexSerif_700Bold",
    marginBottom: sp[3],
    marginTop: sp[4],
  },
  cardDescription: {
    marginBottom: sp[4],
  },
  articlePreview: {
    fontFamily: "AlbertSans_400Regular",
    fontSize: fontSize.base,
    marginBottom: sp[4],
    lineHeight: fontSize.base * 1.6,
  },
  author: {
    fontFamily: "AlbertSans_600SemiBold",
    fontSize: fontSize.sm,
    marginBottom: sp[5],
  },
  readButton: {
    width: "100%",
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    right: sp[5],
    alignItems: "flex-end",
  },
  actionIconLiked: {
    transform: [{ scale: 1.25 }],
  },
});
