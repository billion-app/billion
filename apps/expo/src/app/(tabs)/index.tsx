import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { ContentItem } from "~/utils/content";
import type { FeaturedBillItem } from "~/utils/featured-bills";
import { EmptySearchMark } from "~/components/digest/CraftMarks";
import { DigestHome } from "~/components/DigestHome";
import { ProfileMarkButton } from "~/components/DigestProfileMark";
import { ElectionBanner } from "~/components/ElectionBanner";
import { FeaturedBills } from "~/components/FeaturedBills";
import {
  JurisdictionPicker,
  JurisdictionScopeRow,
} from "~/components/JurisdictionPicker";
import { LanguageButton } from "~/components/LanguageButton";
import { Text } from "~/components/Themed";
import { ContentCard, Icon, Pill, Pills, SearchInput } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useContentJurisdiction } from "~/hooks/useContentJurisdiction";
import { useDebounced } from "~/hooks/useDebounce";
import { isSaveable, useSavedContent } from "~/hooks/useSavedContent";
import { useUserAddress } from "~/hooks/useUserAddress";
import {
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontDisplay,
} from "~/styles";
import { queryClient, trpc, trpcClient } from "~/utils/api";
import { toCardItem } from "~/utils/content";
import { daysUntil, isWithinDays } from "~/utils/dates";
import { electionsAreLive } from "~/utils/elections-live";
import { withoutFeaturedBills } from "~/utils/featured-bills";
import {
  isStateJurisdiction,
  jurisdictionFromAddress,
  jurisdictionText,
} from "~/utils/jurisdiction";

// Below this length a query is treated as "not searching yet" to avoid
// hammering the server-side full-text search on the first keystroke.
const MIN_SEARCH_LENGTH = 2;

const PAGE_SIZE = 20;

type ContentFilter =
  | "bill"
  | "government_content"
  | "court_case"
  | "general"
  | "all";

const FILTERS: { id: ContentFilter }[] = [
  { id: "all" },
  { id: "bill" },
  { id: "government_content" },
  { id: "court_case" },
  { id: "general" },
];

