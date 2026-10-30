import type { RenderRules } from "@ronradtke/react-native-markdown-display";
import type { LayoutChangeEvent } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Markdown from "@ronradtke/react-native-markdown-display";
import { useQuery } from "@tanstack/react-query";

import type { BillBriefData, BriefQuote } from "~/components/ui";
import type { ShareSurface } from "~/utils/share";
import { LanguageCorner } from "~/components/LanguageButton";
import { ListenBar } from "~/components/ListenBar";
import { ReaderTranslationState } from "~/components/ReaderTranslationState";
import { createRouteErrorBoundary } from "~/components/RouteErrorBoundary";
import { ShareSheet } from "~/components/ShareSheet";
import { Text } from "~/components/Themed";
import { TranslationNotice } from "~/components/TranslationNotice";
import {
  Avatar,
  BillBrief,
  CourtBrief,
  CourtOpinions,
  GhostButton,
  Icon,
  Kicker,
  LensPanel,
  NavHeader,
  PrimaryButton,
  Segmented,
} from "~/components/ui";
import { ArticleOpening } from "~/components/ui/ArticleOpening";
import { BillSummary } from "~/components/ui/BillBrief";
import { BillOverview } from "~/components/ui/BillOverview";
import { CourtProceeding, CourtTakeaway } from "~/components/ui/CourtBrief";
import { readerLegalContext } from "~/components/ui/reader-legal-context";
import { posthog } from "~/config/posthog";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useArticleSpeech } from "~/hooks/useArticleSpeech";
import { useLanguage } from "~/hooks/useLanguage";
import { useReadContent } from "~/hooks/useReadContent";
import { useSavedContent } from "~/hooks/useSavedContent";
import { useScreenshotDetection } from "~/hooks/useScreenshotDetection";
import { useTranslationWait } from "~/hooks/useTranslationWait";
import { translateAppLabel } from "~/i18n/app-strings";
import {
  BillReaderSpace,
  colors,
  contentType,
  darkTheme,
  fontBody,
  fontEditorial,
  getMarkdownStyles,
  hair,
  BillReaderPalette as R,
  resolveType,
  BillReaderType as T,
} from "~/styles";
import { queryClient, trpc } from "~/utils/api";
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
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const articleId = Array.isArray(params.id) ? params.id[0] : params.id;
  // Router can reuse this screen for a new record. Reset the complete reader,
  // including source passages and focused sheets, when its identity changes.
  return <ArticleDetail key={articleId ?? "missing"} articleId={articleId} />;
}

