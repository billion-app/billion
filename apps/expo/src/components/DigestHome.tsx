import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { AppLanguage } from "~/i18n/language";
import type { RouterOutputs } from "~/utils/api";
import type { StateJurisdiction } from "~/utils/jurisdiction";
import type { ChangeItem } from "~/utils/what-changed";
import { CAPITOL_LINE } from "~/components/digest/staticAssets";
import { DigestGreetingBar } from "~/components/DigestGreetingBar";
import { GoldFoilText } from "~/components/GoldBillionMark";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useCardTranslationPolling } from "~/hooks/useCardTranslationPolling";
import { useContentJurisdiction } from "~/hooks/useContentJurisdiction";
import { useIdleBallotPreloading } from "~/hooks/useIdleBallotPreloading";
import { useLastVisit } from "~/hooks/useLastVisit";
import { useOnboarding } from "~/hooks/useOnboarding";
import { useReadContent } from "~/hooks/useReadContent";
import { useSavedContent } from "~/hooks/useSavedContent";
import { useUserAddress } from "~/hooks/useUserAddress";
import { fontBody, fontDisplay, DigestPalette as P } from "~/styles";
import { trpc } from "~/utils/api";
import { translateCardMetadata } from "~/utils/card-metadata";
import { PUBLIC_CONTENT_STALE_TIME } from "~/utils/card-translation";
import { contentImageSource } from "~/utils/editorial-visuals";
import {
  isStateJurisdiction,
  jurisdictionFromAddress,
  JURISDICTIONS,
  jurisdictionText,
} from "~/utils/jurisdiction";
import { visibleArticles } from "~/utils/read-content";
import { BRIEF_MAX, changeConnection } from "~/utils/what-changed";
import { CardTranslationNotice } from "./CardTranslationNotice";

const CANVAS = P.night;
const CARD = P.card;
const INK = P.inkOnNight;
const MUTED = P.quiet;
const NAVY = P.night;
const SPARK = P.spark;
const PAPER = P.paper;

/** Local rail snap: card width + rail gap (keep in sync with styles). */
const RAIL_CARD_WIDTH = 334;
const RAIL_CARD_HEIGHT = 350;
const RAIL_GAP = 12;
const RAIL_INSET = 16;
const ALSO_PAGE_SIZE = 12;

/** Design-only cover art — not content fixtures. */
const CAPITOL = CAPITOL_LINE;

type FeaturedBill = RouterOutputs["content"]["getFeaturedBills"][number];
type FeedItem = RouterOutputs["content"]["getByType"]["items"][number];
type DigestCard = FeaturedBill | FeedItem;

function jurisdictionLabel(item: DigestCard, language: AppLanguage): string {
  if (item.jurisdiction && item.jurisdiction in JURISDICTIONS) {
    return jurisdictionText(item.jurisdiction, language).name;
  }
  return jurisdictionText("federal", language).name;
}

function sourceLabel(item: DigestCard, language: AppLanguage): string {
  if (language !== "en" && item.type === "bill" && item.jurisdiction)
    return jurisdictionText(item.jurisdiction, language).body;
  if (
    "sourceLabel" in item &&
    typeof item.sourceLabel === "string" &&
    item.sourceLabel
  ) {
    return item.sourceLabel;
  }
  return jurisdictionLabel(item, language);
}

function cardKicker(item: DigestCard, language: AppLanguage): string {
  const place = jurisdictionLabel(item, language);
  if (item.billNumber) return `${place} · ${item.billNumber}`;
  return place;
}

function cardDek(item: DigestCard): string {
  if (
    "featureTakeaway" in item &&
    typeof item.featureTakeaway === "string" &&
    item.featureTakeaway.trim()
  ) {
    return item.featureTakeaway.trim();
  }
  return item.description.trim() || "";
}

function coverMeta(item: DigestCard, language: AppLanguage): string {
  const parts = [
    item.billNumber,
    translateCardMetadata(item.chamber, language),
  ].filter(Boolean);
  return parts.length > 0
    ? parts.join(" · ")
    : jurisdictionLabel(item, language);
}

function asChangeItem(item: DigestCard): ChangeItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    billNumber: item.billNumber,
    billStatus: "billStatus" in item ? item.billStatus : undefined,
    activityAt: "activityAt" in item ? item.activityAt : undefined,
    jurisdiction: item.jurisdiction,
    featureTakeaway:
      "featureTakeaway" in item && typeof item.featureTakeaway === "string"
        ? item.featureTakeaway
        : undefined,
  };
}

