import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import type { StateJurisdiction } from "~/utils/jurisdiction";
import type { ChangeItem } from "~/utils/what-changed";
import { BillProgressRail } from "~/components/digest/BillProgressRail";
import { CAPITOL_LINE } from "~/components/digest/staticAssets";
import { DigestGreetingBar } from "~/components/DigestGreetingBar";
import { useContentJurisdiction } from "~/hooks/useContentJurisdiction";
import { useLastVisit } from "~/hooks/useLastVisit";
import { useOnboarding } from "~/hooks/useOnboarding";
import { useSavedContent } from "~/hooks/useSavedContent";
import { useUserAddress } from "~/hooks/useUserAddress";
import { fontBody, fontDisplay, DigestPalette as P } from "~/styles";
import { trpc } from "~/utils/api";
import { contentImageSource } from "~/utils/editorial-visuals";
import {
  isStateJurisdiction,
  jurisdictionFromAddress,
  JURISDICTIONS,
} from "~/utils/jurisdiction";
import { relativeActivity } from "~/utils/relative-activity";
import {
  BRIEF_MAX,
  changeConnection,
  toChangeLine,
} from "~/utils/what-changed";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CANVAS = P.night;
const CARD = P.card;
const INK = P.inkOnNight;
const MUTED = P.quiet;
const NAVY = P.night;
const SPARK = P.spark;
const PAPER = P.paper;

/** Local rail snap: card width + rail gap (keep in sync with styles). */
const RAIL_CARD_WIDTH = 334;
const RAIL_GAP = 12;
const RAIL_INSET = 16;
const RAIL_SNAP = RAIL_CARD_WIDTH + RAIL_GAP;

/** Design-only cover art — not content fixtures. */
const CAPITOL = CAPITOL_LINE;

type FeaturedBill = RouterOutputs["content"]["getFeaturedBills"][number];
type FeedItem = RouterOutputs["content"]["getByType"]["items"][number];
type DigestCard = FeaturedBill | FeedItem;

function jurisdictionLabel(item: DigestCard): string {
  if (item.jurisdiction && item.jurisdiction in JURISDICTIONS) {
    return JURISDICTIONS[item.jurisdiction].name;
  }
  return "United States";
}

function sourceLabel(item: DigestCard): string {
  if (
    "sourceLabel" in item &&
    typeof item.sourceLabel === "string" &&
    item.sourceLabel
  ) {
    return item.sourceLabel;
  }
  return jurisdictionLabel(item);
}

