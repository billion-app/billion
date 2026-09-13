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
import { Text } from "~/components/Themed";
import { ContentCard, Icon, Pill, Pills, SearchInput } from "~/components/ui";
import { posthog } from "~/config/posthog";
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
import { withoutFeaturedBills } from "~/utils/featured-bills";
import { isStateJurisdiction, JURISDICTIONS } from "~/utils/jurisdiction";

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

const FILTERS: { id: ContentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bill", label: "Bills" },
  { id: "government_content", label: "Executive" },
  { id: "court_case", label: "Courts" },
  { id: "general", label: "Briefings" },
];

export function BrowseCatalog() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<ContentFilter>("all");
  const [query, setQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jurisdictionPickerOpen, setJurisdictionPickerOpen] = useState(false);
  const refreshInFlight = useRef(false);
  const { jurisdiction, setJurisdiction } = useContentJurisdiction();
  const jurisdictionInfo = JURISDICTIONS[jurisdiction];
  const isState = isStateJurisdiction(jurisdiction);
  const otherJurisdiction = jurisdiction === "federal" ? "ca" : "federal";
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

  // Derive the banner from the user's actual location, not the nationwide
  // election list (which surfaced out-of-state elections like "North Dakota
  // Primary"). Use the address they set on the Elections tab — getVoterInfo
  // returns the election relevant to that address. Banner stays hidden until
  // an address is set. Skip this nonessential background lookup in local
  // development: Civic credentials are commonly absent/disabled there, and a
  // failed banner request otherwise floods the Expo error overlay even after
  // navigating away from this tab. The Elections screen still performs its
  // own lookup when that flow is being developed.
  const { address } = useUserAddress();
  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: address ?? "" }),
    enabled: !!address && !__DEV__,
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
        "Unable to refresh",
        "Your current results are still available.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Try Again", onPress: () => void handleRefresh() },
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
                <Text style={[s.display, s.headerTitle]}>Browse</Text>
                <TouchableOpacity
                  style={s.savedBtn}
                  onPress={openSaved}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Open what you follow"
                  testID="browse-saved"
                >
                  <Icon
                    name="bookmark"
                    size={22}
                    color={DigestPalette.inkOnNight}
                  />
                </TouchableOpacity>
                <ProfileMarkButton menuTop={insets.top + 52} />
              </View>
              <SearchInput
                placeholder="Search"
                value={query}
                onChangeText={handleSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={{ marginTop: 18, marginBottom: 8 }}
              />
            </View>

            <View style={s.filterWrap}>
              <Pills layout="scroll">
                {FILTERS.map((f) => (
                  <Pill
                    key={f.id}
                    label={f.label}
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
                  {items.length} {isState ? "bill" : "result"}
                  {items.length === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </>
        }
        ItemSeparatorComponent={() => <View style={s.rowRule} />}
        renderItem={({ item }) => (
          <View style={s.cardWrap}>
            <ContentCard
              item={toCardItem(item)}
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
                <Text style={s.resultsCount}>
                  {otherSearchQuery.data?.length} match
                  {otherSearchQuery.data?.length === 1 ? "" : "es"} in{" "}
                  {JURISDICTIONS[otherJurisdiction].name}
                </Text>
                <TouchableOpacity
                  style={s.switchButton}
                  onPress={() => void setJurisdiction(otherJurisdiction)}
                >
                  <Text style={s.switchText}>Switch</Text>
                  <Icon name="chevR" size={15} color={DigestPalette.spark} />
                </TouchableOpacity>
              </View>
              {(otherSearchQuery.data ?? []).map((item) => (
                <View key={item.id} style={s.otherCard}>
                  <ContentCard
                    item={toCardItem(item, { showJurisdiction: true })}
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
              <Text style={s.emptyTitle}>
                {jurisdictionInfo.name} didn’t load
              </Text>
              <Text style={s.emptySub}>
                Your scope hasn’t changed. Try this jurisdiction again.
              </Text>
              <TouchableOpacity
                style={s.emptyAction}
                onPress={() => void handleRefresh()}
              >
                <Text style={s.emptyActionText}>Try again</Text>
              </TouchableOpacity>
              {jurisdiction !== "federal" ? (
                <TouchableOpacity
                  onPress={() => void setJurisdiction("federal")}
                >
                  <Text style={s.switchText}>Browse Federal instead</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={s.center}>
              <EmptySearchMark width={88} />
              <Text style={s.emptyTitle}>
                {isState && filter === "court_case"
                  ? `No ${jurisdictionInfo.name} court cases yet`
                  : isState
                    ? `No ${jurisdictionInfo.name} ${filter === "all" ? "bills" : "records"} found`
                    : isSearching
                      ? `No match for “${query.trim()}”`
                      : "Nothing found"}
              </Text>
              <Text style={s.emptySub}>
                {isState
                  ? `${jurisdictionInfo.name} legislature only — courts and orders aren’t in yet.`
                  : "Try a different search."}
              </Text>
              {isState && filter !== "bill" && filter !== "all" ? (
                <TouchableOpacity
                  style={s.emptyAction}
                  onPress={() => handleFilterChange("bill")}
                >
                  <Text style={s.emptyActionText}>
                    Show {jurisdictionInfo.name} bills
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
        onSetAddress={() => {
          setJurisdictionPickerOpen(false);
          router.push("/elections" as Href);
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
    color: DigestPalette.spark,
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
  },
  switchButton: { flexDirection: "row", alignItems: "center", gap: 2 },
  switchText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: DigestPalette.spark,
  },
  otherCard: { marginTop: 12 },
});

export default function BrowseScreen() {
  return <DigestHome />;
}
