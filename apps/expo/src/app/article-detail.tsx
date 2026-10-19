import type { RenderRules } from "@ronradtke/react-native-markdown-display";
import type { LayoutChangeEvent } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Markdown from "@ronradtke/react-native-markdown-display";
import { useQuery } from "@tanstack/react-query";

import type { BillBriefData, BriefQuote } from "~/components/ui";
import type { ShareSurface } from "~/utils/share";
import { LanguageCorner } from "~/components/LanguageButton";
import { ListenBar } from "~/components/ListenBar";
import { createRouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { ShareSheet } from "~/components/ShareSheet";
import { Text } from "~/components/Themed";
import { TranslationNotice } from "~/components/TranslationNotice";
import {
  Avatar,
  Badge,
  BillBrief,
  Card,
  CourtBrief,
  CourtOpinions,
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
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useArticleSpeech } from "~/hooks/useArticleSpeech";
import { useLanguage } from "~/hooks/useLanguage";
import { useReadContent } from "~/hooks/useReadContent";
import { useSavedContent } from "~/hooks/useSavedContent";
import { useScreenshotDetection } from "~/hooks/useScreenshotDetection";
import { translateAppLabel } from "~/i18n/app-strings";
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
import { translateSessionLabel } from "~/utils/card-metadata";
import { formatArticleDate, formatDate } from "~/utils/dates";
import { contentImageSource } from "~/utils/editorial-visuals";
import { governmentContentLabel } from "~/utils/government-content";
import { isStateJurisdiction, jurisdictionText } from "~/utils/jurisdiction";
import { findSourcePassage } from "~/utils/source-passage";
import { buildSpeechChunks } from "~/utils/speech-script";
import {
  articleTranslationState,
  readyReaderTranslation,
  translationCachePolicy,
} from "~/utils/translation-cache";

export const ErrorBoundary = createRouteErrorBoundary("article-detail");

type ArticleMode = "explainer" | "opinions" | "source";

export default function ArticleDetailScreen() {
  const { t: tx, locale: appLocale } = useAppTranslation();

  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const articleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [mode, setMode] = useState<ArticleMode>("explainer");
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

  const handleModeChange = (newMode: ArticleMode) => {
    setSourceHighlight(null);
    setMode(newMode);
    posthog.capture("article_view_mode_toggled", {
      content_id: articleId ?? null,
      content_type: content?.type ?? null,
      new_mode: newMode,
    });
  };

  const { language, t: tr, isReady: isLanguageReady } = useLanguage();
  const {
    data: content,
    isLoading,
    error,
    refetch: refetchContent,
  } = useQuery({
    ...trpc.content.getById.queryOptions({
      id: articleId ?? "__missing__",
      language,
      supportsMassachusetts: true,
    }),
    enabled: !!articleId && isLanguageReady,
  });

  useEffect(() => {
    if (content && isLanguageReady) {
      posthog.capture("article_viewed", {
        content_id: content.id,
        content_type: content.type,
        content_title: content.title,
        is_ai_generated: content.isAIGenerated,
      });
    }
  }, [content, isLanguageReady]);
  const headerImageUri = content?.imageUri ?? content?.thumbnailUrl;
  const headerImageSource = content
    ? contentImageSource(headerImageUri)
    : undefined;
  const headerImageKey = content
    ? `${content.title}:${headerImageUri ?? "local"}`
    : undefined;

  // Ready translations arrive with the article. Cache misses poll without
  // revealing English prose; original documents and quotations stay verbatim.
  const translationLanguage = language === "en" ? null : language;
  const preparedTranslation = readyReaderTranslation(
    language,
    content?.translationSourceHash,
    content?.translation,
    null,
  );
  const translationQuery = useQuery({
    ...trpc.content.getTranslation.queryOptions({
      id: articleId ?? "__missing__",
      language: translationLanguage ?? "es",
      sourceHash: content?.translationSourceHash,
      supportsMassachusetts: true,
    }),
    enabled:
      !!articleId && !!content && !!translationLanguage && !preparedTranslation,
    ...translationCachePolicy,
  });
  useEffect(() => {
    if (translationQuery.data?.status === "stale") void refetchContent();
  }, [translationQuery.data, refetchContent]);
  const translation = readyReaderTranslation(
    language,
    content?.translationSourceHash,
    preparedTranslation,
    translationQuery.data,
  );
  const translationState = articleTranslationState(
    !!translationLanguage,
    !!translation,
    translationQuery,
  );

  const { markRead } = useReadContent();
  const loadedArticleId =
    !error && isLanguageReady && (!translationLanguage || translation)
      ? content?.id
      : undefined;
  useEffect(() => {
    // Failed requests and cards merely seen on Home are not reads.
    if (loadedArticleId) markRead(loadedArticleId);
  }, [loadedArticleId, markRead]);

  const speechLanguage =
    mode !== "source" &&
    translation &&
    (translation.brief ?? translation.courtBrief ?? translation.articleContent)
      ? translation.language
      : "en";
  // Narration follows the selected section, with context for listening.
  const speechChunks = useMemo(() => {
    if (
      !isLanguageReady ||
      !content ||
      (translationLanguage && !translation && mode !== "source")
    )
      return [];
    if (mode === "source") {
      return buildSpeechChunks({
        title: content.title,
        mode,
        body: content.originalContent,
      });
    }
    return buildSpeechChunks({
      mode,
      isAIGenerated: content.isAIGenerated,
      language: speechLanguage,
      title:
        speechLanguage === "en"
          ? content.title
          : (translation?.title ?? content.title),
      description: translation?.description ?? content.description,
      brief:
        translation?.brief ??
        ("brief" in content ? (content.brief as BillBriefData | null) : null),
      courtBrief:
        translation?.courtBrief ??
        (content.type === "court_case" ? content.courtBrief : null),
      body: translation?.articleContent ?? content.articleContent,
    });
  }, [
    content,
    translation,
    translationLanguage,
    mode,
    speechLanguage,
    isLanguageReady,
  ]);
  const speech = useArticleSpeech({
    chunks: speechChunks,
    language: speechLanguage,
    mode,
    contentId: content?.id,
  });
  const stopSpeech = speech.stop;
  useFocusEffect(useCallback(() => stopSpeech, [stopSpeech]));

  const handleListen = () => {
    if (speech.status === "idle") speech.play();
    else if (speech.status === "playing") speech.pause();
    else speech.resume();
  };

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

  if (isLoading || !isLanguageReady) {
    return (
      <View style={[s.fullCenter, { backgroundColor: planes.navy }]}>
        {isLanguageReady && <LanguageCorner />}
        <ActivityIndicator size="large" color={colors.white} />
        {isLanguageReady && (
          <Text style={s.loadingText}>{tr("article.loading")}</Text>
        )}
      </View>
    );
  }

  if (error || !content) {
    return (
      <View style={[s.fullCenter, { backgroundColor: planes.navy }]}>
        <LanguageCorner />
        <Text style={s.errorTitle}>
          {error ? tr("article.loadFailed") : tr("article.notFound")}
        </Text>
        <PrimaryButton
          label={tr("common.goBack")}
          onPress={() => router.back()}
          style={{ width: 160, marginTop: 16 }}
        />
      </View>
    );
  }

  if (translationLanguage && !translation) {
    return (
      <View style={[s.fullCenter, { backgroundColor: planes.navy }]}>
        <LanguageCorner />
        <View style={{ width: "100%", maxWidth: 480, paddingHorizontal: 24 }}>
          <TranslationNotice
            state={translationState}
            onRetry={() => void translationQuery.refetch()}
            hideEnglish
          />
          <PrimaryButton
            label={tr("common.goBack")}
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          />
        </View>
      </View>
    );
  }

  const typeKey = resolveType(content.type);
  const t = contentType[typeKey];
  const typeLabel =
    content.type === "government_content"
      ? governmentContentLabel(
          content.governmentContentType,
          language,
        ).toUpperCase()
      : tr(`readerUi.type.${typeKey}`);
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

  const officialUrl =
    "officialUrl" in content ? content.officialUrl : undefined;
  const sourceUrl = officialUrl ?? content.url;
  const independentCourtSource =
    content.type === "court_case" &&
    sourceUrl.startsWith("https://ecourtrecords.org/");
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
      document_id: quote.documentId ?? null,
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

  // Bill and court briefs keep their own types; older records retain the explainer.
  const brief: BillBriefData | null =
    (translation?.brief as BillBriefData | null | undefined) ??
    ("brief" in content ? (content.brief as BillBriefData | null) : null);
  const courtBrief =
    translation?.courtBrief ??
    (content.type === "court_case" ? content.courtBrief : null);
  const lensData = translation?.lensData ?? content.lensData;
  const displayTitle = translation?.title ?? content.title;
  const displayDescription = translation?.description ?? content.description;
  const dateLocale =
    language === "es" ? "es-US" : language === "zh" ? "zh-CN" : appLocale;
  const hasBrief = Boolean(brief ?? courtBrief);

  const rawContent =
    mode === "source"
      ? content.originalContent
      : (translation?.articleContent ?? content.articleContent);
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

  const originalActions = ("actions" in content ? content.actions : []) as {
    date: string;
    text: string;
  }[];
  const actions = (translation?.actions ?? originalActions) as {
    date: string;
    text: string;
  }[];
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
          label: tr("readerUi.introduced"),
          fullText: "",
          date: "",
          done: true,
        },
        {
          label: tr("readerUi.committee"),
          fullText: "",
          date: "",
          done: true,
        },
        {
          label: tr("readerUi.latestAction"),
          fullText: "",
          date: "",
          done: true,
        },
        {
          label: tr("readerUi.becomesLaw"),
          fullText: "",
          date: "",
          done: false,
        },
      ];
  const currentTimelineIndex = hasRealActions ? timeline.length - 1 : 2;
  // Actions are the official legislative record from the source (congress.gov).
  const timelineSourceUrl = hasRealActions ? content.url : undefined;
  const sponsor = content.type === "bill" ? content.sponsor : undefined;
  const introducedDate =
    content.type === "bill" ? content.introducedDate : undefined;
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
        title={typeLabel}
        onBack={() => router.back()}
        action={
          <>
            {speech.available ? (
              <TouchableOpacity
                onPress={handleListen}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  speech.status === "playing"
                    ? tr("listen.pause")
                    : speech.status === "paused"
                      ? tr("listen.resume")
                      : tr("listen.start")
                }
                testID="article-listen"
              >
                <Icon
                  name="headphones"
                  size={20}
                  color={
                    speech.status === "idle" ? colors.textSecondary : t.color
                  }
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => setShareSurface("article_header")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={tr("article.share")}
              testID="article-share"
            >
              <Icon name="share" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleToggleSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                saved ? tr("article.unsave") : tr("article.save")
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

      {translationLanguage && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <TranslationNotice
            state={mode === "source" ? "source" : translationState}
            onRetry={() => void translationQuery.refetch()}
          />
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
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
              accessibilityLabel={tr("readerUi.headerImage", {
                title: displayTitle,
              })}
            />
          </View>
        ) : (
          <Placeholder
            label={tr("readerUi.headerArt", {
              type: typeLabel,
            })}
            height={170}
            radius={16}
            style={{ marginBottom: 18 }}
          />
        )}

        <View style={s.badgeRow}>
          <Badge type={typeKey}>{typeLabel}</Badge>
          {displayBillNumber ? (
            <Text style={s.billNumber} testID="article-bill-number">
              {displayBillNumber}
            </Text>
          ) : null}
        </View>

        {isStateBill ? (
          <Text style={s.jurisdictionLine}>
            {jurisdictionText(content.jurisdiction, language).body}
            {content.sessionLabel
              ? ` · ${translateSessionLabel(content.sessionLabel, language)}`
              : ""}
          </Text>
        ) : null}

        <Text style={s.title} testID="article-title">
          {displayTitle}
        </Text>

        {/* Older API deployments may omit dates while the OTA rolls out. */}
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {content.createdAt && content.updatedAt ? (
          <View style={{ gap: 4, marginBottom: 16 }} testID="article-dates">
            <Text style={s.articleDate}>
              {tr(introducedDate ? "article.introduced" : "article.created")}{" "}
              {formatArticleDate(
                introducedDate ?? content.createdAt,
                dateLocale,
              )}
            </Text>
            <Text style={s.articleDate}>
              {tr("article.updated")}{" "}
              {formatArticleDate(content.updatedAt, dateLocale)}
            </Text>
          </View>
        ) : null}

        {displayDescription ? (
          <Text style={s.desc} testID="article-description">
            {displayDescription}
          </Text>
        ) : null}

        {sponsor ? (
          <TouchableOpacity
            style={s.sponsorCard}
            activeOpacity={0.75}
            onPress={openSponsorProfile}
            accessibilityRole="button"
            accessibilityLabel={tr("readerUi.sponsorProfile", {
              name: sponsor.name,
            })}
            testID="bill-sponsor-card"
          >
            <Avatar
              name={sponsor.initials}
              imageUri={sponsor.imageUrl}
              size={44}
            />
            <View style={s.sponsorBody}>
              <Text style={s.sponsorLabel}>{tr("article.sponsoredBy")}</Text>
              <Text style={s.sponsorName} numberOfLines={1}>
                {sponsor.name}
              </Text>
              <Text style={s.sponsorMeta} numberOfLines={1}>
                {[
                  translateAppLabel(language, sponsor.role),
                  sponsor.party
                    ? translateAppLabel(language, sponsor.party)
                    : undefined,
                  isStateBill && sponsor.district
                    ? tx("District {value1}", { value1: sponsor.district })
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
                label:
                  content.type === "court_case"
                    ? tr("article.caseBrief")
                    : hasBrief
                      ? tr("article.theBrief")
                      : tr("article.plainExplainer"),
                icon: "sparkle",
              },
              ...(content.type === "court_case" && courtBrief?.opinions.length
                ? ([
                    {
                      id: "opinions",
                      label: tr("article.opinions"),
                      icon: "message",
                    },
                  ] as const)
                : []),
              {
                id: "source",
                label:
                  content.type === "court_case"
                    ? tr("article.courtRecord")
                    : tr("article.originalText"),
                icon: "doc",
              },
            ]}
          />
        </View>

        {mode !== "source" && (
          <TouchableOpacity
            style={s.disclaimer}
            activeOpacity={0.72}
            onPress={() => setProvenanceOpen((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: provenanceOpen }}
            accessibilityLabel={
              provenanceOpen ? tr("readerUi.hideAI") : tr("readerUi.showAI")
            }
          >
            <Icon name="sparkle" size={17} color={t.color} />
            <View style={s.disclaimerBody}>
              <View style={s.disclaimerHead}>
                <Text style={s.disclaimerTitle}>{tr("article.writtenBy")}</Text>
                <Text style={[s.disclaimerAction, { color: t.color }]}>
                  {provenanceOpen ? tr("article.hide") : tr("article.details")}
                </Text>
                <View style={provenanceOpen ? s.chevFlip : undefined}>
                  <Icon name="chevD" size={14} color={t.color} />
                </View>
              </View>
              {provenanceOpen ? (
                <Text style={s.disclaimerText}>
                  {tr(
                    hasBrief
                      ? "readerUi.provenanceBrief"
                      : "readerUi.provenanceArticle",
                    {
                      mode: tr(
                        content.type === "court_case"
                          ? "article.courtRecord"
                          : "article.originalText",
                      ),
                    },
                  )}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}

        {mode === "source" && sourceUrl && (
          <PrimaryButton
            label={
              content.type === "court_case"
                ? independentCourtSource
                  ? tr("readerUi.openArchive")
                  : tr("readerUi.openCourt")
                : officialUrl
                  ? tr("readerUi.openFederal")
                  : tr("readerUi.openOriginal")
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
          {mode === "explainer" && courtBrief ? (
            <CourtBrief
              data={courtBrief}
              accent={t.color}
              dualLens={lensData ? <LensPanel data={lensData} /> : null}
              onViewSource={handleViewSource}
              includeOpinions={!courtBrief.opinions.length}
            />
          ) : mode === "opinions" && courtBrief ? (
            <CourtOpinions
              data={courtBrief}
              accent={t.color}
              onViewSource={handleViewSource}
            />
          ) : mode === "explainer" && brief ? (
            <BillBrief
              data={brief}
              accent={t.color}
              dualLens={lensData ? <LensPanel data={lensData} /> : null}
              onViewSource={handleViewSource}
            />
          ) : mode === "source" && sourceHighlight ? (
            <HighlightedSource
              content={content.originalContent}
              quote={sourceHighlight}
              accent={t.color}
              title={tr(
                content.type === "court_case"
                  ? "article.courtRecord"
                  : "article.originalText",
              )}
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
        {mode === "explainer" && lensData && !brief && !courtBrief && (
          <View style={{ marginVertical: 24 }}>
            <LensPanel data={lensData} />
          </View>
        )}

        {/* Legislative stages apply only to bills. Court posture lives in its brief. */}
        {content.type === "bill" ? (
          <>
            <Kicker style={s.timelineKicker}>
              {tr("article.whereItStands")}
            </Kicker>
            <Card style={{ marginBottom: 24 }}>
              {timeline.map((step, i) => {
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
                            borderColor: step.done ? t.color : hair[3],
                            backgroundColor: isCurrent
                              ? t.color
                              : "transparent",
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
                        <Text style={s.timelineDate}>
                          {formatDate(step.date, dateLocale)}
                        </Text>
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
                    {tr("readerUi.officialRecord")} ·{" "}
                    {("sourceLabel" in content
                      ? translateAppLabel(language, content.sourceLabel)
                      : undefined) ?? "congress.gov"}
                  </Text>
                  <Icon name="chevR" size={12} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </Card>
          </>
        ) : null}

        {/* The explainer ends by handing the reader back to the official
            record. The source tab already has that action at the top. */}
        {mode === "explainer" ? (
          <View style={s.exit}>
            <Text style={s.exitTitle}>
              {content.type === "court_case"
                ? tr("article.checkCourtRecord")
                : tr("article.dontTakeOurWord")}
            </Text>
            <Text style={s.exitSub}>
              {content.type === "court_case"
                ? independentCourtSource
                  ? tr("readerUi.archiveExit")
                  : tr("readerUi.courtExit")
                : tr("article.dontTakeOurWordSub")}
            </Text>
            <PrimaryButton
              label={
                content.type === "court_case"
                  ? independentCourtSource
                    ? tr("readerUi.openArchive")
                    : tr("readerUi.openCourt")
                  : tr("article.openSource")
              }
              icon="external"
              onPress={handleOpenOriginal}
            />
            {content.type !== "court_case" ? (
              <GhostButton
                label={tr("article.viewRelated")}
                onPress={handleOpenOriginal}
                style={{ width: "100%", marginTop: 6 }}
              />
            ) : null}
          </View>
        ) : null}
        {speech.status !== "idle" ? <View style={{ height: 76 }} /> : null}
      </ScrollView>

      {speech.error && (
        <Text accessibilityRole="alert" style={s.translationNoteText}>
          {tr("listen.error")}
        </Text>
      )}
      <ListenBar
        status={speech.status}
        index={speech.index}
        total={speech.total}
        accent={t.color}
        onPause={speech.pause}
        onResume={speech.resume}
        onStop={speech.stop}
      />

      {shareSurface ? (
        <ShareSheet
          visible
          onClose={() => setShareSurface(null)}
          contentId={content.id}
          contentType={content.type}
          contentTitle={displayTitle}
          thumbnailUrl={
            headerImageSource ? (headerImageUri ?? undefined) : undefined
          }
          surface={shareSurface}
          accent={t.color}
          heading={
            shareSurface === "screenshot"
              ? tr("readerUi.shareTitle")
              : undefined
          }
          subheading={
            shareSurface === "screenshot" ? tr("readerUi.shareNote") : undefined
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
  title,
  onTargetLayout,
}: {
  content: string;
  quote: BriefQuote;
  accent: string;
  title: string;
  onTargetLayout: (event: LayoutChangeEvent) => void;
}) {
  const { t: tr } = useLanguage();
  const { found, before, match, after } = findSourcePassage(
    content,
    quote.text,
    quote.documentId,
  );

  return (
    <View style={s.highlightedSource}>
      <View style={s.sourceDocumentHead}>
        <View
          style={[s.sourceDocumentIcon, { backgroundColor: `${accent}28` }]}
        >
          <Icon name="doc" size={15} color={accent} />
        </View>
        <View style={s.sourceDocumentHeadCopy}>
          <Text style={s.sourceDocumentTitle}>{title}</Text>
          <Text style={s.sourceDocumentMeta}>
            {quote.locator
              ? `${tr("readerUi.highlighted")} · ${quote.locator}`
              : tr("readerUi.highlighted")}
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
          {found ? tr("readerUi.matching") : tr("readerUi.cited")}
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
  articleDate: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
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
  translationNoteText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
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