export function BrowseCatalog() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language, t } = useAppTranslation();
  const [selectedFilter, setFilter] = useState<ContentFilter>("all");
  const [query, setQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jurisdictionPickerOpen, setJurisdictionPickerOpen] = useState(false);
  const [railHeld, setRailHeld] = useState(false);
  const refreshInFlight = useRef(false);
  const { jurisdiction, setJurisdiction } = useContentJurisdiction();
  const jurisdictionInfo = jurisdictionText(jurisdiction, language);
  const isState = isStateJurisdiction(jurisdiction);
  const filters = isState
    ? FILTERS.filter((item) => item.id !== "government_content")
    : FILTERS;
  // A federal Executive selection must not issue an unsupported state query.
  const filter =
    isState && selectedFilter === "government_content" ? "all" : selectedFilter;
  const otherJurisdiction = jurisdiction === "federal" ? "ca" : "federal";
  const otherPlace = jurisdictionText(otherJurisdiction, language).name;
  const featuredViews = useRef(new Set<string>());

  const handleFilterChange = (f: ContentFilter) => {
    setFilter(f);
    posthog.capture("content_filter_applied", { filter_type: f });
  };

  const { isSaved, toggleSave } = useSavedContent();

  const openSaved = () => {
    posthog.capture("saved_articles_opened", { source: "browse_header" });
    router.push("/settings/saved-articles" as Href);
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    if (text.trim().length >= 3) {
      posthog.capture("content_searched", {
        query: text.trim(),
        filter_type: filter,
      });
    }
  };

  // Civic ballot lookup is parked with the Elections tab. Do not background-
  // fetch voter info for the Browse banner until voter tools are live.
  const { address, setAddress, clearAddress } = useUserAddress();
  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: address ?? "" }),
    enabled: electionsAreLive() && !!address,
  });
  const election = voterInfoQuery.data?.election;
  const upcomingElection =
    election && isWithinDays(election.electionDay, 30) ? election : undefined;

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.content.getByType.infiniteQueryOptions(
      { type: filter, limit: PAGE_SIZE, jurisdiction },
      {
        initialCursor: 0,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );

  const allItems = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // Server-side full-text search (bill/case codes + title/summary/full text)
  // replaces the old title/description-only client-side Fuse match once the
  // query is long enough to be worth a round trip.
  const debouncedQuery = useDebounced(query, 300);
  const isSearching = debouncedQuery.trim().length >= MIN_SEARCH_LENGTH;
  const showFeatured = !isSearching && (filter === "all" || filter === "bill");
  const featuredQuery = useQuery({
    ...trpc.content.getFeaturedBills.queryOptions({ jurisdiction }),
    enabled: showFeatured,
  });
  const searchQuery = useQuery({
    ...trpc.content.search.queryOptions({
      query: debouncedQuery,
      type: filter,
      jurisdiction,
    }),
    enabled: isSearching,
  });
  const otherSearchQuery = useQuery({
    ...trpc.content.search.queryOptions({
      query: debouncedQuery,
      type: filter,
      jurisdiction: otherJurisdiction,
      limit: 3,
    }),
    enabled: isSearching,
  });

  const featuredBills = useMemo(
    () => (featuredQuery.data ?? []) as FeaturedBillItem[],
    [featuredQuery.data],
  );
  const items = (
    isSearching
      ? (searchQuery.data ?? [])
      : showFeatured
        ? withoutFeaturedBills(allItems, featuredBills)
        : allItems
  ) as ContentItem[];
  const listIsLoading = isSearching ? searchQuery.isLoading : isLoading;
  const listError = isSearching ? searchQuery.error : error;

  useEffect(() => {
    if (!showFeatured || featuredBills.length === 0) return;
    const viewKey = `${jurisdiction}:${filter}`;
    if (featuredViews.current.has(viewKey)) return;
    featuredViews.current.add(viewKey);
    posthog.capture("featured_bills_viewed", {
      jurisdiction,
      filter_type: filter,
      bill_ids: featuredBills.map((item) => item.id),
    });
  }, [featuredBills, filter, jurisdiction, showFeatured]);

  const loadMore = () => {
    if (isSearching) return;
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };

  const handleRefresh = async () => {
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;
    setIsRefreshing(true);

    try {
      if (isSearching) {
        const input = {
          query: debouncedQuery,
          type: filter,
          jurisdiction,
        };
        const refreshedItems = await trpcClient.content.search.query(input);
        queryClient.setQueryData(
          trpc.content.search.queryKey(input),
          refreshedItems,
        );
      } else {
        const input = { type: filter, limit: PAGE_SIZE, jurisdiction };
        const firstPage = await trpcClient.content.getByType.query({
          ...input,
          cursor: 0,
        });
        queryClient.setQueryData(
          trpc.content.getByType.infiniteQueryKey(input),
          {
            pages: [firstPage],
            pageParams: [0],
          },
        );
      }
      if (isSearching) void otherSearchQuery.refetch();
      if (showFeatured) void featuredQuery.refetch();
    } catch {
      Alert.alert(
        t("browse.refreshFailedTitle"),
        t("browse.refreshFailedBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.tryAgain"), onPress: () => void handleRefresh() },
        ],
      );
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: 4,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        directionalLockEnabled
        scrollEnabled={!railHeld}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={DigestPalette.inkOnNight}
          />
        }
        ListHeaderComponent={
          <>
            <View style={s.headerPad}>
              <JurisdictionScopeRow
                jurisdiction={jurisdiction}
                onPress={() => setJurisdictionPickerOpen(true)}
              />
              <View style={s.headerRow}>
                {/* Takes the row's remaining width rather than sizing to its
                    own measurement: the display serif loads asynchronously,
                    and a box measured against the fallback font clips the
                    last glyph once the real face swaps in. */}
                <Text
                  style={[s.display, s.headerTitle]}
                  accessibilityRole="header"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {t("browse.title")}
                </Text>
                <TouchableOpacity
                  style={s.savedBtn}
                  onPress={openSaved}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t("browse.openSaved")}
                  testID="browse-saved"
                >
                  <Icon
                    name="bookmark"
                    size={22}
                    color={DigestPalette.inkOnNight}
                  />
                </TouchableOpacity>
                <LanguageButton compact />
                <ProfileMarkButton menuTop={insets.top + 52} />
              </View>
              <SearchInput
                placeholder={t("browse.search")}
                accessibilityLabel={t("browse.search")}
                value={query}
                onChangeText={handleSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={{ marginTop: 18, marginBottom: 8 }}
              />
            </View>

            <View
              style={s.filterWrap}
              onTouchStart={() => setRailHeld(true)}
              onTouchEnd={() => setRailHeld(false)}
              onTouchCancel={() => setRailHeld(false)}
            >
              <Pills layout="scroll">
                {filters.map((f) => (
                  <Pill
                    key={f.id}
                    label={t(`browse.filter.${f.id}`)}
                    active={filter === f.id}
                    onPress={() => handleFilterChange(f.id)}
                  />
                ))}
              </Pills>
            </View>

            {upcomingElection && (
              <ElectionBanner
                daysUntil={daysUntil(upcomingElection.electionDay)}
                electionName={upcomingElection.name}
                onPress={() => router.push("/elections" as Href)}
              />
            )}

            {showFeatured ? (
              <FeaturedBills
                items={featuredBills}
                loading={featuredQuery.isLoading}
                onLockParent={setRailHeld}
                onOpen={(item, index) => {
                  posthog.capture("featured_bill_opened", {
                    bill_id: item.id,
                    position: index + 1,
                    jurisdiction,
                  });
                  router.push(`/article-detail?id=${item.id}`);
                }}
              />
            ) : null}

            {!listIsLoading && !listError && items.length > 0 && (
              <View style={s.resultsCountWrap}>
                <Text style={s.resultsCount}>
                  {t(
                    isState && jurisdiction !== "ma"
                      ? "browse.billCount"
                      : "browse.resultCount",
                    { count: items.length },
                  )}
                </Text>
              </View>
            )}
          </>
        }
        ItemSeparatorComponent={() => <View style={s.rowRule} />}
        renderItem={({ item }) => (
          <View style={s.cardWrap}>
            <ContentCard
              item={toCardItem(item, { language })}
              saved={isSaved(item.id)}
              onSave={
                isSaveable(item.type)
                  ? () =>
                      toggleSave({
                        id: item.id,
                        type: item.type,
                        title: item.title,
                      })
                  : undefined
              }
              onPress={() => router.push(`/article-detail?id=${item.id}`)}
            />
          </View>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isSearching && (otherSearchQuery.data?.length ?? 0) > 0 ? (
            <View style={s.otherResults}>
              <View style={s.otherResultsHead}>
                <Text style={[s.resultsCount, s.otherResultsCount]}>
                  {t("browse.otherMatches", {
                    count: otherSearchQuery.data?.length ?? 0,
                    place: otherPlace,
                  })}
                </Text>
                <TouchableOpacity
                  style={s.switchButton}
                  onPress={() => {
                    setFilter(filter);
                    void setJurisdiction(otherJurisdiction);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("browse.switchA11y", {
                    place: otherPlace,
                  })}
                >
                  <Text style={s.switchText}>{t("browse.switch")}</Text>
                  <Icon
                    name="chevR"
                    size={15}
                    color={DigestPalette.inkOnNight}
                  />
                </TouchableOpacity>
              </View>
              {(otherSearchQuery.data ?? []).map((item) => (
                <View key={item.id} style={s.otherCard}>
                  <ContentCard
                    item={toCardItem(item, {
                      showJurisdiction: true,
                      language,
                    })}
                    saved={isSaved(item.id)}
                    onSave={
                      isSaveable(item.type)
                        ? () =>
                            toggleSave({
                              id: item.id,
                              type: item.type,
                              title: item.title,
                            })
                        : undefined
                    }
                    onPress={() => router.push(`/article-detail?id=${item.id}`)}
                  />
                </View>
              ))}
            </View>
          ) : !isSearching && isFetchingNextPage ? (
            <ActivityIndicator
              color={DigestPalette.inkOnNight}
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
        ListEmptyComponent={
          listIsLoading ? (
            <ActivityIndicator
              size="large"
              color={DigestPalette.inkOnNight}
              style={{ marginTop: 48 }}
            />
          ) : listError ? (
            <View style={s.center}>
              <Text style={s.emptyTitle} accessibilityRole="header">
                {t("browse.loadFailed", { place: jurisdictionInfo.name })}
              </Text>
              <Text style={s.emptySub}>{t("browse.loadFailedBody")}</Text>
              <TouchableOpacity
                style={s.emptyAction}
                onPress={() => void handleRefresh()}
                accessibilityRole="button"
              >
                <Text style={s.emptyActionText}>{t("common.tryAgain")}</Text>
              </TouchableOpacity>
              {jurisdiction !== "federal" ? (
                <TouchableOpacity
                  onPress={() => void setJurisdiction("federal")}
                  accessibilityRole="button"
                >
                  <Text style={s.switchText}>{t("browse.federalInstead")}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={s.center}>
              <EmptySearchMark width={88} />
              <Text style={s.emptyTitle} accessibilityRole="header">
                {isState && filter === "court_case"
                  ? t("browse.noStateCourt", { place: jurisdictionInfo.name })
                  : isState && jurisdiction !== "ma"
                    ? t(
                        filter === "all"
                          ? "browse.noStateBills"
                          : "browse.noStateRecords",
                        { place: jurisdictionInfo.name },
                      )
                    : jurisdiction === "ma"
                      ? t(
                          filter === "all"
                            ? "browse.noStateRecords"
                            : "browse.noStateMatches",
                          { place: jurisdictionInfo.name },
                        )
                      : isSearching
                        ? t("browse.noMatchFor", { query: query.trim() })
                        : t("browse.nothingFound")}
              </Text>
              <Text style={s.emptySub}>
                {jurisdiction === "ma"
                  ? t("browse.maEmptyBody")
                  : isState
                    ? t("browse.stateEmptyBody", {
                        place: jurisdictionInfo.name,
                      })
                    : t("browse.tryDifferent")}
              </Text>
              {isState &&
              jurisdiction !== "ma" &&
              filter !== "bill" &&
              filter !== "all" ? (
                <TouchableOpacity
                  style={s.emptyAction}
                  onPress={() => handleFilterChange("bill")}
                  accessibilityRole="button"
                >
                  <Text style={s.emptyActionText}>
                    {t("browse.showStateBills", {
                      place: jurisdictionInfo.name,
                    })}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        }
      />
      <JurisdictionPicker
        visible={jurisdictionPickerOpen}
        selected={jurisdiction}
        address={address}
        onClose={() => setJurisdictionPickerOpen(false)}
        onSaveAddress={(next) => {
          void setAddress(next);
          const home = jurisdictionFromAddress(next);
          if (home) void setJurisdiction(home);
        }}
        onClearAddress={() => {
          void clearAddress();
        }}
        onSelect={(next) => {
          void setJurisdiction(next);
          setJurisdictionPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DigestPalette.canvas },
  headerPad: { paddingHorizontal: DigestSpace.screenPadX },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: { flex: 1 },
  savedBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  display: {
    fontFamily: fontDisplay.bold,
    fontSize: 42,
    color: DigestPalette.inkOnNight,
    lineHeight: 46,
    letterSpacing: -1.1,
  },
  filterWrap: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  rowRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DigestHair.sectionRule,
    marginHorizontal: DigestSpace.screenPadX,
  },
  cardWrap: { paddingHorizontal: DigestSpace.screenPadX },
  resultsCountWrap: {
    paddingHorizontal: DigestSpace.screenPadX,
    // Tighten featured→list gap (eggbot card→dots / section rhythm).
    paddingTop: 12,
  },
  resultsCount: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: DigestPalette.quiet,
    marginBottom: 12,
  },
  center: {
    alignItems: "center",
    paddingHorizontal: DigestSpace.screenPadX,
    paddingVertical: 64,
    gap: 8,
  },
  errorText: {
    fontFamily: fontBody.medium,
    fontSize: 16,
    color: DigestPalette.quiet,
  },
  emptyTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    color: DigestPalette.inkOnNight,
  },
  emptySub: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: DigestPalette.quiet,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyAction: {
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 10,
    backgroundColor: DigestHair.tabActivePill,
  },
  emptyActionText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: DigestPalette.inkOnNight,
  },
  otherResults: {
    marginHorizontal: DigestSpace.screenPadX,
    marginTop: 24,
    padding: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: DigestHair.sectionRule,
    borderRadius: DigestRadii.card,
  },
  otherResultsHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  // Long place names (e.g. 加利福尼亚州) wrap instead of pushing Switch off.
  otherResultsCount: { flex: 1, marginBottom: 0 },
  switchButton: { flexDirection: "row", alignItems: "center", gap: 2 },
  switchText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: DigestPalette.inkOnNight,
  },
  otherCard: { marginTop: 12 },
});

export default function BrowseScreen() {
  return <DigestHome />;
}
