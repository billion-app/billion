import type { RenderRules } from "@ronradtke/react-native-markdown-display";
import type { LayoutChangeEvent } from "react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import Markdown from "@ronradtke/react-native-markdown-display";
import { useQuery } from "@tanstack/react-query";

import type { BillBriefData, BriefQuote } from "~/components/ui";
import type { ShareSurface } from "~/utils/share";
import { createRouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { ShareSheet } from "~/components/ShareSheet";
import { Text } from "~/components/Themed";
import {
  Avatar,
  Badge,
  BillBrief,
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
import { useSavedContent } from "~/hooks/useSavedContent";
import { useScreenshotDetection } from "~/hooks/useScreenshotDetection";
import {
  colors,
  contentType,
  darkTheme,
  fontBody,
  fontDisplay,
  fontEditorial,
  getMarkdownStyles,
  hair,
  planes,
  resolveType,
} from "~/styles";
import { trpc } from "~/utils/api";
import { formatDate } from "~/utils/dates";
import { contentImageSource } from "~/utils/editorial-visuals";
import { isStateJurisdiction, JURISDICTIONS } from "~/utils/jurisdiction";

export const ErrorBoundary = createRouteErrorBoundary("article-detail");

export default function ArticleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const articleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [mode, setMode] = useState<"explainer" | "source">("explainer");
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [sourceHighlight, setSourceHighlight] = useState<BriefQuote | null>(
    null,
  );
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  // Which surface opened the share sheet, or null when it is closed. The
  // surface is what the share is attributed to, so it is the state.
  const [shareSurface, setShareSurface] = useState<ShareSurface | null>(null);
  const [failedHeaderImageKey, setFailedHeaderImageKey] = useState<
    string | undefined
  >();
  const scrollRef = useRef<ScrollView>(null);
  const sourcePanelY = useRef(0);

  const handleModeChange = (newMode: "explainer" | "source") => {
    setSourceHighlight(null);
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
  const headerImageSource = content
    ? contentImageSource(headerImageUri)
    : undefined;
  const headerImageKey = content
    ? `${content.title}:${headerImageUri ?? "local"}`
    : undefined;

  const { isSaved, toggleSave } = useSavedContent();
  const saved = !!articleId && isSaved(articleId);

  const handleToggleSave = () => {
    if (!articleId || !content) return;
    toggleSave({ id: articleId, type: content.type, title: content.title });
  };

  /**
   * A screenshot is a reader telling us they want to show this to someone, in
   * the only way the app has so far given them. Meeting that with the share
   * sheet turns a flat image into a link that travels — and, unlike the
   * screenshot, one we can attribute.
   */
  useScreenshotDetection(() => {
    if (!content) return;
    posthog.capture("article_screenshotted", {
      content_id: content.id,
      content_type: content.type,
      content_title: content.title,
    });
    setShareSurface("screenshot");
  }, !!content);

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

  const handleViewSource = (quote: BriefQuote) => {
    setSourceHighlight(quote);
    setMode("source");
    posthog.capture("article_source_passage_opened", {
      content_id: content.id,
      content_type: content.type,
      locator: quote.locator ?? null,
    });
  };

  const handleSourceTargetLayout = (event: LayoutChangeEvent) => {
    const targetY = event.nativeEvent.layout.y;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, sourcePanelY.current + targetY - 110),
        animated: true,
      });
    });
  };

  // A structured brief replaces the markdown explainer when one has been
  // generated. Content without a brief (every type except bills, and bills the
  // pipeline hasn't reached yet) keeps rendering the long-form article, so this
  // is additive rather than a cutover.
  const brief: BillBriefData | null =
    "brief" in content ? (content.brief as BillBriefData | null) : null;

  const rawContent =
    mode === "explainer" ? content.articleContent : content.originalContent;
  // The types say this is a string, but the router has no `.output()` schema,
  // so nothing enforces that at runtime. `.includes`/`.length` on a null would
  // take the whole app down rather than render an empty article.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- guards an unvalidated API response
  const activeContent = rawContent ?? "";
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
        .map((a) => ({
          label: a.text.length > 80 ? a.text.slice(0, 77) + "…" : a.text,
          fullText: a.text,
          date: a.date,
          done: true,
        }))
    : [
        {
          label: "Introduced",
          fullText: "",
          date: "",
          done: true,
        },
        {
          label: "Committee review",
          fullText: "",
          date: "",
          done: true,
        },
        {
          label: "Latest action",
          fullText: "",
          date: "",
          done: true,
        },
        {
          label: "Becomes law",
          fullText: "",
          date: "",
          done: false,
        },
      ];
  const currentTimelineIndex = hasRealActions ? timeline.length - 1 : 2;
  // Actions are the official legislative record from the source (congress.gov).
  const timelineSourceUrl = hasRealActions ? content.url : undefined;
  const sponsor = content.type === "bill" ? content.sponsor : undefined;
  const isStateBill =
    content.type === "bill" && isStateJurisdiction(content.jurisdiction);
  const displayBillNumber = isStateBill
    ? content.billNumber.replace(/\s+\([^)]+\)$/, "")
    : content.billNumber;

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
          <>
            <TouchableOpacity
              onPress={() => setShareSurface("article_header")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share this record"
              testID="article-share"
            >
              <Icon name="share" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleToggleSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                saved ? "Remove from saved" : "Save to read later"
              }
              testID="article-save"
            >
              <Icon
                name={saved ? "bookmarkFill" : "bookmark"}
                size={21}
                color={saved ? colors.white : colors.textSecondary}
              />
            </TouchableOpacity>
          </>
        }
      />

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {headerImageSource && headerImageKey !== failedHeaderImageKey ? (
          <View style={s.headerArt}>
            <Image
              source={headerImageSource}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              onError={() => setFailedHeaderImageKey(headerImageKey)}
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
          {displayBillNumber ? (
            <Text style={s.billNumber} testID="article-bill-number">
              {displayBillNumber}
            </Text>
          ) : null}
        </View>

        {isStateBill ? (
          <Text style={s.jurisdictionLine}>
            {JURISDICTIONS[content.jurisdiction].body}
            {content.sessionLabel ? ` · ${content.sessionLabel}` : ""}
          </Text>
        ) : null}

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
            <Avatar
              name={sponsor.initials}
              imageUri={sponsor.imageUrl}
              size={44}
            />
            <View style={s.sponsorBody}>
              <Text style={s.sponsorLabel}>Sponsored by</Text>
              <Text style={s.sponsorName} numberOfLines={1}>
                {sponsor.name}
              </Text>
              <Text style={s.sponsorMeta} numberOfLines={1}>
                {[
                  sponsor.role,
                  sponsor.party,
                  isStateBill && sponsor.district
                    ? `District ${sponsor.district}`
                    : sponsor.state,
                ]
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
              {
                id: "explainer",
                label: brief ? "The brief" : "Plain explainer",
                icon: "sparkle",
              },
              { id: "source", label: "Original text", icon: "doc" },
            ]}
          />
        </View>

        {mode === "explainer" && (
          <TouchableOpacity
            style={s.disclaimer}
            activeOpacity={0.72}
            onPress={() => setProvenanceOpen((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: provenanceOpen }}
            accessibilityLabel={
              provenanceOpen
                ? "Hide details about Billion AI authorship"
                : "Show details about Billion AI authorship"
            }
          >
            <Icon name="sparkle" size={17} color={t.color} />
            <View style={s.disclaimerBody}>
              <View style={s.disclaimerHead}>
                <Text style={s.disclaimerTitle}>
                  Written by Billion AI · Always check the source
                </Text>
                <Text style={[s.disclaimerAction, { color: t.color }]}>
                  {provenanceOpen ? "Hide" : "Details"}
                </Text>
                <View style={provenanceOpen ? s.chevFlip : undefined}>
                  <Icon name="chevD" size={14} color={t.color} />
                </View>
              </View>
              {provenanceOpen ? (
                <Text style={s.disclaimerText}>
                  Created from the official text.{" "}
                  {brief
                    ? "Quoted passages are checked against that source; everything else is AI analysis."
                    : "The plain-language explanation is AI analysis."}{" "}
                  Use Original text or the linked official site to verify
                  details.
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
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
          onLayout={(event) => {
            sourcePanelY.current = event.nativeEvent.layout.y;
          }}
        >
          {mode === "explainer" && brief ? (
            <BillBrief
              data={brief}
              accent={t.color}
              dualLens={
                content.lensData ? <LensPanel data={content.lensData} /> : null
              }
              onViewSource={handleViewSource}
            />
          ) : mode === "source" && sourceHighlight ? (
            <HighlightedSource
              content={content.originalContent}
              quote={sourceHighlight}
              accent={t.color}
              onTargetLayout={handleSourceTargetLayout}
            />
          ) : renderMarkdown ? (
            <Markdown style={markdownStyles} rules={markdownRules}>
              {activeContent}
            </Markdown>
          ) : (
            <Text style={s.plainText}>{activeContent}</Text>
          )}
        </View>

        {/* Never present generic copy as if it were generated analysis. */}
        {mode === "explainer" && content.lensData && !brief && (
          <View style={{ marginVertical: 24 }}>
            <LensPanel data={content.lensData} />
          </View>
        )}

        {/* timeline */}
        <Kicker style={s.timelineKicker}>Where it stands</Kicker>
        <Card style={{ marginBottom: 24 }}>
          {timeline.map((step, i) => {
            const expandable = !!step.fullText && step.label !== step.fullText;
            const isExpanded = expandedStep === i;
            const isCurrent = i === currentTimelineIndex;
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
                        backgroundColor: isCurrent ? t.color : "transparent",
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
                          fontFamily: isCurrent
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
                Official record ·{" "}
                {("sourceLabel" in content ? content.sourceLabel : undefined) ??
                  "congress.gov"}
              </Text>
              <Icon name="chevR" size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </Card>

        {/* The explainer ends by handing the reader back to the official
            record. The source tab already has that action at the top. */}
        {mode === "explainer" ? (
          <View style={s.exit}>
            <Text style={s.exitTitle}>Don&apos;t take our word for it.</Text>
            <Text style={s.exitSub}>
              Read the full, unedited text and track every action on the
              official record.
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
        ) : null}
      </ScrollView>

      {shareSurface ? (
        <ShareSheet
          visible
          onClose={() => setShareSurface(null)}
          contentId={content.id}
          contentType={content.type}
          contentTitle={content.title}
          surface={shareSurface}
          accent={t.color}
          heading={
            shareSurface === "screenshot"
              ? "Send the real thing instead"
              : undefined
          }
          subheading={
            shareSurface === "screenshot"
              ? "A link opens the whole brief, stays readable, and works for anyone you send it to."
              : undefined
          }
        />
      ) : null}
    </View>
  );
}

function HighlightedSource({
  content,
  quote,
  accent,
  onTargetLayout,
}: {
  content: string;
  quote: BriefQuote;
  accent: string;
  onTargetLayout: (event: LayoutChangeEvent) => void;
}) {
  const exactIndex = content.indexOf(quote.text);
  const caseInsensitiveIndex =
    exactIndex >= 0
      ? exactIndex
      : content.toLocaleLowerCase().indexOf(quote.text.toLocaleLowerCase());
  const found = caseInsensitiveIndex >= 0;
  const before = found ? content.slice(0, caseInsensitiveIndex) : "";
  const match = found
    ? content.slice(
        caseInsensitiveIndex,
        caseInsensitiveIndex + quote.text.length,
      )
    : quote.text;
  const after = found
    ? content.slice(caseInsensitiveIndex + quote.text.length)
    : content;

  return (
    <View style={s.highlightedSource}>
      <View style={s.sourceDocumentHead}>
        <View
          style={[s.sourceDocumentIcon, { backgroundColor: `${accent}28` }]}
        >
          <Icon name="doc" size={15} color={accent} />
        </View>
        <View style={s.sourceDocumentHeadCopy}>
          <Text style={s.sourceDocumentTitle}>Original text</Text>
          <Text style={s.sourceDocumentMeta}>
            {quote.locator
              ? `Highlighted passage · ${quote.locator}`
              : "Highlighted passage"}
          </Text>
        </View>
      </View>
      {before ? <Text style={s.sourceText}>{before}</Text> : null}
      <View
        style={[
          s.sourceHighlight,
          { backgroundColor: `${accent}22`, borderColor: accent },
        ]}
        onLayout={onTargetLayout}
        testID="source-highlight"
      >
        <Text style={[s.sourceHighlightLabel, { color: accent }]}>
          {found ? "MATCHING PASSAGE" : "CITED PASSAGE"}
        </Text>
        <Text style={s.sourceHighlightText}>{match}</Text>
      </View>
      {after ? <Text style={s.sourceText}>{after}</Text> : null}
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
  jurisdictionLine: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: -3,
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
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: planes.surface,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  disclaimerBody: { flex: 1, gap: 8 },
  disclaimerHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  disclaimerTitle: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: "rgba(255,255,255,0.82)",
  },
  disclaimerAction: {
    fontFamily: fontBody.semibold,
    fontSize: 10.5,
  },
  disclaimerText: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 11.5,
    color: "rgba(255,255,255,0.64)",
    lineHeight: 17,
  },
  chevFlip: { transform: [{ rotate: "180deg" }] },
  sourcePanel: {
    backgroundColor: planes.ink,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 14,
    padding: 18,
  },
  highlightedSource: { gap: 14 },
  sourceDocumentHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: hair[2],
  },
  sourceDocumentIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceDocumentHeadCopy: { flex: 1, gap: 1 },
  sourceDocumentTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    color: colors.white,
  },
  sourceDocumentMeta: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  sourceText: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 25,
    color: "rgba(255,255,255,0.7)",
  },
  sourceHighlight: {
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  sourceHighlightLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 9.5,
    letterSpacing: 0.9,
  },
  sourceHighlightText: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 25,
    color: colors.white,
  },
  plainText: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 16.5,
    lineHeight: 27,
    color: "rgba(255,255,255,0.88)",
  },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineKicker: { marginTop: 30 },
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
