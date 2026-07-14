import type { Href } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";

import type { VideoPost } from "@acme/api";

import type { ContentItem } from "~/utils/content";
import { ElectionBanner } from "~/components/ElectionBanner";
import { Text } from "~/components/Themed";
import { ContentCard, Pill, Pills, SearchInput } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useUserAddress } from "~/hooks/useUserAddress";
import { colors, fontBody, fontDisplay, planes } from "~/styles";
import { trpc } from "~/utils/api";
import { toCardItem } from "~/utils/content";
import { daysUntil, isWithinDays } from "~/utils/dates";

const PAGE_SIZE = 20;

const FILTERS: { id: VideoPost["type"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bill", label: "Bills" },
  { id: "government_content", label: "Executive" },
  { id: "court_case", label: "Courts" },
  { id: "general", label: "Briefings" },
];

export default function BrowseScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<VideoPost["type"] | "all">("all");
  const [query, setQuery] = useState("");

  const handleFilterChange = (f: VideoPost["type"] | "all") => {
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
  // an address is set.
  const { address } = useUserAddress();
  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: address ?? "" }),
    enabled: !!address,
  });
  const election = voterInfoQuery.data?.election;
  const upcomingElection =
    election && isWithinDays(election.electionDay, 30) ? election : undefined;

  const insets = useSafeAreaInsets();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.content.getByType.infiniteQueryOptions(
      { type: filter, limit: PAGE_SIZE },
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

  const fuse = useMemo(
    () =>
      new Fuse(allItems, { keys: ["title", "description"], threshold: 0.3 }),
    [allItems],
  );

  const items = useMemo<ContentItem[]>(() => {
    if (!query.trim()) return allItems as ContentItem[];
    return fuse.search(query).map((r) => r.item) as ContentItem[];
  }, [allItems, query, fuse]);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };

  return (
    <View style={s.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: insets.top + 4,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={s.headerPad}>
              <Text style={s.display}>Browse</Text>
              <Text style={s.subtitle}>
                What your government is{" "}
                <Text style={s.subtitleEm}>actually</Text> doing.
              </Text>
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

            {!isLoading && !error && items.length > 0 && (
              <View style={s.resultsCountWrap}>
                <Text style={s.resultsCount}>
                  {items.length} result{items.length === 1 ? "" : "s"} · sorted
                  by recent
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
          isFetchingNextPage ? (
            <ActivityIndicator
              color={colors.white}
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.white}
              style={{ marginTop: 48 }}
            />
          ) : error ? (
            <View style={s.center}>
              <Text style={s.errorText}>Unable to load content</Text>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={s.emptyTitle}>Nothing found</Text>
              <Text style={s.emptySub}>Try a different search or filter</Text>
            </View>
          )
        }
      />
    </View>
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
  },
});
