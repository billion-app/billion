import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { Image } from "expo-image";
import type { VideoPost } from "@acme/api";

import { Text, View } from "~/components/Themed";
import {
  badges,
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
  type Theme,
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

const TYPE_LABELS: Record<ContentCard["type"], string> = {
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
  const imageUri = item.imageUri ?? item.thumbnailUrl;
  const accentColor = getTypeBadgeColor(item.type);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => router.push(`/article-detail?id=${item.id}`)}
      activeOpacity={0.85}
    >
      {/* Left accent stripe — content type color */}
      <View style={[styles.accentStripe, { backgroundColor: accentColor }]} lightColor="transparent" darkColor="transparent" />

      <View style={styles.cardBody} lightColor="transparent" darkColor="transparent">
        <View
          style={[badges.base, { backgroundColor: accentColor }]}
          lightColor="transparent"
          darkColor="transparent"
        >
          <Text style={badges.text}>{TYPE_LABELS[item.type]}</Text>
        </View>

        <Text style={[styles.cardTitle, { color: theme.foreground }]}>
          {item.title}
        </Text>

        <Text
          style={[styles.cardDescription, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      </View>

      {imageUri ? (
        <Image
          style={styles.cardThumbnail}
          source={{ uri: imageUri }}
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
        { color: active ? theme.primaryForeground : "rgba(255, 255, 255, 0.60)" },
      ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

const TAB_CONFIG: Array<{ key: VideoPost["type"] | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "bill", label: "Bills" },
  { key: "court_case", label: "Cases" },
  { key: "government_content", label: "Orders" },
];

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [selectedTab, setSelectedTab] = useState<VideoPost["type"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: content, isLoading, error } = useQuery(
    trpc.content.getByType.queryOptions({ type: selectedTab }),
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
      {/* Header */}
      <View style={headerStyles.container}>
        <Text style={[headerStyles.title, styles.screenTitle]}>
          What's Moving
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

      {/* Content list */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.white} />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={[typography.h4, { color: theme.danger }]}>
              Failed to load
            </Text>
            <Text style={[styles.stateSubtext, { color: theme.mutedForeground }]}>
              Check your connection and try again
            </Text>
          </View>
        ) : filteredContent.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={[typography.h4, { color: theme.foreground }]}>
              Nothing here yet
            </Text>
            <Text style={[styles.stateSubtext, { color: theme.mutedForeground }]}>
              {searchQuery.trim()
                ? "Try different search terms"
                : "Check back soon for new content"}
            </Text>
          </View>
        ) : (
          <>
            {searchQuery.trim() ? (
              <Text style={[styles.resultsLabel, { color: theme.mutedForeground }]}>
                {filteredContent.length} result{filteredContent.length !== 1 ? "s" : ""}
              </Text>
            ) : null}
            {filteredContent.map((item) => (
              <ContentCardComponent key={item.id} item={item} theme={theme} />
            ))}
            {/* Bottom padding for tab bar */}
            <View style={styles.listFooter} lightColor="transparent" darkColor="transparent" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Screen title override — generous whitespace per brand spec
  screenTitle: {
    marginBottom: sp[5],
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: sp[5],
    paddingTop: sp[5],
  },

  // Card — horizontal layout with left accent stripe
  card: {
    borderRadius: rd.lg,
    marginBottom: sp[5],   // more air between cards
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 110,
  },
  // Left colored stripe — 4px, full card height
  accentStripe: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    paddingVertical: sp[4],
    paddingHorizontal: sp[4],
    gap: sp[2],
    justifyContent: "center",
  },
  // Right thumbnail — when available
  cardThumbnail: {
    width: 90,
    alignSelf: "stretch",
  },
  cardTitle: {
    fontFamily: "InriaSerif_700Bold",
    fontSize: 18,
    lineHeight: 18 * 1.35,
  },
  cardDescription: {
    fontFamily: "AlbertSans_400Regular",
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },

  // States
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp[16],
    gap: sp[2],
  },
  stateSubtext: {
    fontFamily: "AlbertSans_400Regular",
    fontSize: fontSize.base,
    textAlign: "center",
  },
  resultsLabel: {
    fontFamily: "AlbertSans_500Medium",
    fontSize: fontSize.sm,
    marginBottom: sp[3],
  },
  listFooter: {
    height: sp[8],
  },
});