export function DigestHome() {
  const { t: tx, language } = useAppTranslation();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { address } = useUserAddress();
  const { jurisdiction: browseJurisdiction } = useContentJurisdiction();
  const onboarding = useOnboarding();
  const { savedIds } = useSavedContent();
  const { readHistory, isLoading: readHistoryLoading } = useReadContent();
  const lastVisitAt = useLastVisit();
  const savedIdSet = useMemo(() => new Set(savedIds), [savedIds]);

  // Local rail follows saved address → Browse state preference → CA fallback.
  // Also Today stays federal. Read articles remain for 24 hours.
  const localJurisdiction = useMemo((): StateJurisdiction => {
    const fromAddress = jurisdictionFromAddress(address ?? null);
    if (fromAddress) return fromAddress;
    if (isStateJurisdiction(browseJurisdiction)) return browseJurisdiction;
    return "ca";
  }, [address, browseJurisdiction]);
  const localPlace = jurisdictionText(localJurisdiction, language).name;

  // Prefer featured state bills. Massachusetts uses the mixed recent feed so
  // its court dockets remain visible alongside legislative measures.
  // Home has no digest.getToday — this is the featured/local set, not a
  // fabricated daily ranking.
  const featuredLocal = useQuery({
    ...trpc.content.getFeaturedBills.queryOptions({
      jurisdiction: localJurisdiction,
      language,
    }),
    enabled: localJurisdiction !== "ma",
    staleTime: PUBLIC_CONTENT_STALE_TIME,
  });
  const featuredEmpty =
    !featuredLocal.isLoading && (featuredLocal.data?.length ?? 0) === 0;
  const localFeed = useQuery({
    ...trpc.content.getByType.queryOptions({
      type: localJurisdiction === "ma" ? "all" : "bill",
      limit: BRIEF_MAX,
      jurisdiction: localJurisdiction,
      language,
    }),
    enabled: featuredEmpty || !!featuredLocal.error,
    staleTime: PUBLIC_CONTENT_STALE_TIME,
  });

  const featuredFederal = useQuery(
    trpc.content.getFeaturedBills.queryOptions(
      { jurisdiction: "federal", language },
      { staleTime: PUBLIC_CONTENT_STALE_TIME },
    ),
  );
  const {
    data: federalFeed,
    refetch: refetchFederalFeed,
    error: federalFeedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: federalFeedLoading,
  } = useInfiniteQuery(
    trpc.content.getByType.infiniteQueryOptions(
      {
        type: "bill",
        limit: ALSO_PAGE_SIZE,
        jurisdiction: "federal",
        language,
      },
      {
        initialCursor: 0,
        staleTime: PUBLIC_CONTENT_STALE_TIME,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );

  const localTranslations = useCardTranslationPolling({
    data: featuredLocal.data,
    language,
    refetch: featuredLocal.refetch,
    enabled: localJurisdiction !== "ma",
  });
  const localFeedTranslations = useCardTranslationPolling({
    data: localFeed.data,
    language,
    refetch: localFeed.refetch,
    enabled: featuredEmpty || !!featuredLocal.error,
  });
  const federalTranslations = useCardTranslationPolling({
    data: featuredFederal.data,
    language,
    refetch: featuredFederal.refetch,
  });
  const federalFeedTranslations = useCardTranslationPolling({
    data: federalFeed,
    language,
    refetch: refetchFederalFeed,
  });

  const localCards = useMemo((): DigestCard[] => {
    const featured = featuredLocal.data;
    const all =
      featured && featured.length > 0
        ? featured
        : (localFeed.data?.items ?? []);
    return all.slice(0, BRIEF_MAX);
  }, [featuredLocal.data, localFeed.data]);

  const alsoCards = useMemo((): DigestCard[] => {
    const featured = featuredFederal.data ?? [];
    const articles = federalFeed?.pages.flatMap((page) => page.items) ?? [];
    return visibleArticles<DigestCard>([...featured, ...articles], readHistory);
  }, [featuredFederal.data, federalFeed?.pages, readHistory]);

  const changeContext = useMemo(
    () => ({
      savedIds: savedIdSet,
      vectors: onboarding.vectors,
      place: localPlace,
      lastVisitAt,
    }),
    [lastVisitAt, localPlace, onboarding.vectors, savedIdSet],
  );

  const localLoading =
    featuredLocal.isLoading || (featuredEmpty && localFeed.isLoading);
  const localError =
    !localLoading &&
    localCards.length === 0 &&
    !!localFeed.error &&
    (featuredEmpty || !!featuredLocal.error);
  const coverLoading =
    readHistoryLoading || featuredFederal.isLoading || federalFeedLoading;
  const preloading = useIdleBallotPreloading({
    enabled: !localLoading && !coverLoading,
  });
  const coverError =
    !coverLoading &&
    alsoCards.length === 0 &&
    !!federalFeedError &&
    !!featuredFederal.error;

  const loadMoreArticles = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const onFeedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - contentOffset.y - layoutMeasurement.height;
      if (distanceFromBottom < 600) loadMoreArticles();
    },
    [loadMoreArticles],
  );

  // If a fetched page is entirely past the 24-hour read window, keep paging
  // until there is something to render or the federal feed is exhausted.
  useEffect(() => {
    if (!coverLoading && alsoCards.length === 0) loadMoreArticles();
  }, [alsoCards.length, coverLoading, loadMoreArticles]);

  const openArticle = (id: string) => {
    router.push(`/article-detail?id=${id}`);
  };

  const { width: windowWidth } = useWindowDimensions();
  const railCardWidth = Math.min(RAIL_CARD_WIDTH, windowWidth - RAIL_INSET * 2);
  const railSnap = railCardWidth + RAIL_GAP;

  const [railIndex, setRailIndex] = useState(0);
  const railIndexRef = useRef(0);
  const [railHeld, setRailHeld] = useState(false);

  const indexFromOffset = useCallback(
    (offsetX: number) => {
      if (localCards.length === 0) return 0;
      return Math.max(
        0,
        Math.min(localCards.length - 1, Math.round(offsetX / railSnap)),
      );
    },
    [localCards.length, railSnap],
  );

  const onRailScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = indexFromOffset(e.nativeEvent.contentOffset.x);
      if (next === railIndexRef.current) return;
      railIndexRef.current = next;
      setRailIndex(next);
    },
    [indexFromOffset],
  );

  // Explicit offsets beat snapToInterval when content has leading inset —
  // interval math alone can mis-align and desync railIndex vs visible card.
  // Prefer margins over `gap`: gap has historically desynced snap math on iOS.
  const railSnapOffsets = useMemo(
    () => localCards.map((_, i) => i * railSnap),
    [localCards, railSnap],
  );

  // Enough trailing pad that the last card can rest on its snap offset.
  const railTrailingPad = Math.max(
    RAIL_INSET,
    windowWidth - RAIL_INSET - railCardWidth,
  );

  return (
    <View
      style={s.screen}
      onTouchStart={preloading.onTouchStart}
      onTouchEnd={preloading.onTouchEnd}
      onTouchCancel={preloading.onTouchCancel}
    >
      <DigestGreetingBar stageReady={!localLoading} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={!railHeld}
        directionalLockEnabled
        scrollEnabled={!railHeld}
        onScrollBeginDrag={preloading.onScrollBegin}
        onScrollEndDrag={preloading.onScrollEndDrag}
        onMomentumScrollBegin={preloading.onScrollBegin}
        onMomentumScrollEnd={preloading.onMomentumScrollEnd}
        onScroll={onFeedScroll}
        scrollEventThrottle={200}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        <View style={s.sectionHead}>
          <GoldFoilText text={tx("THE DAILY BRIEF")} style={s.sectionEyebrow} />
          <Text style={s.sectionTitle}>{tx("Today’s local news")}</Text>
          <View style={s.sectionRule} />
        </View>

        <CardTranslationNotice
          isError={
            !!featuredLocal.error ||
            !!localFeed.error ||
            !!featuredFederal.error ||
            !!federalFeedError ||
            localTranslations.isError ||
            localFeedTranslations.isError ||
            federalTranslations.isError ||
            federalFeedTranslations.isError
          }
          items={[...localCards, ...alsoCards]}
          onRetry={() => {
            localTranslations.retry();
            localFeedTranslations.retry();
            federalTranslations.retry();
            federalFeedTranslations.retry();
          }}
        />
        {localLoading ? (
          <ActivityIndicator
            color={MUTED}
            style={{ marginVertical: 36 }}
            accessibilityLabel={tx("Loading local records")}
          />
        ) : localError ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>{tx("Local records didn’t load")}</Text>
            <Text style={s.emptySub}>{tx("Try again in a moment.")}</Text>
          </View>
        ) : localCards.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>
              {localJurisdiction === "ma"
                ? tx("No Massachusetts records yet")
                : tx("No featured local bills yet")}
            </Text>
            <Text style={s.emptySub}>
              {tx("Check Browse for the full {value1} record.", {
                value1: localPlace,
              })}
            </Text>
          </View>
        ) : (
          <>
            {/* Featured rail: one card size, snap, dots. */}
            <View
              onTouchStart={() => setRailHeld(true)}
              onTouchEnd={() => setRailHeld(false)}
              onTouchCancel={() => setRailHeld(false)}
            >
              <ScrollView
                horizontal
                nestedScrollEnabled
                directionalLockEnabled
                alwaysBounceVertical={false}
                alwaysBounceHorizontal
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToOffsets={railSnapOffsets}
                snapToAlignment="start"
                disableIntervalMomentum
                contentContainerStyle={[
                  s.rail,
                  { paddingRight: railTrailingPad },
                ]}
                style={[s.railScroll, { height: RAIL_CARD_HEIGHT }]}
                onScroll={onRailScroll}
                scrollEventThrottle={16}
                onScrollBeginDrag={preloading.onScrollBegin}
                onMomentumScrollBegin={preloading.onScrollBegin}
                onScrollEndDrag={() => {
                  setRailHeld(false);
                  preloading.onScrollEndDrag();
                }}
                onMomentumScrollEnd={() => {
                  setRailHeld(false);
                  preloading.onMomentumScrollEnd();
                }}
              >
                {localCards.map((card, index) => {
                  const img = contentImageSource(
                    card.imageUri ?? card.thumbnailUrl,
                  );
                  const isLast = index === localCards.length - 1;
                  return (
                    <Pressable
                      key={card.id}
                      style={[
                        s.card,
                        { width: railCardWidth },
                        !isLast ? s.cardGap : null,
                      ]}
                      onPress={() => openArticle(card.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${cardKicker(card, language)}. ${card.title}`}
                    >
                      <View style={s.photo}>
                        {img ? (
                          <Image
                            source={img}
                            style={s.photoImg}
                            contentFit="cover"
                            accessibilityLabel=""
                          />
                        ) : (
                          <View style={[s.photoImg, s.photoFallback]}>
                            <Text style={s.photoFallbackCode}>
                              {card.jurisdictionCode ??
                                (isStateJurisdiction(card.jurisdiction)
                                  ? JURISDICTIONS[card.jurisdiction].code
                                  : "CA")}
                            </Text>
                          </View>
                        )}
                        <View style={s.srcPill}>
                          <Text style={s.srcText}>
                            {sourceLabel(card, language)}
                          </Text>
                        </View>
                      </View>
                      <View style={s.cardBody}>
                        <Text style={s.kicker} numberOfLines={1}>
                          {cardKicker(card, language)}
                        </Text>
                        <Text style={s.cardTitle} numberOfLines={2}>
                          {card.title}
                        </Text>
                        {cardDek(card) ? (
                          <Text style={s.dek} numberOfLines={2}>
                            {cardDek(card)}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={s.dots}>
                {localCards.slice(0, BRIEF_MAX).map((card, i) => (
                  <View
                    key={card.id}
                    style={[s.dot, i === railIndex ? s.dotOn : null]}
                  />
                ))}
              </View>
            </View>
          </>
        )}

        <View style={s.sectionHeadAlso}>
          <Text style={s.alsoTitle}>{tx("Also today")}</Text>
          <View style={s.alsoRule} />
        </View>

        <View style={s.alsoWrap}>
          {coverLoading ? (
            <ActivityIndicator
              color={MUTED}
              style={{ marginVertical: 28 }}
              accessibilityLabel={tx("Loading unread articles")}
            />
          ) : coverError ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTitle}>{tx("Articles didn’t load")}</Text>
              <Text style={s.emptySub}>{tx("Try again in a moment.")}</Text>
            </View>
          ) : alsoCards.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTitle}>{tx("No new articles today")}</Text>
              <Text style={s.emptySub}>
                {tx("Check Browse for the full federal feed.")}
              </Text>
            </View>
          ) : (
            alsoCards.map((coverItem) => {
              const coverConnection = changeConnection(
                asChangeItem(coverItem),
                changeContext,
                language,
              );
              return (
                <Pressable
                  key={coverItem.id}
                  style={s.alsoCard}
                  onPress={() => openArticle(coverItem.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${coverMeta(coverItem, language)}. ${coverItem.title}`}
                >
                  <View style={s.cover}>
                    <GoldFoilText
                      text={tx("COVER · CONGRESS")}
                      style={s.coverKicker}
                    />
                    <View style={s.coverRule} />
                    <View style={s.coverGrid}>
                      <View style={s.coverCopy}>
                        <Text style={s.coverHeadline}>{coverItem.title}</Text>
                        {cardDek(coverItem) ? (
                          <Text
                            style={s.coverDek}
                            numberOfLines={3}
                            ellipsizeMode="tail"
                          >
                            {cardDek(coverItem)}
                          </Text>
                        ) : null}
                        <Text style={s.coverMeta}>
                          {coverMeta(coverItem, language)}
                        </Text>
                        {coverConnection ? (
                          <Text style={s.coverConnection}>
                            {coverConnection}
                          </Text>
                        ) : null}
                      </View>
                      {contentImageSource(
                        coverItem.imageUri ?? coverItem.thumbnailUrl,
                      ) ? (
                        <Image
                          source={contentImageSource(
                            coverItem.imageUri ?? coverItem.thumbnailUrl,
                          )}
                          style={s.coverArt}
                          contentFit="cover"
                          accessibilityLabel=""
                        />
                      ) : (
                        <Image
                          source={CAPITOL}
                          style={s.coverArt}
                          contentFit="contain"
                          accessibilityLabel={tx("U.S. Capitol line art")}
                        />
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
          {isFetchingNextPage ? (
            <ActivityIndicator
              color={MUTED}
              style={s.alsoLoader}
              accessibilityLabel={tx("Loading more articles")}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CANVAS,
    position: "relative",
    overflow: "hidden",
  },
  sectionHead: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionEyebrow: {
    fontFamily: fontBody.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 2.1,
    color: SPARK,
    marginBottom: 8,
  },
  sectionHeadAlso: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 29,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: INK,
  },
  sectionRule: {
    height: 1,
    backgroundColor: "rgba(247,244,238,0.16)",
    marginTop: 14,
    width: "100%",
  },
  alsoTitle: {
    fontFamily: fontBody.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: INK,
  },
  alsoRule: {
    height: 1,
    flex: 1,
    backgroundColor: "rgba(247,244,238,0.16)",
    marginLeft: 12,
  },
  rail: {
    paddingLeft: RAIL_INSET,
    paddingBottom: 0,
    alignItems: "flex-start",
  },
  railScroll: {
    flexGrow: 0,
  },
  card: {
    width: RAIL_CARD_WIDTH,
    height: RAIL_CARD_HEIGHT,
    backgroundColor: CARD,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(247,244,238,0.08)",
    overflow: "hidden",
    alignSelf: "flex-start",
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 0,
  },
  cardGap: {
    marginRight: RAIL_GAP,
  },
  photo: {
    position: "relative",
  },
  photoImg: {
    width: "100%",
    height: 190,
    backgroundColor: NAVY,
  },
  photoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  photoFallbackCode: {
    fontFamily: fontBody.bold,
    fontSize: 22,
    letterSpacing: 1.2,
    color: MUTED,
  },
  srcPill: {
    position: "absolute",
    left: 14,
    bottom: 14,
    backgroundColor: PAPER,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  srcText: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.35,
    color: P.ink,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  kicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.15,
    color: MUTED,
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.45,
    color: INK,
    marginBottom: 8,
  },
  dek: {
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: INK,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 22,
    paddingBottom: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: MUTED,
  },
  dotOn: {
    width: 14,
    backgroundColor: SPARK,
  },
  alsoWrap: {
    paddingHorizontal: 16,
  },
  alsoCard: {
    marginBottom: 12,
    backgroundColor: CARD,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(247,244,238,0.10)",
    overflow: "hidden",
  },
  alsoLoader: {
    marginVertical: 20,
  },
  cover: {
    backgroundColor: CARD,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  coverKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    /* Gold is reserved for selected state (active tab, active dot). */
    color: SPARK,
    marginBottom: 12,
  },
  coverRule: {
    height: 1,
    backgroundColor: "rgba(247,244,238,0.14)",
    marginBottom: 16,
  },
  coverGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  coverCopy: {
    flex: 1.15,
    paddingBottom: 0,
  },
  coverHeadline: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.45,
    color: P.inkOnNight,
    marginBottom: 4,
  },
  coverMeta: {
    fontFamily: fontBody.regular,
    fontSize: 11,
    color: MUTED,
  },
  coverDek: {
    marginTop: 4,
    marginBottom: 8,
    fontFamily: fontBody.medium,
    fontSize: 14,
    lineHeight: 20,
    color: INK,
  },
  coverConnection: {
    marginTop: 6,
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: MUTED,
  },
  coverArt: {
    flex: 0.85,
    width: 116,
    height: 138,
    borderRadius: 8,
  },
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    color: INK,
  },
  emptySub: {
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: INK,
  },
});
