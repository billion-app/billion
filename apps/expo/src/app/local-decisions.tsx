/**
 * "What San Jose Is Deciding" - the local-government decision list.
 *
 * Jurisdiction-neutral: every place name comes from data or the user's saved
 * address, never from this file. The first-release ingestion pipeline covers
 * San Jose; other jurisdictions show honest empty states.
 */
import type { Href } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { DecisionCard } from "~/components/local-government/DecisionCard";
import { DecisionListSkeleton } from "~/components/local-government/DecisionSkeletons";
import { Text, View } from "~/components/Themed";
import { Pill, Pills } from "~/components/ui";
import { Icon } from "~/components/ui/Icon";
import { NavHeader } from "~/components/ui/NavHeader";
import { Segmented } from "~/components/ui/Segmented";
import { useUserAddress } from "~/hooks/useUserAddress";
import { colors, fontBody, fontDisplay, useTheme } from "~/styles";
import { trpc } from "~/utils/api";
import {
  detectJurisdictionKey,
  formatMeetingDate,
  JURISDICTION_FALLBACK_NAMES,
  topicLabelOrFallback,
} from "~/utils/local-government";

const PAGE_SIZE = 20;
/** A sync older than this is flagged as stale in the header note. */
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

type TimelineTab = "upcoming" | "recent";

export default function LocalDecisionsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { address, isLoading: isAddressLoading } = useUserAddress();

  const detectedJurisdiction = detectJurisdictionKey(address);
  const isSanJoseResident = detectedJurisdiction === "sanjose";
  const jurisdiction = "sanjose" as const;
  const jurisdictionName = JURISDICTION_FALLBACK_NAMES[jurisdiction];

  const [tab, setTab] = useState<TimelineTab>("upcoming");
  const [topic, setTopic] = useState<string | null>(null);

  const listInput = useMemo(
    () => ({
      jurisdiction,
      timeline: tab,
      topic: topic ?? undefined,
      limit: PAGE_SIZE,
    }),
    [jurisdiction, tab, topic],
  );

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.legistar.listDecisions.infiniteQueryOptions(
      { ...listInput, cursor: 0 },
      {
        enabled: !isAddressLoading && isSanJoseResident,
        initialCursor: 0,
        getNextPageParam: (lastPage, allPages) =>
          lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : null,
      },
    ),
  );

  // One bounded probe so filter pills only appear for topics that actually
  // have decisions right now.
  const topicsProbe = useQuery({
    ...trpc.legistar.listDecisions.queryOptions({
      jurisdiction,
      timeline: "all",
      limit: 100,
    }),
    enabled: !isAddressLoading && isSanJoseResident,
  });
  const availableTopics = useMemo(() => {
    const seen = new Set<string>();
    for (const row of topicsProbe.data ?? []) {
      if (row.topic) seen.add(row.topic);
    }
    return [...seen].sort();
  }, [topicsProbe.data]);

  const healthQuery = useQuery({
    ...trpc.legistar.getIngestionHealth.queryOptions({ jurisdiction }),
    enabled: !isAddressLoading && isSanJoseResident,
  });
  const latestRun = healthQuery.data?.latestRun ?? null;
  const syncFailed = latestRun?.status === "failed";
  const lastSyncedAt = latestRun?.startedAt ?? null;
  const syncIsStale =
    syncFailed ||
    (lastSyncedAt !== null &&
      Date.now() - new Date(lastSyncedAt).getTime() > STALE_AFTER_MS);

  const decisions = useMemo(() => data?.pages.flat() ?? [], [data]);

  // One row per agenda appearance; the feed shows each decision once, at its
  // most relevant upcoming (or latest recent) occurrence.
  const uniqueDecisions = useMemo(() => {
    const seen = new Set<string>();
    return decisions.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [decisions]);

  const refreshInFlight = useRef(false);
  const handleRefresh = async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      await Promise.all([
        refetch({ throwOnError: false }),
        healthQuery.refetch({ throwOnError: false }),
      ]);
    } finally {
      refreshInFlight.current = false;
    }
  };

  if (isAddressLoading) {
    return (
      <View style={[s.screen, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      </View>
    );
  }

  if (!isSanJoseResident) {
    return <Redirect href="/(tabs)/elections" />;
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.background }]}>
      <NavHeader
        large
        title={`What ${jurisdictionName} Is Deciding`}
        onBack={() => router.back()}
      />

      <View style={s.controls}>
        <Segmented<TimelineTab>
          options={[
            { id: "upcoming", label: "Upcoming" },
            { id: "recent", label: "Recently decided" },
          ]}
          value={tab}
          onChange={(next) => {
            setTopic(null);
            setTab(next);
          }}
        />
      </View>

      {availableTopics.length > 0 && (
        <View>
          <Pills>
            <Pill
              label="All topics"
              active={topic === null}
              onPress={() => setTopic(null)}
            />
            {availableTopics.map((t) => (
              <Pill
                key={t}
                label={topicLabelOrFallback(t)}
                active={topic === t}
                onPress={() => setTopic(topic === t ? null : t)}
              />
            ))}
          </Pills>
        </View>
      )}

      <SyncNote
        visible={!healthQuery.isLoading && (syncIsStale || error != null)}
        jurisdictionName={jurisdictionName}
        syncFailed={syncFailed}
        lastSyncedAt={lastSyncedAt}
      />

      <FlatList
        style={s.list}
        contentContainerStyle={s.listContent}
        data={uniqueDecisions}
        keyExtractor={(row) => row.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.white}
          />
        }
        renderItem={({ item }) => (
          <DecisionCard
            decision={item}
            onPress={() =>
              router.push(`/local-decision-detail?id=${item.id}` as Href)
            }
          />
        )}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.white} style={s.footerSpinner} />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: 20 }}>
              <DecisionListSkeleton />
            </View>
          ) : error ? (
            <ListState
              title={`Couldn't load ${jurisdictionName} decisions`}
              body="The official records source didn't respond. Nothing on this list has changed."
              actionLabel="Try again"
              onAction={() => void refetch()}
            />
          ) : (
            <ListState
              title={
                tab === "upcoming"
                  ? `No upcoming ${jurisdictionName} meetings in the pipeline yet`
                  : `No recently decided items found${topic ? " for this topic" : ""}`
              }
              body={
                topic
                  ? "Try another topic, or check upcoming meetings."
                  : `Billion syncs ${jurisdictionName}'s published agendas and outcomes daily. Check back soon.`
              }
              actionLabel={
                tab === "upcoming" ? "See recently decided" : "See upcoming"
              }
              onAction={() => {
                setTopic(null);
                setTab(tab === "upcoming" ? "recent" : "upcoming");
              }}
            />
          )
        }
      />
    </View>
  );
}