function cardKicker(item: DigestCard): string {
  const place = jurisdictionLabel(item);
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

function coverMeta(item: DigestCard): string {
  const parts = [item.billNumber, item.chamber].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : jurisdictionLabel(item);
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { address } = useUserAddress();
  const { jurisdiction: browseJurisdiction } = useContentJurisdiction();
  const onboarding = useOnboarding();
  const { savedIds } = useSavedContent();
  const lastVisitAt = useLastVisit();
  const savedIdSet = useMemo(() => new Set(savedIds), [savedIds]);

  // Local rail follows saved address → Browse state preference → CA fallback.
  // Federal cover stays federal (Also Today).
  const localJurisdiction = useMemo((): StateJurisdiction => {
    const fromAddress = jurisdictionFromAddress(address ?? null);
    if (fromAddress) return fromAddress;
    if (isStateJurisdiction(browseJurisdiction)) return browseJurisdiction;
    return "ca";
  }, [address, browseJurisdiction]);
  const localPlace = JURISDICTIONS[localJurisdiction].name;

  // Prefer featured for the local rail; fall back to typed state bills.
  // Home has no digest.getToday — this is the featured/local set, not a
  // fabricated daily ranking.
  const featuredLocal = useQuery(
    trpc.content.getFeaturedBills.queryOptions({
      jurisdiction: localJurisdiction,
    }),
  );
  const featuredEmpty =
    !featuredLocal.isLoading && (featuredLocal.data?.length ?? 0) === 0;
  const localFeed = useQuery({
    ...trpc.content.getByType.queryOptions({
      type: "bill",
      limit: BRIEF_MAX,
      jurisdiction: localJurisdiction,
    }),
    enabled: featuredEmpty || !!featuredLocal.error,
  });

  const featuredFederal = useQuery(
    trpc.content.getFeaturedBills.queryOptions({ jurisdiction: "federal" }),
  );
  const federalEmpty =
    !featuredFederal.isLoading && (featuredFederal.data?.length ?? 0) === 0;
  const federalFeed = useQuery({
    ...trpc.content.getByType.queryOptions({
      type: "bill",
      limit: 3,
      jurisdiction: "federal",
    }),
    enabled: federalEmpty || !!featuredFederal.error,
  });

  const localCards = useMemo((): DigestCard[] => {
    const featured = featuredLocal.data;
    const all =
      featured && featured.length > 0
        ? featured
        : (localFeed.data?.items ?? []);
    return all.slice(0, BRIEF_MAX);
  }, [featuredLocal.data, localFeed.data]);

  const coverItem = useMemo((): DigestCard | undefined => {
    const featured = featuredFederal.data;
    if (featured && featured.length > 0) return featured[0];
    return federalFeed.data?.items[0];
  }, [featuredFederal.data, federalFeed.data]);

  const changeContext = useMemo(
    () => ({
      savedIds: savedIdSet,
      vectors: onboarding.vectors,
      place: localPlace,
      lastVisitAt,
    }),
    [lastVisitAt, localPlace, onboarding.vectors, savedIdSet],
  );

  const coverConnection = coverItem
    ? changeConnection(asChangeItem(coverItem), changeContext)
    : undefined;

  const localLoading =
    featuredLocal.isLoading || (featuredEmpty && localFeed.isLoading);
  const localError =
    !localLoading &&
    localCards.length === 0 &&
    !!localFeed.error &&
    (featuredEmpty || !!featuredLocal.error);
  const coverLoading =
    featuredFederal.isLoading || (federalEmpty && federalFeed.isLoading);
  const coverError =
    !coverLoading &&
    !coverItem &&
    !!federalFeed.error &&
    (federalEmpty || !!featuredFederal.error);

  const openArticle = (id: string) => {
    router.push(`/article-detail?id=${id}`);
  };

  const { width: windowWidth } = useWindowDimensions();

  // Dynamic rail height = active card only (short deks must not leave dead navy
  // above pagination dots — ScrollView otherwise sizes to tallest sibling).
  // Height only settles after momentum ends so mid-swipe layout jumps don't
  // fight the pan gesture.
  const [railIndex, setRailIndex] = useState(0);
  const [railHeight, setRailHeight] = useState<number | undefined>(undefined);
  const railHeightsRef = useRef<Record<number, number>>({});
  const railIndexRef = useRef(0);

  const applyRailHeight = useCallback((index: number, animate: boolean) => {
    const h = railHeightsRef.current[index];
    if (h == null) return;
    setRailHeight((prev) => {
      if (prev === h) return prev;
      if (animate && prev != null) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      return h;
    });
  }, []);

  const onRailCardLayout = useCallback(
    (index: number, e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (!h) return;
      const prev = railHeightsRef.current[index];
      if (prev === h) return;
      railHeightsRef.current[index] = h;
      if (index === railIndexRef.current) applyRailHeight(index, false);
    },
    [applyRailHeight],
  );

  const indexFromOffset = useCallback(
    (offsetX: number) => {
      if (localCards.length === 0) return 0;
      return Math.max(
        0,
        Math.min(localCards.length - 1, Math.round(offsetX / RAIL_SNAP)),
      );
    },
    [localCards.length],
  );

  // Dots track the finger; height waits until the snap settles.
  const onRailScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = indexFromOffset(e.nativeEvent.contentOffset.x);
      if (next === railIndexRef.current) return;
      railIndexRef.current = next;
      setRailIndex(next);
    },
    [indexFromOffset],
  );

  const onRailSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = indexFromOffset(e.nativeEvent.contentOffset.x);
      railIndexRef.current = next;
      setRailIndex(next);
      applyRailHeight(next, true);
    },
    [applyRailHeight, indexFromOffset],
  );

  // Only settle height when the drag ends without a fling; otherwise wait for
  // momentum so we don't animate to an intermediate card mid-swipe.
  const onRailScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const vx = e.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(vx) < 0.05) onRailSettle(e);
    },
    [onRailSettle],
  );

  // Explicit offsets beat snapToInterval when content has leading inset —
  // interval math alone can mis-align and desync railIndex vs visible card.
  // Prefer margins over `gap`: gap has historically desynced snap math on iOS.
  const railSnapOffsets = useMemo(
    () => localCards.map((_, i) => i * RAIL_SNAP),
    [localCards],
  );

  // Enough trailing pad that the last card can rest on its snap offset.
  const railTrailingPad = Math.max(
    RAIL_INSET,
    windowWidth - RAIL_INSET - RAIL_CARD_WIDTH,
  );

  return (
    <View style={s.screen}>
      <DigestGreetingBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        <View style={s.sectionHead}>
          <Text style={s.sectionEyebrow}>THE DAILY BRIEF</Text>
          <Text style={s.sectionTitle}>Today’s local news</Text>
          <View style={s.sectionRule} />
        </View>

        {localLoading ? (
          <ActivityIndicator
            color={MUTED}
            style={{ marginVertical: 36 }}
            accessibilityLabel="Loading local bills"
          />
        ) : localError ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>Local bills didn’t load</Text>
            <Text style={s.emptySub}>Try again in a moment.</Text>
          </View>
        ) : localCards.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>No featured local bills yet</Text>
            <Text style={s.emptySub}>
              Check Browse for the full {localPlace} record.
            </Text>
          </View>
        ) : (
          <>
            {/* Fixed-height H-scroll (active card) + dots in normal flow.
                Avoid absolute positioning — it steals/fights nested pans. */}
            <View>
              <ScrollView
                horizontal
                nestedScrollEnabled
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToOffsets={railSnapOffsets}
                snapToAlignment="start"
                disableIntervalMomentum
                contentContainerStyle={[
                  s.rail,
                  { paddingRight: railTrailingPad },
                ]}
                style={[s.railScroll, { height: railHeight ?? 360 }]}
                onScroll={onRailScroll}
                onMomentumScrollEnd={onRailSettle}
                onScrollEndDrag={onRailScrollEndDrag}
                scrollEventThrottle={16}
              >
                {localCards.map((card, index) => {
                  const img = contentImageSource(
                    card.imageUri ?? card.thumbnailUrl,
                  );
                  const isLast = index === localCards.length - 1;
                  const change = asChangeItem(card);
                  const line = toChangeLine(change, changeContext);
                  const activity = relativeActivity(change.activityAt);
                  return (
                    <Pressable
                      key={card.id}
                      style={[s.card, !isLast ? s.cardGap : null]}
                      onLayout={(e) => onRailCardLayout(index, e)}
                      onPress={() => openArticle(card.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${cardKicker(card)}. ${card.title}`}
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
                          <Text style={s.srcText}>{sourceLabel(card)}</Text>
                        </View>
                      </View>
                      <View style={s.cardBody}>
                        <Text style={s.kicker}>{cardKicker(card)}</Text>
                        <Text style={s.cardTitle}>{card.title}</Text>
                        {cardDek(card) ? (
                          <Text style={s.dek} numberOfLines={3}>
                            {cardDek(card)}
                          </Text>
                        ) : null}
                        {line.connection ? (
                          <Text style={s.connection}>{line.connection}</Text>
                        ) : null}
                        {card.type === "bill" && card.billStatus ? (
                          <BillProgressRail
                            compact
                            status={card.billStatus}
                            jurisdiction={card.jurisdiction}
                            updatedLabel={
                              activity === "today" ? "Updated today" : undefined
                            }
                          />
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
          <Text style={s.alsoTitle}>Also today</Text>
          <View style={s.alsoRule} />
        </View>

        <View style={s.alsoWrap}>
          {coverLoading ? (
            <ActivityIndicator
              color={MUTED}
              style={{ marginVertical: 28 }}
              accessibilityLabel="Loading federal cover"
            />
          ) : coverError ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTitle}>Federal cover didn’t load</Text>
              <Text style={s.emptySub}>Try again in a moment.</Text>
            </View>
          ) : !coverItem ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTitle}>No federal cover yet</Text>
              <Text style={s.emptySub}>
                Check Browse for the full federal feed.
              </Text>
            </View>
          ) : (
            <Pressable
              style={s.alsoCard}
              onPress={() => openArticle(coverItem.id)}
              accessibilityRole="button"
              accessibilityLabel={`${coverMeta(coverItem)}. ${coverItem.title}`}
            >
              <View style={s.cover}>
                <Text style={s.coverKicker}>COVER · CONGRESS</Text>
                <View style={s.coverRule} />
                <View style={s.coverGrid}>
                  <View style={s.coverCopy}>
                    <Text style={s.coverHeadline}>{coverItem.title}</Text>
                    <Text style={s.coverMeta}>{coverMeta(coverItem)}</Text>
                    {coverConnection ? (
                      <Text style={s.coverConnection}>{coverConnection}</Text>
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
                      accessibilityLabel="U.S. Capitol line art"
                    />
                  )}
                </View>
              </View>
            </Pressable>
          )}
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
    color: MUTED,
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
  // Explicit height on the H-scroll — do NOT stretch to tallest sibling.
  railScroll: {
    flexGrow: 0,
  },
  card: {
    width: RAIL_CARD_WIDTH,
    backgroundColor: CARD,
    borderRadius: 24,
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
  },
  srcText: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 0.35,
    color: P.ink,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
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
    color: MUTED,
  },
  connection: {
    marginTop: 8,
    fontFamily: fontBody.medium,
    fontSize: 12,
    letterSpacing: 0.2,
    color: MUTED,
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
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(247,244,238,0.10)",
    overflow: "hidden",
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
    color: MUTED,
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
    color: MUTED,
  },
});
