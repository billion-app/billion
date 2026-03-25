import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@acme/ui/button-native";

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
  <Button
    variant={active ? "default" : "ghost"}
    size="sm"
    style={localStyles.tabButton}
    onPress={onPress}
  >
    {title}
  </Button>
);

export default function ArticleDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [selectedTab, setSelectedTab] = useState<"article" | "original">(
    "article",
  );

  // Fetch content from tRPC

  const {
    data: content,
    isLoading,
    error,
  } = useQuery({
    ...trpc.content.getById.queryOptions({ id }),
    enabled: !!id,
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
                buttons.primary,
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
            <Markdown style={markdownStyles}>
              {selectedTab === "article"
                ? content.articleContent
                : content.originalContent}
            </Markdown>
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
