import type { RenderRules } from "@ronradtke/react-native-markdown-display";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import Markdown from "@ronradtke/react-native-markdown-display";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Text } from "~/components/Themed";
import {
  Badge,
  Card,
  GhostButton,
  Icon,
  Kicker,
  LensPanel,
  NavHeader,
  Placeholder,
  PrimaryButton,
  Segmented,
} from "~/components/ui";
import {
  colors,
  contentType,
  fontBody,
  fontDisplay,
  getMarkdownStyles,
  hair,
  planes,
  resolveType,
  useTheme,
} from "~/styles";
import { queryClient, trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

// TODO(backend): real per-side framing per content item.
const PLACEHOLDER_LENS = {
  framing: "proponent_opponent" as const,
  left: {
    stance: "Supporters argue",
    points: [
      "Frames this as closing a long-standing gap",
      "Point to broad public benefit",
    ],
  },
  right: {
    stance: "Critics counter",
    points: [
      "Question the cost and scope",
      "Prefer a narrower, state-led approach",
    ],
  },
};

export default function ArticleDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const articleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [mode, setMode] = useState<"explainer" | "source">("explainer");

  const {
    data: content,
    isLoading,
    error,
  } = useQuery({
    ...trpc.content.getById.queryOptions({ id: articleId ?? "__missing__" }),
    enabled: !!articleId,
  });

  // content.saved.isSaved is a protected procedure — only query it when signed in,
  // otherwise it throws UNAUTHORIZED.
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;

  const savedQuery = useQuery({
    ...trpc.content.saved.isSaved.queryOptions({ contentId: articleId ?? "" }),
    enabled: !!articleId && isSignedIn,
  });
  const saved = savedQuery.data?.saved ?? false;

  const saveMutation = useMutation({
    ...trpc.content.saved.add.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.content.saved.isSaved.queryKey({
          contentId: articleId ?? "",
        }),
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
        queryKey: trpc.content.saved.isSaved.queryKey({
          contentId: articleId ?? "",
        }),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.content.saved.list.infiniteQueryKey(),
      });
    },
  });

  const toggleSave = () => {
    if (!articleId || !content) return;
    if (!isSignedIn) {
      Alert.alert(
        "Sign in to save",
        "Sign in to bookmark and revisit content.",
      );
      return;
    }
    if (saved) {
      unsaveMutation.mutate({ contentId: articleId });
    } else {
      saveMutation.mutate({ contentId: articleId, contentType: content.type });
    }
  };

  if (isLoading) {
    return (
      <View style={[s.fullCenter, { backgroundColor: planes.navy }]}>
        <ActivityIndicator size="large" color={colors.white} />
        <Text style={s.loadingText}>Loading content…</Text>
      </View>
    );
  }

  if (error || !content) {
    return (
      <View style={[s.fullCenter, { backgroundColor: planes.navy }]}>
        <Text style={s.errorTitle}>
          {error ? "Failed to load content" : "Content not found"}
        </Text>
        <PrimaryButton
          label="Go Back"
          onPress={() => router.back()}
          style={{ width: 160, marginTop: 16 }}
        />
      </View>
    );
  }

  const typeKey = resolveType(content.type);
  const t = contentType[typeKey];
  const markdownStyles = getMarkdownStyles(theme);
  const markdownRules: RenderRules = {
    image: (
      node,
      _children,
      _parent,
      styles,
      allowedImageHandlers,
      defaultImageHandler,
    ) => {
      /* eslint-disable */
      const src = String(node.attributes.src ?? "");
      const alt = node.attributes.alt ? String(node.attributes.alt) : undefined;
      const show = allowedImageHandlers.some((value: string) =>
        src.toLowerCase().startsWith(value.toLowerCase()),
      );
      if (!show && defaultImageHandler === null) return null;
      const imageUri = show ? src : `${defaultImageHandler}${src}`;
      return (
        <Image
          key={node.key}
          source={{ uri: imageUri }}
          style={[styles._VIEW_SAFE_image, s.markdownImage]}
          contentFit="contain"
          transition={200}
          accessible={!!alt}
          accessibilityLabel={alt}
        />
      );
      /* eslint-enable */
    },
  };

  const handleOpenOriginal = async () => {
    if (!content.url) return;
    try {
      if (await Linking.canOpenURL(content.url)) {
        await Linking.openURL(content.url);
      }
    } catch (e) {
      console.error("Error opening URL:", e);
    }
  };

  const activeContent =
    mode === "explainer" ? content.articleContent : content.originalContent;
  const looksLikeMarkdown =
    /^#{1,6}\s/m.test(activeContent) ||
    /\[[^\]]+\]\((https?:\/\/|\/)/.test(activeContent) ||
    /(^|\n)([-*+]|\d+\.)\s/m.test(activeContent) ||
    /(^|\n)>\s/m.test(activeContent) ||
    /!\[[^\]]*\]\(/.test(activeContent) ||
    activeContent.includes("```");
  const renderMarkdown =
    activeContent.length <= 20000 &&
    (content.isAIGenerated || looksLikeMarkdown);

  const actions =
    "actions" in content
      ? (content.actions as { date: string; text: string }[])
      : [];
  const timeline =
    actions.length > 0
      ? actions
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((a, i, arr) => ({
            label: a.text.length > 80 ? a.text.slice(0, 77) + "…" : a.text,
            done: true,
            current: i === arr.length - 1,
          }))
      : [
          { label: "Introduced", done: true, current: false },
          { label: "Committee review", done: true, current: false },
          { label: "Latest action", done: true, current: true },
          { label: "Becomes law", done: false, current: false },
        ];

  return (
    <View style={s.screen}>
      <NavHeader
        title={t.label}
        onBack={() => router.back()}
        action={
          <TouchableOpacity onPress={toggleSave} hitSlop={8}>
            <Icon
              name={saved ? "bookmarkFill" : "bookmark"}
              size={21}
              color={saved ? colors.white : colors.textSecondary}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Placeholder
          label={`${t.label.toLowerCase()} · header art`}
          height={170}
          radius={16}
          style={{ marginBottom: 18 }}
        />

        <View style={s.badgeRow}>
          <Badge type={typeKey} />
        </View>

        <Text style={s.title} testID="article-title">
          {content.title}
        </Text>

        {content.description ? (
          <Text style={s.desc} testID="article-description">
            {content.description}
          </Text>
        ) : null}

        {/* explainer / source toggle */}
        <View style={{ marginTop: 18, marginBottom: 18 }}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { id: "explainer", label: "Plain explainer", icon: "sparkle" },
              { id: "source", label: "Original text", icon: "doc" },
            ]}
          />
        </View>

        {mode === "explainer" && (
          <View style={s.disclaimer}>
            <Icon name="sparkle" size={17} color={t.color} />
            <Text style={s.disclaimerText}>
              Explained by Billion AI from the official text.{" "}
              <Text style={s.disclaimerEm}>
                Always verify against the source below.
              </Text>
            </Text>
          </View>
        )}

        {mode === "source" && content.url && (
          <PrimaryButton
            label="View on Original Site"
            icon="external"
            onPress={handleOpenOriginal}
            style={{ marginBottom: 18 }}
          />
        )}

        <View
          testID="article-content"
          style={mode === "source" ? s.sourcePanel : undefined}
        >
          {renderMarkdown ? (
            <Markdown style={markdownStyles} rules={markdownRules}>
              {activeContent}
            </Markdown>
          ) : (
            <Text style={s.plainText}>{activeContent}</Text>
          )}
        </View>

        {/* Dual-Lens — signature */}
        <View style={{ marginVertical: 24 }}>
          <LensPanel data={content.lensData ?? PLACEHOLDER_LENS} />
        </View>

        {/* timeline */}
        <Kicker>Where it stands</Kicker>
        <Card style={{ marginBottom: 24 }}>
          {timeline.map((step, i) => (
            <View key={i} style={s.timelineRow}>
              <View style={s.timelineMarker}>
                <View
                  style={[
                    s.timelineDot,
                    {
                      borderColor: step.done ? t.color : hair[3],
                      backgroundColor: step.current ? t.color : "transparent",
                    },
                  ]}
                />
                {i < timeline.length - 1 && (
                  <View
                    style={[
                      s.timelineLine,
                      { backgroundColor: step.done ? t.color : hair[2] },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  s.timelineLabel,
                  {
                    color: step.done ? colors.white : colors.textSecondary,
                    fontFamily: step.current ? fontBody.bold : fontBody.medium,
                  },
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </Card>

        {/* dig-deeper exit */}
        <View style={s.exit}>
          <Text style={s.exitTitle}>Don&apos;t take our word for it.</Text>
          <Text style={s.exitSub}>
            Read the full, unedited text and track every action on the official
            record.
          </Text>
          <PrimaryButton
            label="Open the source"
            icon="external"
            onPress={handleOpenOriginal}
          />
          <GhostButton
            label="View all related records"
            onPress={handleOpenOriginal}
            style={{ width: "100%", marginTop: 6 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: planes.navy },
  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    fontFamily: "AlbertSans-Regular",
    marginTop: 16,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 18,
    color: colors.red[500],
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    color: colors.white,
    marginBottom: 16,
    lineHeight: 34,
  },
  desc: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  disclaimer: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: "AlbertSans-Regular",
    fontSize: 12.5,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  disclaimerEm: { color: colors.white, fontFamily: fontBody.semibold },
  sourcePanel: {
    backgroundColor: planes.ink,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 14,
    padding: 18,
  },
  plainText: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 16.5,
    lineHeight: 27,
    color: "rgba(255,255,255,0.88)",
  },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineMarker: { alignItems: "center" },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  timelineLine: { width: 2, flex: 1, minHeight: 22 },
  timelineLabel: { fontSize: 14, paddingBottom: 14 },
  exit: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 16,
    padding: 20,
  },
  exitTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 18,
    color: colors.white,
    marginBottom: 6,
  },
  exitSub: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  markdownImage: {
    width: "100%",
    minHeight: 180,
    maxHeight: 320,
    marginVertical: 12,
    alignSelf: "center",
  },
});
