import type { RenderRules } from "@ronradtke/react-native-markdown-display";
import type { LayoutChangeEvent } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Markdown from "@ronradtke/react-native-markdown-display";
import { useQuery } from "@tanstack/react-query";

import type { BillBriefData, BriefQuote } from "~/components/ui";
import type { ShareSurface } from "~/utils/share";
import { BillProgressRail } from "~/components/digest/BillProgressRail";
import {
  FolioMark,
  PullQuoteMark,
  SectionFlourish,
} from "~/components/digest/CraftMarks";
import { createRouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { ShareSheet } from "~/components/ShareSheet";
import { Text } from "~/components/Themed";
import {
  BillBrief,
  GhostButton,
  Icon,
  Kicker,
  LensPanel,
  NavHeader,
  PrimaryButton,
  Segmented,
} from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useSavedContent } from "~/hooks/useSavedContent";
import { useScreenshotDetection } from "~/hooks/useScreenshotDetection";
import {
  contentType,
  darkTheme,
  DigestHair,
  DigestRadii,
  DigestSpace,
  DigestType,
  fontBody,
  fontDisplay,
  fontEditorial,
  getMarkdownStyles,
  lightTheme,
  DigestPalette as P,
  resolveType,
} from "~/styles";
import { trpc } from "~/utils/api";
import { formatDate } from "~/utils/dates";
import { contentImageSource } from "~/utils/editorial-visuals";
import { followAccessibilityLabel } from "~/utils/follow-copy";
import { isStateJurisdiction, JURISDICTIONS } from "~/utils/jurisdiction";
import { relativeActivity } from "~/utils/relative-activity";

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

  useFocusEffect(
    useCallback(
      () => () => {
        setShareSurface(null);
      },
      [],
    ),
  );

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
      <View style={[s.fullCenter, { backgroundColor: P.canvas }]}>
        <ActivityIndicator size="large" color={P.spark} />
        <Text style={s.loadingText}>Loading content…</Text>
      </View>
    );
  }

  if (error || !content) {
    return (
      <View style={[s.fullCenter, { backgroundColor: P.canvas }]}>
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
  const nightMarkdown = getMarkdownStyles({
    ...darkTheme,
    background: P.canvas,
    foreground: P.inkOnNight,
    card: P.card,
    cardForeground: P.inkOnNight,
    muted: P.card,
    mutedForeground: P.quiet,
    accent: P.spark,
  });
  const paperMarkdown = getMarkdownStyles({
    ...lightTheme,
    background: P.paper,
    foreground: P.ink,
    card: P.cream,
    cardForeground: P.ink,
    muted: P.cream,
    mutedForeground: P.quiet,
    accent: P.spark,
  });
  const markdownStyles = mode === "source" ? paperMarkdown : nightMarkdown;
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

  const officialUrl =
    "officialUrl" in content ? content.officialUrl : undefined;
  const sourceUrl = officialUrl ?? content.url;
  const handleOpenOriginal = async () => {
    if (!sourceUrl) return;
    posthog.capture("original_source_opened", {
      content_id: content.id,
      content_type: content.type,
      content_title: content.title,
      source_url: sourceUrl,
    });
    try {
      if (await Linking.canOpenURL(sourceUrl)) {
        await Linking.openURL(sourceUrl);
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
  const rawBrief: BillBriefData | null =
    "brief" in content ? (content.brief as BillBriefData | null) : null;

  // TRUST P0 (eggbot / craft-loop): fail-closed mismatch hide.
  // Never keep a brief that only title-echoes ("this 'Wildfire' bill…") while the
  // proposal text drifts (youth housing). Prefer hide → plain explainer, or
  // BillBrief trustFallback uses real content.description (getById — not invented).
  const briefAligned = (briefData: BillBriefData): boolean => {
    const STOP = new Set([
      "this",
      "that",
      "with",
      "from",
      "would",
      "could",
      "should",
      "about",
      "after",
      "before",
      "their",
      "there",
      "these",
      "those",
      "into",
      "onto",
      "over",
      "under",
      "than",
      "then",
      "also",
      "only",
      "just",
      "been",
      "have",
      "will",
      "shall",
      "each",
      "such",
      "when",
      "what",
      "which",
      "while",
      "where",
      "your",
      "ours",
      "them",
      "they",
      "were",
      "been",
      "and",
      "the",
      "for",
      "are",
      "was",
      "but",
      "not",
      "you",
      "all",
      "can",
      "her",
      "his",
      "its",
      "our",
      "out",
      "bill",
      "acts",
      "act",
      "state",
      "year",
      "years",
      "passed",
      "pass",
      "create",
      "rules",
      "let",
      "see",
      "puts",
      "put",
      "make",
      "made",
    ]);
    const tokenize = (s: string) => [
      ...new Set(
        s
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 3 && !STOP.has(w)),
      ),
    ];
    const titleTokens = new Set(tokenize(content.title));
    const dekTokens = tokenize(content.description).filter(
      (t) => !titleTokens.has(t),
    );
    const body = `${briefData.summary ?? ""} ${briefData.hook}`.toLowerCase();
    const bodyToks = tokenize(body);
    if (!body.trim()) return false;

    // Fail-closed when no dek: reject title-echo + novel-dominated briefs.
    if (dekTokens.length === 0) {
      const novel = bodyToks.filter((t) => !titleTokens.has(t));
      if (titleTokens.size > 0 && novel.length >= 4) return false;
      return true;
    }

    const dekHits = dekTokens.filter((t) => body.includes(t));
    return dekHits.length >= 1 && dekHits.length / dekTokens.length >= 0.35;
  };

  const brief: BillBriefData | null =
    rawBrief && briefAligned(rawBrief) ? rawBrief : null;

  // Editorial pull quote — first notable BriefQuote (≥48 chars), not decorative chrome.
  const pullQuote: BriefQuote | null = (() => {
    if (!brief) return null;
    const candidates = [
      ...brief.changes.map((c) => c.quote),
      ...brief.facts.map((f) => f.quote),
    ].filter((q): q is BriefQuote => !!q?.text && q.text.trim().length >= 48);
    return candidates[0] ?? null;
  })();

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
  // Only render official actions from getById — never invent a completed path.
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
    : [];
  const currentTimelineIndex = hasRealActions ? timeline.length - 1 : -1;
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
        tone="dark"
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
              <Icon name="share" size={20} color={P.quiet} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleToggleSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={followAccessibilityLabel(
                content.type,
                saved,
                content.title,
              )}
              testID="article-save"
            >
              <Icon
                name={saved ? "bookmarkFill" : "bookmark"}
                size={21}
                color={saved ? P.spark : P.quiet}
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
            <LinearGradient
              colors={["transparent", P.canvas]}
              style={s.headerFade}
            />
          </View>
        ) : null}

        <View style={s.kickerRow}>
          <Text style={s.kicker}>
            {t.label}
            {displayBillNumber ? (
              <>
                {" · "}
                <Text testID="article-bill-number">{displayBillNumber}</Text>
              </>
            ) : null}
            {brief?.legalStatus === "enacted"
              ? " · Law"
              : brief?.legalStatus === "proposed"
                ? " · Proposal"
                : ""}
          </Text>
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
        <View style={s.flourishWrap}>
          <SectionFlourish width={72} />
        </View>

        {!brief && content.description ? (
          <Text style={s.desc} testID="article-description">
            {content.description}
          </Text>
        ) : content.description ? (
          <Text
            style={s.descHidden}
            testID="article-description"
            accessibilityElementsHidden
          >
            {content.description}
          </Text>
        ) : null}

        {("sourceLabel" in content && content.sourceLabel) || sponsor ? (
          <View style={s.byline}>
            {"sourceLabel" in content && content.sourceLabel ? (
              <View style={s.sourcePill} accessibilityRole="text">
                <Text style={s.sourcePillText}>{content.sourceLabel}</Text>
              </View>
            ) : null}
            {sponsor ? (
              <TouchableOpacity
                style={s.sponsorLink}
                activeOpacity={0.75}
                onPress={openSponsorProfile}
                accessibilityRole="button"
                accessibilityLabel={`View sponsor profile for ${sponsor.name}`}
                testID="bill-sponsor-card"
              >
                <Text style={s.sponsorName} numberOfLines={1}>
                  {sponsor.name}
                </Text>
                <Icon name="chevR" size={14} color={P.quiet} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={s.modeToggle}>
          <Segmented
            value={mode}
            onChange={handleModeChange}
            options={[
              {
                id: "explainer",
                label: brief ? "Brief" : "Explainer",
              },
              { id: "source", label: "Source" },
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
            <Text style={s.disclaimerTitle}>Billion AI</Text>
            {provenanceOpen ? (
              <Text style={s.disclaimerText}>
                Written from the official text. Quoted passages are checked
                against that source; everything else is analysis. Verify on the
                source tab or the official record.
              </Text>
            ) : null}
          </TouchableOpacity>
        )}

        {mode === "source" && sourceUrl && (
          <PrimaryButton
            label={
              officialUrl
                ? "View Federal Register record"
                : "View on Original Site"
            }
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
              accent={P.spark}
              dualLens={
                content.lensData ? <LensPanel data={content.lensData} /> : null
              }
              onViewSource={handleViewSource}
            />
          ) : mode === "explainer" && !brief ? (
            // No trusted brief: fall back to getById articleContent (AI or
            // source-derived). Never leave the explainer blank; never invent copy.
            activeContent.trim().length > 0 ? (
              renderMarkdown ? (
                <Markdown style={markdownStyles} rules={markdownRules}>
                  {activeContent}
                </Markdown>
              ) : (
                <Text style={s.plainText}>{activeContent}</Text>
              )
            ) : (
              <Text style={s.plainText} testID="brief-trust-skipped">
                A structured brief isn&apos;t ready for this record yet. Use the
                description above or open the official source.
              </Text>
            )
          ) : mode === "source" && sourceHighlight ? (
            <HighlightedSource
              content={content.originalContent}
              quote={sourceHighlight}
              accent={P.spark}
              onTargetLayout={handleSourceTargetLayout}
            />
          ) : mode === "source" && renderMarkdown ? (
            <>
              <View style={s.sourceDocumentHead}>
                <FolioMark size={28} />
                <View style={s.sourceDocumentHeadCopy}>
                  <Text style={s.sourceDocumentTitle}>Original text</Text>
                </View>
              </View>
              <Markdown style={markdownStyles} rules={markdownRules}>
                {activeContent}
              </Markdown>
            </>
          ) : mode === "source" ? (
            <>
              <View style={s.sourceDocumentHead}>
                <FolioMark size={28} />
                <View style={s.sourceDocumentHeadCopy}>
                  <Text style={s.sourceDocumentTitle}>Original text</Text>
                </View>
              </View>
              <Text style={s.plainTextOnPaper}>{activeContent}</Text>
            </>
          ) : null}
        </View>

        {/* Zen pack: one editorial pull-quote when data exists, then timeline hugs — no fact-card chrome */}
        {mode === "explainer" && pullQuote ? (
          <View style={s.pullQuote} accessibilityRole="summary">
            <PullQuoteMark size={26} />
            <Text style={s.pullQuoteText}>"{pullQuote.text.trim()}"</Text>
            {pullQuote.locator ? (
              <Text style={s.pullQuoteMeta}>{pullQuote.locator}</Text>
            ) : (
              <Text style={s.pullQuoteMeta}>From the official text</Text>
            )}
          </View>
        ) : null}

        {content.type === "bill" && content.status ? (
          <BillProgressRail
            status={content.status}
            jurisdiction={content.jurisdiction}
            updatedLabel={
              hasRealActions &&
              relativeActivity(
                new Date(timeline[timeline.length - 1]?.date ?? ""),
              ) === "today"
                ? "Updated today"
                : undefined
            }
          />
        ) : null}

        {/* timeline — official actions only */}
        <Kicker style={s.timelineKicker}>Where it stands</Kicker>
        <View style={s.timelineCard}>
          {!hasRealActions ? (
            <Text style={s.timelineEmpty}>
              No official actions are attached to this record yet. Check the
              source for the latest status.
            </Text>
          ) : (
            timeline.map((step, i) => {
              const expandable =
                !!step.fullText && step.label !== step.fullText;
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
                          borderColor: step.done
                            ? P.spark
                            : DigestHair.sectionRule,
                          backgroundColor: isCurrent ? P.spark : "transparent",
                        },
                      ]}
                    />
                    {i < timeline.length - 1 && (
                      <View
                        style={[
                          s.timelineLine,
                          {
                            backgroundColor: step.done
                              ? P.spark
                              : DigestHair.cardBorder,
                          },
                        ]}
                      />
                    )}
                  </View>
                  <View style={s.timelineBody}>
                    {!!step.date && (
                      <Text style={s.timelineDate}>
                        {formatDate(step.date)}
                      </Text>
                    )}
                    <View style={s.timelineLabelRow}>
                      <Text
                        style={[
                          s.timelineLabel,
                          {
                            color: step.done ? P.inkOnNight : P.quiet,
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
                          color={P.quiet}
                        />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          {timelineSourceUrl && (
            <TouchableOpacity
              style={s.timelineSource}
              activeOpacity={0.7}
              onPress={() => void Linking.openURL(timelineSourceUrl)}
            >
              <Icon name="info" size={13} color={P.quiet} />
              <Text style={s.timelineSourceText}>
                Official record ·{" "}
                {("sourceLabel" in content ? content.sourceLabel : undefined) ??
                  "congress.gov"}
              </Text>
              <Icon name="chevR" size={12} color={P.quiet} />
            </TouchableOpacity>
          )}
        </View>

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
          thumbnailUrl={
            headerImageSource ? (headerImageUri ?? undefined) : undefined
          }
          surface={shareSurface}
          accent={P.spark}
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
        <FolioMark size={28} />
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
  screen: { flex: 1, backgroundColor: P.canvas },
  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    fontFamily: fontBody.regular,
    marginTop: 16,
    color: P.quiet,
  },
  errorTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    color: P.inkOnNight,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: DigestSpace.coverPadX,
    paddingBottom: 48,
  },
  headerArt: {
    height: 220,
    marginHorizontal: -DigestSpace.coverPadX,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: P.card,
  },
  headerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: P.spark,
  },
  flourishWrap: {
    marginBottom: 12,
    alignItems: "flex-start",
  },
  jurisdictionLine: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 16,
    color: P.quiet,
    marginTop: -2,
    marginBottom: 8,
  },
  title: {
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    color: P.inkOnNight,
    marginBottom: 8,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  desc: {
    fontFamily: fontBody.regular,
    fontSize: 15.5,
    color: P.quiet,
    lineHeight: 23,
    marginBottom: 10,
  },
  descHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
    marginBottom: 16,
  },
  sourcePill: {
    backgroundColor: P.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,19,26,0.16)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: DigestRadii.sourcePill,
  },
  sourcePillText: {
    ...DigestType.sourcePill,
    color: P.ink,
  },
  sponsorLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  sponsorName: {
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    color: P.inkOnNight,
    flexShrink: 1,
  },
  modeToggle: {
    marginBottom: 14,
  },
  disclaimer: {
    marginBottom: 14,
    gap: 6,
  },
  disclaimerTitle: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    letterSpacing: 0.2,
    color: P.quiet,
  },
  disclaimerText: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: P.quiet,
    lineHeight: 17,
  },
  pullQuote: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: P.paper,
    borderRadius: DigestRadii.menu,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12,
  },
  pullQuoteText: {
    fontFamily: fontEditorial.italic,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: P.ink,
  },
  pullQuoteMeta: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: P.spark,
  },
  chevFlip: { transform: [{ rotate: "180deg" }] },
  sourcePanel: {
    backgroundColor: P.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,19,26,0.12)",
    borderRadius: DigestRadii.menu,
    padding: 18,
  },
  highlightedSource: { gap: 14 },
  sourceDocumentHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(22,19,26,0.12)",
  },
  sourceDocumentHeadCopy: { flex: 1, gap: 1 },
  sourceDocumentTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 17,
    letterSpacing: -0.25,
    color: P.ink,
  },
  sourceDocumentMeta: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: P.quiet,
  },
  sourceText: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 25,
    color: "rgba(22,19,26,0.72)",
  },
  sourceHighlight: {
    borderLeftWidth: 2,
    borderRadius: DigestRadii.menuRow,
    padding: 14,
    gap: 6,
    backgroundColor: "rgba(196,163,90,0.16)",
  },
  sourceHighlightLabel: {
    fontFamily: fontBody.bold,
    fontSize: 9.5,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  sourceHighlightText: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 25,
    color: P.ink,
  },
  plainText: {
    fontFamily: fontBody.regular,
    fontSize: 16.5,
    lineHeight: 27,
    color: P.inkOnNight,
  },
  plainTextOnPaper: {
    fontFamily: fontBody.regular,
    fontSize: 16.5,
    lineHeight: 27,
    color: P.ink,
  },
  timelineCard: {
    marginBottom: 16,
    backgroundColor: P.card,
    borderRadius: DigestRadii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    padding: 16,
  },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineEmpty: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 20,
    color: P.quiet,
    paddingVertical: 4,
  },
  timelineKicker: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: P.spark,
  },
  timelineMarker: { alignItems: "center" },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  timelineLine: { width: 2, flex: 1, minHeight: 22 },
  timelineBody: { flex: 1, paddingBottom: 14 },
  timelineDate: {
    fontFamily: fontBody.medium,
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: P.quiet,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
  },
  timelineSourceText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: P.quiet,
  },
  exit: {
    backgroundColor: P.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
    padding: 16,
  },
  exitTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    color: P.inkOnNight,
    marginBottom: 6,
  },
  exitSub: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: P.quiet,
    marginBottom: 16,
    lineHeight: 20,
  },
  markdownImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    maxHeight: 320,
    marginVertical: 12,
    alignSelf: "center",
  },
});
