import type { RenderRules } from "@ronradtke/react-native-markdown-display";
import { useEffect, useState } from "react";
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
  Avatar,
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
import { posthog } from "~/config/posthog";
import {
  colors,
  contentType,
  darkTheme,
  fontBody,
  fontDisplay,
  getMarkdownStyles,
  hair,
  planes,
  resolveType,
} from "~/styles";
import { queryClient, trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { formatDate } from "~/utils/dates";

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
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const articleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [mode, setMode] = useState<"explainer" | "source">("explainer");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [failedHeaderImageUri, setFailedHeaderImageUri] = useState<
    string | undefined
  >();

  const handleModeChange = (newMode: "explainer" | "source") => {
    setMode(newMode);
    posthog.capture("article_view_mode_toggled", {
      content_id: articleId ?? null,
      content_type: content?.type ?? null,
      new_mode: newMode,
    });
  };

  const {
    data: content,
    isLoading,
    error,
  } = useQuery({
    ...trpc.content.getById.queryOptions({ id: articleId ?? "__missing__" }),
    enabled: !!articleId,
  });

  useEffect(() => {
    if (content) {
      posthog.capture("article_viewed", {
        content_id: content.id,
        content_type: content.type,
        content_title: content.title,
        is_ai_generated: content.isAIGenerated,
      });
    }
  }, [content]);
  const headerImageUri = content?.imageUri ?? content?.thumbnailUrl;

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
      posthog.capture("content_unsaved", {
        content_id: articleId,
        content_type: content.type,
        content_title: content.title,
      });
    } else {
      saveMutation.mutate({ contentId: articleId, contentType: content.type });
      posthog.capture("content_saved", {
        content_id: articleId,
        content_type: content.type,
        content_title: content.title,
      });
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
  // This screen is always rendered on the dark navy canvas, independent of
  // the phone's appearance setting. Using the light system theme here made
  // valid article markdown navy-on-navy and appear completely empty.
  const markdownStyles = getMarkdownStyles(darkTheme);
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
    posthog.capture("original_source_opened", {
      content_id: content.id,
      content_type: content.type,
      content_title: content.title,
      source_url: content.url,
    });
    try {
      if (await Linking.canOpenURL(content.url)) {
        await Linking.openURL(content.url);
      }
    } catch (e) {
      posthog.captureException(e as Error, { content_id: content.id });
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
  const hasRealActions = actions.length > 0;
  const timeline = hasRealActions
    ? actions
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((a, i, arr) => ({
          label: a.text.length > 80 ? a.text.slice(0, 77) + "…" : a.text,
          fullText: a.text,
          date: a.date,
          done: true,
          current: i === arr.length - 1,
        }))
    : [
        {
          label: "Introduced",
          fullText: "",
          date: "",
          done: true,
          current: false,
        },
        {
          label: "Committee review",
          fullText: "",
          date: "",
          done: true,
          current: false,
        },
        {
          label: "Latest action",
          fullText: "",
          date: "",
          done: true,
          current: true,
        },
        {
          label: "Becomes law",
          fullText: "",
          date: "",
          done: false,
          current: false,
        },
      ];
  // Actions are the official legislative record from the source (congress.gov).
  const timelineSourceUrl = hasRealActions ? content.url : undefined;
  const sponsor = content.type === "bill" ? content.sponsor : undefined;

  const openSponsorProfile = () => {
    if (!sponsor) return;
    posthog.capture("bill_sponsor_profile_opened", {
      content_id: content.id,
      bill_number: content.billNumber ?? null,
      sponsor_name: sponsor.name,
    });
    router.push({
      pathname: "/bill-sponsor-profile",
      params: { id: content.id },
    });
  };

  return (
    <View style={s.screen}>
      <NavHeader
        title={t.label}
        onBack={() => router.back()}
        action={
          __DEV__ ? (
            <TouchableOpacity onPress={toggleSave} hitSlop={8}>
              <Icon
                name={saved ? "bookmarkFill" : "bookmark"}
                size={21}
                color={saved ? colors.white : colors.textSecondary}
              />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {headerImageUri && headerImageUri !== failedHeaderImageUri ? (
          <View style={s.headerArt}>
            <Image
              source={{ uri: headerImageUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              onError={() => setFailedHeaderImageUri(headerImageUri)}
              accessible
              accessibilityLabel={`Header image for ${content.title}`}
            />
          </View>
        ) : (
          <Placeholder
            label={`${t.label.toLowerCase()} · header art`}
            height={170}
            radius={16}
            style={{ marginBottom: 18 }}
          />
        )}

        <View style={s.badgeRow}>
          <Badge type={typeKey} />
          {content.billNumber ? (
            <Text style={s.billNumber} testID="article-bill-number">
              {content.billNumber}
            </Text>
          ) : null}
        </View>

        <Text style={s.title} testID="article-title">
          {content.title}
        </Text>

        {content.description ? (
          <Text style={s.desc} testID="article-description">
            {content.description}
          </Text>
        ) : null}

        {sponsor ? (
          <TouchableOpacity
            style={s.sponsorCard}
            activeOpacity={0.75}
            onPress={openSponsorProfile}
            accessibilityRole="button"
            accessibilityLabel={`View sponsor profile for ${sponsor.name}`}
            testID="bill-sponsor-card"
          >
            <Avatar name={sponsor.initials} size={44} />
            <View style={s.sponsorBody}>
              <Text style={s.sponsorLabel}>Sponsored by</Text>
              <Text style={s.sponsorName} numberOfLines={1}>
                {sponsor.name}
              </Text>
              <Text style={s.sponsorMeta} numberOfLines={1}>
                {[sponsor.role, sponsor.party, sponsor.state]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Icon name="chevR" size={17} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}

        {/* explainer / source toggle */}
        <View style={{ marginTop: 18, marginBottom: 18 }}>
          <Segmented
            value={mode}
            onChange={handleModeChange}
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
          {timeline.map((step, i) => {
            const expandable = !!step.fullText && step.label !== step.fullText;
            const isExpanded = expandedStep === i;
            return (
              <TouchableOpacity
                key={i}
                style={s.timelineRow}
                activeOpacity={expandable ? 0.6 : 1}
                onPress={() =>
                  expandable && setExpandedStep(isExpanded ? null : i)
                }
                accessibilityRole={expandable ? "button" : undefined}
              >
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
                <View style={s.timelineBody}>
                  {!!step.date && (
                    <Text style={s.timelineDate}>{formatDate(step.date)}</Text>
                  )}
                  <View style={s.timelineLabelRow}>
                    <Text
                      style={[
                        s.timelineLabel,
                        {
                          color: step.done
                            ? colors.white
                            : colors.textSecondary,
                          fontFamily: step.current
                            ? fontBody.bold
                            : fontBody.medium,
                        },
                      ]}
                    >
                      {isExpanded ? step.fullText : step.label}
                    </Text>
                    {expandable && (
                      <Icon
                        name={isExpanded ? "chevD" : "chevR"}
                        size={13}
                        color={colors.textSecondary}
                      />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          {timelineSourceUrl && (
            <TouchableOpacity
              style={s.timelineSource}
              activeOpacity={0.7}
              onPress={() => void Linking.openURL(timelineSourceUrl)}
            >
              <Icon name="info" size={13} color={colors.textSecondary} />
              <Text style={s.timelineSourceText}>
                Official record · congress.gov
              </Text>
              <Icon name="chevR" size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
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
  headerArt: {
    height: 170,
    marginBottom: 18,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: planes.surface,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
  },
  billNumber: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.textSecondary,
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
  sponsorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    padding: 14,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 14,
  },
  sponsorBody: { flex: 1, gap: 1 },
  sponsorLabel: {
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  sponsorName: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: colors.white,
  },
  sponsorMeta: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
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
  timelineBody: { flex: 1, paddingBottom: 14 },
  timelineDate: {
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  timelineLabelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  timelineLabel: { flex: 1, fontSize: 14, lineHeight: 19 },
  timelineSource: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: hair[1],
  },
  timelineSourceText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
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
