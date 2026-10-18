/**
 * "What {City} Is Deciding" - the local-government decision list.
 *
 * Jurisdiction comes from the user's saved address via detectJurisdictionKey
 * (San José / Santa Clara / Sunnyvale). Unsupported addresses redirect back
 * to Elections — never invent a city.
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

import { LanguageCorner } from "~/components/LanguageButton";
import { DecisionCard } from "~/components/local-government/DecisionCard";
import { DecisionListSkeleton } from "~/components/local-government/DecisionSkeletons";
import { Text, View } from "~/components/Themed";
import { Pill, Pills } from "~/components/ui";
import { Icon } from "~/components/ui/Icon";
import { NavHeader } from "~/components/ui/NavHeader";
import { Segmented } from "~/components/ui/Segmented";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useUserAddress } from "~/hooks/useUserAddress";
import { DigestPalette, DigestSpace, fontBody, fontDisplay } from "~/styles";
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
  const { t: tx, language } = useAppTranslation();

  const router = useRouter();
  const { address, isLoading: isAddressLoading } = useUserAddress();

  const detectedJurisdiction = detectJurisdictionKey(address);
  const jurisdiction = detectedJurisdiction;
  const jurisdictionName = jurisdiction
    ? JURISDICTION_FALLBACK_NAMES[jurisdiction]
    : null;

  const [tab, setTab] = useState<TimelineTab>("upcoming");
  const [topic, setTopic] = useState<string | null>(null);

  const listInput = useMemo(
    () => ({
      jurisdiction: jurisdiction ?? "sanjose",
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
        enabled: !isAddressLoading && jurisdiction != null,
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
      jurisdiction: listInput.jurisdiction,
      timeline: "all",
      limit: 100,
    }),
    enabled: !isAddressLoading && jurisdiction != null,
  });
  const availableTopics = useMemo(() => {
    const seen = new Set<string>();
    for (const row of topicsProbe.data ?? []) {
      if (row.topic) seen.add(row.topic);
    }
    return [...seen].sort();
  }, [topicsProbe.data]);

  const healthQuery = useQuery({
    ...trpc.legistar.getIngestionHealth.queryOptions({
      jurisdiction: listInput.jurisdiction,
    }),
    enabled: !isAddressLoading && jurisdiction != null,
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
      <View style={[s.screen, { backgroundColor: DigestPalette.canvas }]}>
        <LanguageCorner />
        <View style={s.center}>
          <ActivityIndicator size="large" color={DigestPalette.inkOnNight} />
        </View>
      </View>
    );
  }

  if (!jurisdiction || !jurisdictionName) {
    return <Redirect href="/(tabs)/elections" />;
  }

  return (
    <View style={[s.screen, { backgroundColor: DigestPalette.canvas }]}>
      <NavHeader
        large
        title={tx("What {value1} Is Deciding", { value1: jurisdictionName })}
        onBack={() => router.back()}
      />

      <View style={s.controls}>
        <Segmented<TimelineTab>
          options={[
            { id: "upcoming", label: tx("Upcoming") },
            { id: "recent", label: tx("Recently decided") },
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
              label={tx("All topics")}
              active={topic === null}
              onPress={() => setTopic(null)}
            />
            {availableTopics.map((t) => (
              <Pill
                key={t}
                label={topicLabelOrFallback(t, language)}
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
            tintColor={DigestPalette.inkOnNight}
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
            <ActivityIndicator
              color={DigestPalette.inkOnNight}
              style={s.footerSpinner}
            />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: DigestSpace.screenPadX }}>
              <DecisionListSkeleton />
            </View>
          ) : error ? (
            <ListState
              title={tx("Couldn't load {value1} decisions", {
                value1: jurisdictionName,
              })}
              body={tx(
                "The official records source didn't respond. Nothing on this list has changed.",
              )}
              actionLabel={tx("Try again")}
              onAction={() => void refetch()}
            />
          ) : (
            <ListState
              title={
                tab === "upcoming"
                  ? tx("No upcoming {value1} meetings in the pipeline yet", {
                      value1: jurisdictionName,
                    })
                  : topic
                    ? tx("No recently decided items found for this topic")
                    : tx("No recently decided items found{value1}", {
                        value1: "",
                      })
              }
              body={
                topic
                  ? tx("Try another topic, or check upcoming meetings.")
                  : tx(
                      "Billion syncs {value1}'s published agendas and outcomes daily. Check back soon.",
                      { value1: jurisdictionName },
                    )
              }
              actionLabel={
                tab === "upcoming"
                  ? tx("See recently decided")
                  : tx("See upcoming")
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
  const { t: tx, language } = useAppTranslation();

  if (!visible) return null;
  return (
    <View style={s.syncNote}>
      <Icon name="clock" size={12} color={DigestPalette.spark} />
      <RNText style={[s.syncText, { color: DigestPalette.quiet }]}>
        {syncFailed
          ? tx(
              "The last sync with {value1}'s official records failed, so this list may be out of date.",
              { value1: jurisdictionName },
            )
          : lastSyncedAt
            ? tx("Official records were last synced {value1}.", {
                value1: formatMeetingDate(lastSyncedAt, language),
              })
            : tx("Sync status for {value1} is unavailable.", {
                value1: jurisdictionName,
              })}
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
  return (
    <View style={s.center}>
      <Text style={[s.emptyTitle, { color: DigestPalette.inkOnNight }]}>
        {title}
      </Text>
      <Text style={[s.emptyBody, { color: DigestPalette.quiet }]}>{body}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[s.emptyAction, { borderColor: DigestPalette.border }]}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Text
            style={[s.emptyActionText, { color: DigestPalette.inkOnNight }]}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  controls: { paddingHorizontal: DigestSpace.screenPadX, paddingBottom: 10 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingBottom: 48,
    gap: 12,
  },
  footerSpinner: { marginVertical: 16 },
  syncNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: DigestSpace.screenPadX,
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
    borderColor: DigestPalette.border,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 10,
  },
  emptyActionText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
  },
});
