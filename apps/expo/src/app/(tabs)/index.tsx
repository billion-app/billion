import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";

import type { VideoPost } from "@acme/api";

import type { Theme } from "~/styles";
import { Text, View } from "~/components/Themed";
import {
  buttons,
  colors,
  createHeaderStyles,
  createSearchStyles,
  createTabContainerStyles,
  fontSize,
  getTypeBadgeColor,
  layout,
  rd,
  sp,
  typography,
  useTheme,
} from "~/styles";
import { trpc } from "~/utils/api";

interface ContentCard {
  id: string;
  title: string;
  description: string;
  type: "bill" | "government_content" | "court_case" | "general";
  isAIGenerated: boolean;
  thumbnailUrl?: string;
  imageUri?: string;
}

const _TYPE_LABELS: Record<ContentCard["type"], string> = {
  bill: "BILL",
  government_content: "ORDER",
  court_case: "CASE",
  general: "NEWS",
};

const ContentCardComponent = ({
  item,
  theme,
}: {
  item: ContentCard;
  theme: Theme;
}) => {
  const router = useRouter();

  const getDisplayTitle = (title: string) => {
    if (title.length <= 60) return title;
    const truncated = title.substring(0, 57);
    const lastSpace = truncated.lastIndexOf(" ");
    return lastSpace > 40
      ? truncated.substring(0, lastSpace) + "..."
      : truncated + "...";
  };

  const getTitleFontSize = (len: number) => {
    if (len < 40) return fontSize.xl;
    if (len < 60) return fontSize.lg;
    if (len < 80) return fontSize.base;
    return fontSize.sm;
  };

  const typeLabel =
    item.type === "bill"
      ? "BILL"
      : item.type === "government_content"
        ? "ORDER"
        : item.type === "court_case"
          ? "CASE"
          : "NEWS";

  const typeBadgeColor = getTypeBadgeColor(item.type);

  const displayTitle = getDisplayTitle(item.title);
  const titleFontSize = getTitleFontSize(displayTitle.length);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => router.push(`/article-detail?id=${item.id}`)}
      activeOpacity={0.85}
      testID="content-card"
    >
      {/* Left accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: typeBadgeColor }]} />

      <View style={styles.cardBody}>
        {/* Type badge */}
        <View
          style={[styles.typeBadge, { backgroundColor: typeBadgeColor + "22" }]}
          testID="content-card-badge"
        >
          <Text style={[styles.typeBadgeText, { color: typeBadgeColor }]}>
            {typeLabel}
          </Text>
        </View>

        {/* Title */}
        <Text
          style={[
            styles.cardTitle,
            { color: theme.foreground, fontSize: titleFontSize },
          ]}
          testID="content-card-title"
        >
          {displayTitle}
        </Text>

        {/* Description */}
        {item.description ? (
          <Text
            style={[styles.cardDescription, { color: theme.textSecondary }]}
            numberOfLines={2}
            testID="content-card-description"
          >
            {item.description}
          </Text>
        ) : null}

        <Text style={[styles.readMore, { color: typeBadgeColor }]}>
          Read More →
        </Text>
      </View>

      {/* Thumbnail */}
      {(item.imageUri ?? item.thumbnailUrl) ? (
        <Image
          style={styles.thumbnail}
          source={{ uri: item.imageUri ?? item.thumbnailUrl }}
          contentFit="cover"
          transition={300}
        />
      ) : null}
    </TouchableOpacity>
  );
};

const TabButton = ({
  title,
  active,
  onPress,
  theme,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
  theme: Theme;
}) => (
  <TouchableOpacity
    style={[
      buttons.tab,
      { borderRadius: 9999 },
      active
        ? { backgroundColor: theme.primary }
        : {
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: colors.borderLight,
          },
    ]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text
      style={[
        buttons.tabText,
        {
          color: active ? theme.primaryForeground : theme.mutedForeground,
          fontFamily: "AlbertSans-Medium",
        },
      ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

const TAB_CONFIG: { key: VideoPost["type"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bill", label: "Bills" },
  { key: "court_case", label: "Cases" },
  { key: "government_content", label: "Orders" },
];

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [selectedTab, setSelectedTab] = useState<VideoPost["type"] | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: content,
    isLoading,
    error,
  } = useQuery(
    trpc.content.getByType.queryOptions({
      type: selectedTab,
    }),
  );

  const fuse = useMemo(() => {
    if (!content) return null;
    return new Fuse(content, {
      keys: ["title", "description"],
      threshold: 0.3,
      includeScore: true,
    });
  }, [content]);

  const filteredContent = useMemo(() => {
    if (!content) return [];
    if (!searchQuery.trim()) return content;
    if (!fuse) return content;
    return fuse.search(searchQuery).map((r) => r.item);
  }, [content, searchQuery, fuse]);

  const headerStyles = createHeaderStyles(theme, insets.top);
  const searchStyles = createSearchStyles(theme);
  const tabContainerStyles = createTabContainerStyles(theme);

  return (
    <View style={layout.container}>
      <View style={headerStyles.container}>
        <Text style={[headerStyles.title, { fontFamily: "IBMPlexSerif-Bold" }]}>
          Browse
        </Text>

        <TextInput
          style={searchStyles}
          placeholder="Search bills, cases, orders…"
          placeholderTextColor={theme.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Filter tabs */}
      <View style={tabContainerStyles}>
        {TAB_CONFIG.map(({ key, label }) => (
          <TabButton
            key={key}
            title={label}
            active={selectedTab === key}
            onPress={() => setSelectedTab(key)}
            theme={theme}
          />
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.white} />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={[typography.bodySmall, { color: theme.danger }]}>
              Unable to load content
            </Text>
          </View>
        ) : filteredContent.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={[typography.h4, { color: theme.foreground }]}>
              Nothing found
            </Text>
            <Text
              style={[
                typography.bodySmall,
                { color: theme.mutedForeground, marginTop: sp[2] },
              ]}
            >
              Try a different search or filter
            </Text>
          </View>
        ) : (
          <>
            {searchQuery.trim() ? (
              <Text
                style={[styles.resultsText, { color: theme.textSecondary }]}
              >
                {filteredContent.length} result
                {filteredContent.length !== 1 ? "s" : ""}
              </Text>
            ) : null}
            {}
            {filteredContent.map((item: ContentCard) => (
              <ContentCardComponent key={item.id} item={item} theme={theme} />
            ))}
            {/* Bottom padding for tab bar */}
            <View
              style={styles.listFooter}
              lightColor="transparent"
              darkColor="transparent"
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    paddingHorizontal: sp[5],
    paddingTop: sp[4],
  },

  card: {
    flexDirection: "row",
    borderRadius: rd.lg,
    marginBottom: sp[4],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 110,
  },
  cardAccent: {
    width: 3,
  },
  cardBody: {
    flex: 1,
    padding: sp[4],
    gap: sp[2],
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: sp[2],
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: sp[1],
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: "AlbertSans-Bold",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontFamily: "InriaSerif-Bold",
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: fontSize.sm,
    fontFamily: "AlbertSans-Regular",
    lineHeight: 18,
  },
  readMore: {
    fontSize: fontSize.sm,
    fontFamily: "AlbertSans-Medium",
    marginTop: sp[1],
  },
  thumbnail: {
    width: 80,
    height: "100%" as unknown as number,
  },

  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp[16],
    gap: sp[2],
  },
  resultsText: {
    fontSize: fontSize.sm,
    fontFamily: "AlbertSans-Medium",
    marginBottom: sp[3],
  },
  listFooter: {
    height: sp[8],
  },
});