function ArticleDetail({ articleId }: { articleId: string | undefined }) {
  const { t: tx, locale: appLocale } = useAppTranslation();
  const router = useRouter();

  const [mode, setMode] = useState<ArticleMode>("explainer");
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [billDetailsOpen, setBillDetailsOpen] = useState(false);
  const [readerExpanded, setReaderExpanded] = useState(false);
  const [sourceHighlight, setSourceHighlight] = useState<BriefQuote | null>(
    null,
  );
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  // Which surface opened the share sheet, or null when it is closed. The
  // surface is what the share is attributed to, so it is the state.
  const [shareSurface, setShareSurface] = useState<ShareSurface | null>(null);
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

  const isBill = content?.type === "bill";
  const s = readerStyles;
  const textColor = R.text;
  const mutedColor = R.muted;

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

  // Ready translations arrive with the article. Cache misses poll without
  // revealing English prose; original documents and quotations stay verbatim.
  const translationLanguage = language === "en" ? null : language;
  const preparedTranslation = readyReaderTranslation(
    language,
    content?.translationSourceHash,
    content?.translation,
    null,
  );
  const translationOptions = trpc.content.getTranslation.queryOptions({
    id: articleId ?? "__missing__",
    language: translationLanguage ?? "es",
    sourceHash: content?.translationSourceHash,
    supportsMassachusetts: true,
  });
  const cachedTranslation = readyReaderTranslation(
    language,
    content?.translationSourceHash,
    preparedTranslation,
    queryClient.getQueryData(translationOptions.queryKey),
  );
  const translationWait = useTranslationWait(
    content && translationLanguage && !cachedTranslation
      ? `${content.id}:${translationLanguage}:${content.translationSourceHash}`
      : undefined,
  );
  const translationQuery = useQuery({
    ...translationOptions,
    enabled:
      !!articleId &&
      !!content &&
      !!translationLanguage &&
      !preparedTranslation &&
      !translationWait.expired,
    ...translationCachePolicy,
    refetchInterval: translationWait.expired
      ? false
      : translationCachePolicy.refetchInterval,
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

  const hasBillOverview =
    content?.type === "bill" && Boolean(translation?.brief ?? content.brief);
  useFocusEffect(
    useCallback(() => {
      if (!hasBillOverview || (!readerExpanded && mode === "explainer")) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          setReaderExpanded(false);
          setMode("explainer");
          scrollRef.current?.scrollTo({ y: 0, animated: false });
          return true;
        },
      );
      return () => subscription.remove();
    }, [hasBillOverview, mode, readerExpanded]),
  );

  if (isLoading || !isLanguageReady) {
    return (
      <View style={[s.fullCenter, { backgroundColor: R.canvas }]}>
        {isLanguageReady && <LanguageCorner />}
        <ActivityIndicator size="large" color={textColor} />
        {isLanguageReady && (
          <Text style={s.loadingText}>{tr("article.loading")}</Text>
        )}
      </View>
    );
  }

  if (error || !content) {
    return (
      <View style={[s.fullCenter, { backgroundColor: R.canvas }]}>
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
      <ReaderTranslationState
        title={[
          tr(
            content.type === "bill"
              ? "readerUi.type.bill"
              : content.type === "court_case"
                ? "readerUi.type.court"
                : "readerUi.type.exec",
          ),
          content.billNumber,
        ]
          .filter(Boolean)
          .join(" · ")}
        state={
          translationState === "unavailable"
            ? "unavailable"
            : translationWait.expired
              ? "delayed"
              : "pending"
        }
        onRetry={() => {
          translationWait.retry();
          void translationQuery.refetch();
        }}
        onBack={() => router.back()}
      />
    );
  }

  const typeKey = resolveType(content.type);
  const t = {
    ...contentType[typeKey],
    color: R.accent,
  };
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
  const markdownStyles = getMarkdownStyles({
    ...darkTheme,
    foreground: R.reading,
    accent: R.link,
    muted: R.surface,
  });
  Object.assign(markdownStyles.body, T.body);
  Object.assign(markdownStyles.heading1, T.title, {
    color: R.text,
    marginTop: 28,
  });
  Object.assign(markdownStyles.heading2, T.title, {
    color: R.text,
    marginTop: 24,
  });
  Object.assign(markdownStyles.heading3, T.title, {
    fontSize: 17,
    color: R.text,
    marginTop: 20,
  });
  Object.assign(markdownStyles.strong, {
    fontFamily: fontBody.semibold,
    color: R.text,
    fontWeight: "600",
  });
  Object.assign(markdownStyles.blockquote, {
    backgroundColor: "transparent",
    borderLeftWidth: 1,
    borderLeftColor: R.rule,
  });
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
  const storedBrief: BillBriefData | null =
    (translation?.brief as BillBriefData | null | undefined) ??
    ("brief" in content ? (content.brief as BillBriefData | null) : null);
  const brief = storedBrief
    ? {
        ...storedBrief,
        sourceStatus: content.type === "bill" ? content.status : undefined,
        sourceLabel:
          content.type === "bill"
            ? [content.billNumber, content.sourceLabel]
                .filter(Boolean)
                .join(" · ")
            : undefined,
      }
    : null;
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
  const timeline = actions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({
      label: a.text.length > 80 ? a.text.slice(0, 77) + "…" : a.text,
      fullText: a.text,
      date: a.date,
      done: true,
    }));
  const currentTimelineIndex = timeline.length - 1;
  // Actions are the official legislative record from the source (congress.gov).
  const timelineSourceUrl = hasRealActions ? content.url : undefined;
  const sponsor = content.type === "bill" ? content.sponsor : undefined;
  const sourceDate = content.sourceDate;
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

  // Older API deployments may omit dates while the OTA rolls out.
  const articleDates =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    content.createdAt && content.updatedAt ? (
      <View style={[s.dates, isBill && s.billDates]} testID="article-dates">
        <Text style={s.articleDate}>
          {tr(
            sourceDate
              ? `article.${sourceDate.kind}`
              : introducedDate
                ? "article.introduced"
                : "article.created",
          )}{" "}
          {formatArticleDate(
            sourceDate?.date ?? introducedDate ?? content.createdAt,
            dateLocale,
            sourceDate?.timeZone ?? "UTC",
          )}
        </Text>
        <Text style={s.articleDate}>
          {tr("article.updated")}{" "}
          {formatArticleDate(content.updatedAt, dateLocale)}
        </Text>
      </View>
    ) : null;

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <NavHeader
        compact
        tone="reader"
        title={typeLabel}
        onBack={() => {
          if (hasBillOverview && (readerExpanded || mode !== "explainer")) {
            setReaderExpanded(false);
            setMode("explainer");
            scrollRef.current?.scrollTo({ y: 0, animated: false });
          } else router.back();
        }}
        action={
          <>
            {speech.available ? (
              <TouchableOpacity
                onPress={handleListen}
                style={s.headerAction}
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
                  color={speech.status === "idle" ? mutedColor : t.color}
                />
              </TouchableOpacity>
            ) : null}
            <>
              <TouchableOpacity
                onPress={() => setShareSurface("article_header")}
                style={s.headerAction}
                accessibilityRole="button"
                accessibilityLabel={tr("article.share")}
                testID="article-share"
              >
                <Icon name="share" size={20} color={mutedColor} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleToggleSave}
                style={s.headerAction}
                accessibilityRole="button"
                accessibilityLabel={
                  saved ? tr("article.unsave") : tr("article.save")
                }
                testID="article-save"
              >
                <Icon
                  name={saved ? "bookmarkFill" : "bookmark"}
                  size={21}
                  color={saved ? textColor : mutedColor}
                />
              </TouchableOpacity>
            </>
          </>
        }
      />

      {translationLanguage && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <TranslationNotice
            state={mode === "source" ? "source" : translationState}
            onRetry={() => {
              translationWait.retry();
              void translationQuery.refetch();
            }}
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
        {isBill && brief && mode === "explainer" && !readerExpanded ? (
          <BillOverview
            data={brief}
            officialTitle={displayTitle}
            billNumber={displayBillNumber}
            imageSource={headerImageSource}
            onJump={(y, animated) =>
              scrollRef.current?.scrollTo({ y, animated })
            }
            onRead={() => {
              setReaderExpanded(true);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
            onDetails={() => {
              setReaderExpanded(true);
              setBillDetailsOpen(true);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
            onOriginal={() => {
              handleModeChange("source");
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
            onViewSource={handleViewSource}
          />
        ) : (
          <>
            <ArticleOpening
              title={isBill ? (brief?.headline ?? displayTitle) : displayTitle}
              imageSource={headerImageSource}
              imageCredit={
                headerImageUri?.includes("/content-images/content/")
                  ? tr("readerUi.aiIllustration")
                  : undefined
              }
              metadata={
                <>
                  <Text style={s.readerBadgeText}>{typeLabel}</Text>
                  {courtBrief ? <CourtProceeding data={courtBrief} /> : null}
                  {displayBillNumber ? (
                    <Text style={s.billNumber} testID="article-bill-number">
                      {displayBillNumber}
                    </Text>
                  ) : null}
                  {isBill && brief ? (
                    <Text style={s.readerLegalStatus}>
                      {tr(
                        readerLegalContext(
                          brief.legalStatus,
                          brief.sourceStatus,
                        ).statusKey,
                      )}
                    </Text>
                  ) : null}
                  {isStateBill ? (
                    <Text style={s.jurisdictionLine}>
                      {jurisdictionText(content.jurisdiction, language).body}
                      {content.sessionLabel
                        ? ` · ${translateSessionLabel(content.sessionLabel, language)}`
                        : ""}
                    </Text>
                  ) : null}
                </>
              }
            />

            {isBill && brief && mode === "explainer" ? (
              <BillSummary
                summary={brief.summary}
                text={brief.hook}
                legalStatus={brief.legalStatus}
                accent={R.link}
                compact
              />
            ) : null}
            {mode === "explainer" && courtBrief ? (
              <CourtTakeaway
                data={courtBrief}
                showStatus={false}
                accent={R.link}
                onViewSource={handleViewSource}
              />
            ) : null}
            {displayDescription && !(isBill && brief) && !courtBrief ? (
              <Text style={s.desc} testID="article-description">
                {displayDescription}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={() => setBillDetailsOpen((value) => !value)}
              style={s.billDetailsToggle}
              accessibilityRole="button"
              accessibilityState={{ expanded: billDetailsOpen }}
              testID="bill-details-toggle"
            >
              <Text style={s.billDetailsLabel}>
                {tr(isBill ? "readerUi.billDetails" : "article.details")}
              </Text>
              <Icon
                name={billDetailsOpen ? "minus" : "chevD"}
                size={15}
                color={R.muted}
              />
            </TouchableOpacity>
            {billDetailsOpen ? (
              <>
                {articleDates}

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
                      size={32}
                    />
                    <View style={s.sponsorBody}>
                      <Text style={s.sponsorLabel}>
                        {tr("article.sponsoredBy")}
                      </Text>
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
                            ? tx("District {value1}", {
                                value1: sponsor.district,
                              })
                            : sponsor.state,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    <Icon name="chevR" size={17} color={mutedColor} />
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}

            {/* explainer / source toggle */}
            <View
              style={{
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              <Segmented
                appearance="underline"
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
                  ...(content.type === "court_case" &&
                  courtBrief?.opinions.length
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
                style={[s.disclaimer, s.billDisclaimer]}
                activeOpacity={0.72}
                onPress={() => setProvenanceOpen((value) => !value)}
                accessibilityRole="button"
                accessibilityState={{ expanded: provenanceOpen }}
                accessibilityLabel={
                  provenanceOpen ? tr("readerUi.hideAI") : tr("readerUi.showAI")
                }
              >
                <View style={s.disclaimerBody}>
                  <View style={s.disclaimerHead}>
                    <Text style={s.disclaimerTitle}>
                      {tr("readerUi.billionAi")}
                    </Text>
                    <Text style={[s.disclaimerAction, { color: R.link }]}>
                      {provenanceOpen
                        ? tr("article.hide")
                        : tr("article.details")}
                    </Text>
                    <View style={provenanceOpen ? s.chevFlip : undefined}>
                      <Icon name="chevD" size={14} color={R.link} />
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
                style={{
                  marginBottom: 18,
                  backgroundColor: R.accent,
                }}
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
                  showTakeaway={false}
                  accent={R.link}
                  dualLens={
                    lensData ? <LensPanel data={lensData} reader /> : null
                  }
                  onViewSource={handleViewSource}
                  includeOpinions={!courtBrief.opinions.length}
                />
              ) : mode === "opinions" && courtBrief ? (
                <CourtOpinions
                  data={courtBrief}
                  accent={R.link}
                  onViewSource={handleViewSource}
                />
              ) : mode === "explainer" && brief ? (
                <BillBrief
                  data={brief}
                  showSummary={!isBill}
                  accent={R.link}
                  dualLens={
                    lensData ? <LensPanel data={lensData} reader /> : null
                  }
                  onViewSource={handleViewSource}
                />
              ) : mode === "source" && sourceHighlight ? (
                <HighlightedSource
                  content={content.originalContent}
                  quote={sourceHighlight}
                  accent={R.link}
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
                <LensPanel data={lensData} reader />
              </View>
            )}

            {/* Legislative stages apply only to bills. Court posture lives in its brief. */}
            {content.type === "bill" && hasRealActions ? (
              <>
                <Kicker style={s.timelineKicker}>
                  {tr("article.whereItStands")}
                </Kicker>
                <View style={{ marginBottom: 24 }}>
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
                                {
                                  backgroundColor: step.done
                                    ? t.color
                                    : hair[2],
                                },
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
                                  color: step.done ? textColor : mutedColor,
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
                                color={mutedColor}
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
                      <Icon name="info" size={13} color={mutedColor} />
                      <Text style={s.timelineSourceText}>
                        {tr("readerUi.officialRecord")} ·{" "}
                        {("sourceLabel" in content
                          ? translateAppLabel(language, content.sourceLabel)
                          : undefined) ?? "congress.gov"}
                      </Text>
                      <Icon name="chevR" size={12} color={mutedColor} />
                    </TouchableOpacity>
                  )}
                </View>
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
          </>
        )}
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
  const s = readerStyles;
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

function createArticleStyles() {
  const text = R.text;
  const muted = R.muted;
  const canvas = R.canvas;
  const surface = R.wash;
  const ink = R.canvas;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: canvas },
    fullCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    loadingText: {
      fontFamily: "AlbertSans-Regular",
      marginTop: 16,
      color: muted,
    },
    errorTitle: {
      fontFamily: "InriaSerif-Bold",
      fontSize: 18,
      color: colors.red[500],
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: BillReaderSpace.page,
      paddingBottom: 40,
    },
    headerAction: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    readerLegalStatus: {
      fontFamily: fontBody.semibold,
      fontSize: 15,
      color: R.text,
      letterSpacing: 0.7,
    },
    billDetailsToggle: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    billDetailsLabel: {
      fontFamily: fontBody.medium,
      fontSize: 15,
      color: R.muted,
    },

    readerBadgeText: {
      fontFamily: fontBody.semibold,
      color: R.secondary,
      fontSize: 15,
      letterSpacing: 0.8,
    },
    billNumber: {
      fontFamily: fontBody.semibold,
      fontSize: 15,
      letterSpacing: 0.3,
      color: R.text,
    },
    jurisdictionLine: {
      fontFamily: fontBody.medium,
      fontSize: 15,
      lineHeight: 22,
      color: R.text,
      flexBasis: "100%",
      marginTop: 4,
    },
    dates: { gap: 4, marginBottom: 16 },
    billDates: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: 12,
      rowGap: 3,
      marginBottom: 12,
    },
    articleDate: {
      fontFamily: fontBody.medium,
      fontSize: 15,
      lineHeight: 22,
      color: muted,
    },
    desc: {
      fontFamily: "AlbertSans-Regular",
      fontSize: 16,
      color: R.reading,
      lineHeight: 24,
      marginBottom: 12,
    },

    sponsorCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
      paddingVertical: 8,
    },
    sponsorBody: { flex: 1, gap: 1 },
    sponsorLabel: {
      fontFamily: fontBody.medium,
      fontSize: 15,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: muted,
    },
    sponsorName: {
      fontFamily: fontBody.semibold,
      fontSize: 15,
      color: text,
    },
    sponsorMeta: {
      fontFamily: fontBody.regular,
      fontSize: 15,
      color: muted,
    },
    disclaimer: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: hair[2],
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 14,
      marginBottom: 18,
    },
    billDisclaimer: {
      backgroundColor: "transparent",
      borderWidth: 0,
      borderRadius: 0,
      paddingVertical: 10,
      paddingHorizontal: 0,
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
      fontSize: 15,
      lineHeight: 22,
      color: muted,
    },
    disclaimerTitle: {
      flex: 1,
      fontFamily: fontBody.medium,
      fontSize: 15,
      lineHeight: 22,
      color: R.reading,
    },
    disclaimerAction: {
      fontFamily: fontBody.semibold,
      fontSize: 15,
    },
    disclaimerText: {
      fontFamily: "AlbertSans-Regular",
      fontSize: 15,
      color: R.reading,
      lineHeight: 22,
    },
    chevFlip: { transform: [{ rotate: "180deg" }] },
    sourcePanel: {
      backgroundColor: ink,
      borderTopWidth: 1,
      borderTopColor: R.rule,
      paddingTop: 24,
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
      color: text,
    },
    sourceDocumentMeta: {
      fontFamily: fontBody.medium,
      fontSize: 15,
      color: muted,
    },
    sourceText: {
      fontFamily: fontBody.regular,
      fontSize: 15,
      lineHeight: 25,
      color: R.reading,
    },
    sourceHighlight: {
      borderLeftWidth: 3,
      borderRadius: 10,
      padding: 14,
      gap: 6,
    },
    sourceHighlightLabel: {
      fontFamily: fontBody.semibold,
      fontSize: 15,
      letterSpacing: 0.9,
    },
    sourceHighlightText: {
      fontFamily: fontEditorial.bold,
      fontSize: 17,
      lineHeight: 25,
      color: text,
    },
    plainText: {
      fontFamily: "AlbertSans-Regular",
      fontSize: 16.5,
      lineHeight: 27,
      color: R.reading,
    },
    timelineRow: { flexDirection: "row", gap: 12 },
    timelineKicker: { marginTop: 30 },
    timelineMarker: { alignItems: "center" },
    timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
    timelineLine: { width: 2, flex: 1, minHeight: 22 },
    timelineBody: { flex: 1, paddingBottom: 14 },
    timelineDate: {
      fontFamily: fontBody.medium,
      fontSize: 15,
      letterSpacing: 0.3,
      color: muted,
      marginBottom: 2,
    },
    timelineLabelRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
    },
    timelineLabel: { flex: 1, fontSize: 15, lineHeight: 19 },
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
      fontSize: 15,
      color: muted,
    },
    exit: {
      borderTopWidth: 1,
      borderTopColor: R.rule,
      paddingVertical: 24,
      marginTop: 24,
    },
    exitTitle: {
      ...T.title,
      color: text,
      marginBottom: 6,
    },
    exitSub: {
      fontFamily: "AlbertSans-Regular",
      fontSize: 15,
      color: muted,
      marginBottom: 16,
      lineHeight: 22,
    },
    markdownImage: {
      width: "100%",
      minHeight: 180,
      maxHeight: 320,
      marginVertical: 12,
      alignSelf: "center",
    },
  });
}
const readerStyles = createArticleStyles();
