import type { Href } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import type { ContentItem } from "~/utils/content";
import { ElectionBanner } from "~/components/ElectionBanner";
import {
  JurisdictionPicker,
  JurisdictionScopeRow,
} from "~/components/JurisdictionPicker";
import { Text } from "~/components/Themed";
import { ContentCard, Icon, Pill, Pills, SearchInput } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useContentJurisdiction } from "~/hooks/useContentJurisdiction";
import { useDebounced } from "~/hooks/useDebounce";
import { useUserAddress } from "~/hooks/useUserAddress";
import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";
import { queryClient, trpc, trpcClient } from "~/utils/api";
import { toCardItem } from "~/utils/content";
import { daysUntil, isWithinDays } from "~/utils/dates";
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

export default function BrowseScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<ContentFilter>("all");
  const [query, setQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jurisdictionPickerOpen, setJurisdictionPickerOpen] = useState(false);
  const refreshInFlight = useRef(false);
  const { jurisdiction, setJurisdiction } = useContentJurisdiction();
  const jurisdictionInfo = JURISDICTIONS[jurisdiction];
  const isState = isStateJurisdiction(jurisdiction);
  const otherJurisdiction = jurisdiction === "federal" ? "ca" : "federal";

  const handleFilterChange = (f: ContentFilter) => {
    setFilter(f);
    posthog.capture("content_filter_applied", { filter_type: f });
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

  const items = (
    isSearching ? (searchQuery.data ?? []) : allItems
  ) as ContentItem[];
  const listIsLoading = isSearching ? searchQuery.isLoading : isLoading;
  const listError = isSearching ? searchQuery.error : error;

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
            tintColor={colors.white}
          />
        }
        ListHeaderComponent={
          <>
            <View style={s.headerPad}>
              <Text style={s.display}>Browse</Text>
              <Text style={s.subtitle}>
                What {jurisdictionInfo.subtitlePlace} is{" "}
                <Text style={s.subtitleEm}>actually</Text> doing.
              </Text>
              <JurisdictionScopeRow
                jurisdiction={jurisdiction}
                onPress={() => setJurisdictionPickerOpen(true)}
              />
              <SearchInput
                placeholder="Search bills, cases, orders…"
                value={query}
                onChangeText={handleSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={{ marginBottom: 16 }}
              />
            </View>

            <Pills>
              {FILTERS.map((f) => (
                <Pill
                  key={f.id}
                  label={f.label}
                  active={filter === f.id}
                  onPress={() => handleFilterChange(f.id)}
                />
              ))}
            </Pills>

            {upcomingElection && (
              <ElectionBanner
                daysUntil={daysUntil(upcomingElection.electionDay)}
                electionName={upcomingElection.name}
                onPress={() => router.push("/elections" as Href)}
              />
            )}

            {!listIsLoading && !listError && items.length > 0 && (
              <View style={s.resultsCountWrap}>
                <Text style={s.resultsCount}>
                  {items.length} {isState ? "bill" : "result"}
                  {items.length === 1 ? "" : "s"} ·{" "}
                  {isSearching
                    ? "sorted by relevance"
                    : isState
                      ? "sorted by latest action"
                      : "sorted by recent"}
                </Text>
              </View>
            )}
          </>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <View style={s.cardWrap}>
            <ContentCard
              item={toCardItem(item)}
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
                  <Icon name="chevR" size={15} color={colors.bill} />
                </TouchableOpacity>
              </View>
              {(otherSearchQuery.data ?? []).map((item) => (
                <View key={item.id} style={s.otherCard}>
                  <ContentCard
                    item={toCardItem(item, { showJurisdiction: true })}
                    onPress={() => router.push(`/article-detail?id=${item.id}`)}
                  />
                </View>
              ))}
            </View>
          ) : !isSearching && isFetchingNextPage ? (
            <ActivityIndicator
              color={colors.white}
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
        ListEmptyComponent={
          listIsLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.white}
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
              <Text style={s.emptyTitle}>
                {isState && filter === "court_case"
                  ? `No ${jurisdictionInfo.name} court cases yet`
                  : isState
                    ? `No ${jurisdictionInfo.name} ${filter === "all" ? "bills" : "records"} found`
                    : isSearching
                      ? `No federal match for “${query.trim()}”`
                      : "Nothing found"}
              </Text>
              <Text style={s.emptySub}>
                {isState
                  ? `Billion covers ${jurisdictionInfo.name}’s Legislature today. State courts and executive orders aren’t ingested yet.`
                  : "Try a different search or filter."}
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
  screen: { flex: 1, backgroundColor: planes.navy },
  headerPad: { paddingHorizontal: 20 },
  display: {
    fontFamily: fontDisplay.bold,
    fontSize: 36,
    color: colors.white,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14.5,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 18,
  },
  subtitleEm: {
    fontFamily: fontDisplay.italic,
    fontStyle: "italic",
    color: "rgba(255,255,255,0.85)",
  },
  cardWrap: { paddingHorizontal: 20 },
  resultsCountWrap: { paddingHorizontal: 20, paddingTop: 18 },
  resultsCount: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginBottom: 12,
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 64,
    gap: 8,
  },
  errorText: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 16,
    color: colors.red[500],
  },
  emptyTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 18,
    color: colors.white,
  },
  emptySub: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyAction: {
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 10,
  },
  emptyActionText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.white,
  },
  otherResults: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: hair[3],
    borderRadius: 16,
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
    color: colors.bill,
  },
  otherCard: { marginTop: 12 },
});
