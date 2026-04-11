import type {
  ASTNode,
  RenderRules,
} from "@ronradtke/react-native-markdown-display";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "@ronradtke/react-native-markdown-display";
import { useQuery } from "@tanstack/react-query";

import { AIDisclaimerBanner } from "~/components/AIDisclaimerBanner";
import { Text, View } from "~/components/Themed";
// import { WireframeWave } from "~/components/WireframeWave";
import {
  badges,
  buttons,
  cards,
  colors,
  createTabContainerStyles,
  getMarkdownStyles,
  getTypeBadgeColor,
  layout,
  rd,
  sp,
  typography,
  useTheme,
} from "~/styles";
import { trpc } from "~/utils/api";

const TabButton = ({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[
      buttons.tab,
      localStyles.tabButton,
      active
        ? { backgroundColor: colors.white }
        : { backgroundColor: "transparent" },
    ]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Text
      style={[
        localStyles.tabButtonText,
        { color: active ? colors.black : colors.white },
      ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

export default function ArticleDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const articleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [selectedTab, setSelectedTab] = useState<"article" | "original">(
    "article",
  );

  // Fetch content from tRPC

  const {
    data: content,
    isLoading,
    error,
  } = useQuery({
    ...trpc.content.getById.queryOptions({ id: articleId ?? "__missing__" }),
    enabled: !!articleId,
  });

  // Handle loading state

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Loading...",
            headerBackTitle: "Back",
          }}
        />
        <View
          style={[layout.fullCenter, { backgroundColor: theme.background }]}
        >
          <ActivityIndicator size="large" color={theme.primary} />
          <Text
            style={[localStyles.loadingText, { color: theme.textSecondary }]}
          >
            Loading content...
          </Text>
        </View>
      </>
    );
  }

  // Handle error state
  if (error || !content) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Error",
            headerBackTitle: "Back",
          }}
        />
        <View
          style={[
            localStyles.errorContainer,
            { backgroundColor: theme.background },
          ]}
        >
          <Text style={[typography.h4, { color: theme.danger }]}>
            {error ? "Failed to load content" : "Content not found"}
          </Text>
          <TouchableOpacity
            style={[
              localStyles.errorButton,
              { backgroundColor: theme.primary },
            ]}
            onPress={() => router.back()}
          >
            <Text
              style={[
                localStyles.errorButtonText,
                { color: theme.primaryForeground },
              ]}
            >
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const tabContainerStyles = createTabContainerStyles(theme);
  const markdownStyles = getMarkdownStyles(theme);
  const markdownRules: RenderRules = {
    image: (
      node: ASTNode,
      _children: ReactNode[],
      _parent: ASTNode[],
      styles: any, // eslint-disable-line @typescript-eslint/no-explicit-any
      allowedImageHandlers: string[],
      defaultImageHandler: string | null,
    ) => {
      const { src, alt } = node.attributes as { src: string; alt?: string };
      const show = allowedImageHandlers.some((value) =>
        src.toLowerCase().startsWith(value.toLowerCase()),
      );

      if (!show && defaultImageHandler === null) {
        return null;
      }

      const imageUri = show ? src : `${defaultImageHandler}${src}`;

      return (
        <Image
          key={node.key}
          source={{ uri: imageUri }}
          style={[styles._VIEW_SAFE_image, localStyles.markdownImage]} // eslint-disable-line @typescript-eslint/no-unsafe-member-access
          contentFit="contain"
          transition={200}
          accessible={!!alt}
          accessibilityLabel={alt}
        />
      );
    },
  };

  const handleOpenOriginal = async () => {
    if (content.url) {
      try {
        const canOpen = await Linking.canOpenURL(content.url);
        if (canOpen) {
          await Linking.openURL(content.url);
        }
      } catch (openError) {
        console.error("Error opening URL:", openError);
      }
    }
  };

  const activeContent =
    selectedTab === "article"
      ? content.articleContent
      : content.originalContent;
  const looksLikeMarkdown =
    /^#{1,6}\s/m.test(activeContent) ||
    /\[[^\]]+\]\((https?:\/\/|\/)/.test(activeContent) ||
    /(^|\n)([-*+]|\d+\.)\s/m.test(activeContent) ||
    /(^|\n)>\s/m.test(activeContent) ||
    /!\[[^\]]*\]\(/.test(activeContent) ||
    activeContent.includes("```");
  const shouldRenderMarkdown =
    activeContent.length <= 20000 &&
    (content.isAIGenerated || looksLikeMarkdown);

  return (
    <>
      <SafeAreaView style={layout.container} edges={["top"]}>
        {/* Wireframe wave background */}
        {/*<WireframeWave />*/}

        <View
          style={[
            tabContainerStyles,
            { borderBottomColor: theme.border, alignItems: "center" },
          ]}
        >
          {/* Close button — left of tabs, 44×44 touch target, no background */}
          <TouchableOpacity
            style={localStyles.closeButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>

          <TabButton
            title="Article"
            active={selectedTab === "article"}
            onPress={() => setSelectedTab("article")}
          />
          <TabButton
            title="Original"
            active={selectedTab === "original"}
            onPress={() => setSelectedTab("original")}
          />
        </View>

        <ScrollView
          style={layout.scrollView}
          contentContainerStyle={localStyles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Type badge */}
          {(() => {
            const typeLabel =
              content.type === "bill"
                ? "BILL"
                : content.type === "government_content"
                  ? "ORDER"
                  : "CASE";

            const badgeColor = getTypeBadgeColor(content.type);
            return (
              <View
                style={[badges.base, { backgroundColor: badgeColor + "22" }]}
                lightColor="transparent"
                darkColor="transparent"
              >
                <Text
                  style={[
                    badges.text,
                    { color: badgeColor, fontFamily: "AlbertSans-Bold" },
                  ]}
                >
                  {typeLabel}
                </Text>
              </View>
            );
          })()}

          {/* Article title */}
          <Text
            style={[
              typography.h1,
              localStyles.articleTitle,
              { color: theme.foreground, fontFamily: "IBMPlexSerif-Bold" },
            ]}
          >
            {content.title}
          </Text>

          {/* Short description */}
          <Text
            style={[
              typography.bodySmall,
              localStyles.articleDescription,
              { color: theme.textSecondary },
            ]}
          >
            {content.description}
          </Text>

          {/* AI Disclaimer Banner - shown only on Article tab */}
          {selectedTab === "article" && (
            <AIDisclaimerBanner style={{ marginBottom: sp[4] }} />
          )}

          {/* Show "View Original" button in Original tab */}
          {selectedTab === "original" && content.url && (
            <TouchableOpacity
              style={[
                localStyles.viewOriginalButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={handleOpenOriginal}
              activeOpacity={0.8}
            >
              <Ionicons
                name="open-outline"
                size={20}
                color={theme.primaryForeground}
                style={{ marginRight: sp[2] }}
              />
              <Text
                style={[
                  typography.bodySmall,
                  { color: theme.primaryForeground, fontWeight: "600" },
                ]}
              >
                View on Original Site
              </Text>
            </TouchableOpacity>
          )}

          <View
            style={[
              cards.content,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                marginTop: sp[5],
                marginBottom: sp[20],
              },
            ]}
          >
            {shouldRenderMarkdown ? (
              <Markdown style={markdownStyles} rules={markdownRules}>
                {activeContent}
              </Markdown>
            ) : (
              <Text
                style={[
                  typography.body,
                  localStyles.plainTextContent,
                  { color: theme.foreground },
                ]}
              >
                {activeContent}
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const localStyles = StyleSheet.create({
  loadingText: {
    marginTop: sp[4],
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: sp[5],
  },
  errorButton: {
    borderRadius: rd.full,
    paddingHorizontal: sp[8],
    paddingVertical: sp[3],
    marginTop: sp[4],
    minHeight: 48,
  },
  errorButtonText: {
    fontFamily: "AlbertSans_600SemiBold",
    fontSize: 16,
  },
  tabButton: {
    borderRadius: rd.full,
  },
  tabButtonText: {
    fontFamily: "AlbertSans_500Medium",
    fontSize: 16,
    textAlign: "center",
  },
  scrollViewContent: {
    padding: sp[5],
    paddingBottom: sp[10],
  },
  articleTitle: {
    marginBottom: sp[3],
    marginTop: sp[4],
  },
  articleDescription: {
    marginBottom: sp[4],
  },
  plainTextContent: {
    lineHeight: sp[6],
  },
  markdownImage: {
    width: "100%",
    minHeight: 180,
    maxHeight: 320,
    marginVertical: sp[3],
    alignSelf: "center",
  },
  // White pill button — brand signature for primary CTAs
  viewOriginalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp[3],
    paddingHorizontal: sp[6],
    borderRadius: rd.full,
    marginTop: sp[4],
    minHeight: 48,
  },
  // Close button — inline left of tabs, 44×44 touch target, no background
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: sp[1],
  },
});