function SyncNote({
  visible,
  jurisdictionName,
  syncFailed,
  lastSyncedAt,
}: {
  visible: boolean;
  jurisdictionName: string;
  syncFailed: boolean;
  lastSyncedAt: Date | string | null;
}) {
  const { theme } = useTheme();
  if (!visible) return null;
  return (
    <View style={s.syncNote}>
      <Icon name="clock" size={12} color={colors.yellow[500]} />
      <RNText style={[s.syncText, { color: theme.textSecondary }]}>
        {syncFailed
          ? `The last sync with ${jurisdictionName}'s official records failed, so this list may be out of date.`
          : lastSyncedAt
            ? `Official records were last synced ${formatMeetingDate(lastSyncedAt)}.`
            : `Sync status for ${jurisdictionName} is unavailable.`}
      </RNText>
    </View>
  );
}

function ListState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={s.center}>
      <Text style={[s.emptyTitle, { color: theme.foreground }]}>{title}</Text>
      <Text style={[s.emptyBody, { color: theme.textSecondary }]}>{body}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[s.emptyAction, { borderColor: theme.border }]}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Text style={[s.emptyActionText, { color: theme.foreground }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  controls: { paddingHorizontal: 20, paddingBottom: 10 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },
  footerSpinner: { marginVertical: 16 },
  syncNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  syncText: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 56,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    textAlign: "center",
    lineHeight: 24,
  },
  emptyBody: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyAction: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 10,
  },
  emptyActionText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
  },
});
