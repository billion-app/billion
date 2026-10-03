import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { Contest } from "@acme/api";

import { AddressAutocomplete } from "~/components/AddressAutocomplete";
import {
  BallotStatusNotice,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import { BallotContestCard } from "~/components/ballot/BallotContestCard";
import { CaliforniaGuidePreview } from "~/components/ballot/CaliforniaGuidePreview";
import { ElectionHero } from "~/components/ElectionHero";
import { ElectionResultsSection } from "~/components/ElectionResultsSection";
import { RepsSection } from "~/components/RepsSection";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, Segmented, TabScreen } from "~/components/ui";
import { VotingLogisticsSection } from "~/components/voting-logistics/VotingLogisticsSection";
import { VotingPlanSection } from "~/components/voting-plan/VotingPlanSection";
import { posthog } from "~/config/posthog";
import { useUserAddress } from "~/hooks/useUserAddress";
import {
  colors,
  fontBody,
  fontDisplay,
  fontEditorial,
  hair,
  planes,
} from "~/styles";
import { trpc } from "~/utils/api";
import {
  ballotElectionDate,
  ballotElectionOptions,
  contestBallotCitations,
  currentBallot,
} from "~/utils/ballot-lookup";
import {
  groupContestsByLevel,
  isCaliforniaState,
  measureIsStatewide,
} from "~/utils/elections";

type BallotTab = "candidates" | "measures";

/** Build the /measure-detail route params for a measure contest. */
function measureRoute(m: Contest) {
  return {
    pathname: "/measure-detail" as const,
    params: {
      referendumTitle: m.referendumTitle ?? "",
      referendumSubtitle: m.referendumSubtitle ?? "",
      referendumProStatement: m.referendumProStatement ?? "",
      referendumConStatement: m.referendumConStatement ?? "",
      referendumText: m.referendumText ?? "",
      referendumUrl: m.referendumUrl ?? "",
      summary: m.summary ?? "",
      summaryLong: m.summaryLong ?? m.summary ?? "",
      summaryIsAiGenerated: m.summaryIsAiGenerated ? "true" : "false",
      fiscalImpact: m.fiscalImpact ?? "",
      proArguments: JSON.stringify(m.proArguments ?? []),
      conArguments: JSON.stringify(m.conArguments ?? []),
      citations: JSON.stringify(contestBallotCitations(m)),
    },
  };
}

/** Short label for the most authoritative source backing a measure. */
function topSourceLabel(m: Contest): string | null {
  const sources = contestBallotCitations(m);
  const official = sources.find((src) => src.official);
  const src = official ?? sources[0];
  if (!src) return null;
  return src.official ? `Official · ${src.sourceName}` : src.sourceName;
}

/** Expandable card for a single ballot measure (statewide or local). */
function MeasureCard({
  measure: m,
  expanded,
  onToggle,
  onReadMore,
}: {
  measure: Contest;
  expanded: boolean;
  onToggle: () => void;
  onReadMore: () => void;
}) {
  return (
    <Card style={{ padding: 18 }}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onToggle}
        style={s.measureHeader}
      >
        <Text style={[s.measureTitle, { marginBottom: 0, flex: 1 }]}>
          {m.referendumTitle}
        </Text>
        <Icon name={expanded ? "chevD" : "chevR"} size={16} color="#5B6172" />
      </TouchableOpacity>
      {expanded && (
        <View style={s.measureBody}>
          {m.summaryShort || m.summary || m.referendumSubtitle ? (
            <Text style={s.measureSub}>
              {m.summaryShort ?? m.summary ?? m.referendumSubtitle}
            </Text>
          ) : null}
          {m.summaryIsAiGenerated && (
            <View style={s.aiChip}>
              <Icon name="sparkle" size={11} color={colors.yellow[500]} />
              <Text style={s.aiChipText}>AI-generated summary</Text>
            </View>
          )}
          {m.fiscalImpact ? (
            <View style={s.fiscalRow}>
              <Text style={s.fiscalLabel}>Fiscal impact</Text>
              <Text style={s.fiscalValue} numberOfLines={3}>
                {m.fiscalImpact}
              </Text>
            </View>
          ) : null}
          {m.referendumProStatement ? (
            <View style={s.stanceRow}>
              <View
                style={[s.stanceDot, { backgroundColor: colors.green[500] }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.stanceLabel}>Supporters argue</Text>
                <Text style={s.stanceText}>{m.referendumProStatement}</Text>
              </View>
            </View>
          ) : null}
          {m.referendumConStatement ? (
            <View style={s.stanceRow}>
              <View
                style={[s.stanceDot, { backgroundColor: colors.red[500] }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.stanceLabel}>Opponents argue</Text>
                <Text style={s.stanceText}>{m.referendumConStatement}</Text>
              </View>
            </View>
          ) : null}
          <TouchableOpacity
            style={s.readMoreBtn}
            activeOpacity={0.8}
            onPress={onReadMore}
          >
            <Icon name="doc" size={15} color={colors.bill} />
            <Text style={s.readMoreText}>Read full measure</Text>
          </TouchableOpacity>
          {topSourceLabel(m) ? (
            <View style={s.sourceChip}>
              <Icon
                name={
                  contestBallotCitations(m).some((src) => src.official)
                    ? "shield"
                    : "info"
                }
                size={11}
                color={colors.textSecondary}
              />
              <Text style={s.sourceChipText} numberOfLines={1}>
                {topSourceLabel(m)}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

export default function ElectionsScreen() {
  const router = useRouter();
  const [view, setView] = useState<"entry" | "guide" | "ballot" | "fixtures">(
    "entry",
  );
  if (view === "entry")
    return (
      <CaliforniaElectionEntry
        onExplore={() => setView("guide")}
        onLookup={() => router.push("/ballot")}
      />
    );
  if (__DEV__ && view === "fixtures") return <DevelopmentElections />;
  if (view === "ballot") return <ElectionsLive />;
  return (
    <CaliforniaGuidePreview
      onOpenBallot={() => router.push("/ballot")}
      onBack={() => setView("entry")}
      onOpenFixtures={__DEV__ ? () => setView("fixtures") : undefined}
    />
  );
}

function DevelopmentElections() {
  const [scenario, setScenario] = useState("full");
  return (
    <ElectionsLive
      key={scenario}
      previewAddress={scenario === "live" ? undefined : `mock:${scenario}`}
      devControls={
        <View>
          <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 12 }}>
            Development · synthetic ballot scenarios
          </Text>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            {["live", "full", "partial", "empty", "error"].map((value) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: scenario === value }}
                onPress={() => setScenario(value)}
                style={{ paddingVertical: 12 }}
              >
                <Text
                  style={{
                    color: colors.bill,
                    fontWeight: scenario === value ? "700" : "400",
                  }}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      }
    />
  );
}

function CaliforniaElectionEntry({
  onExplore,
  onLookup,
}: {
  onExplore: () => void;
  onLookup: () => void;
}) {
  const router = useRouter();
  const query = useQuery(trpc.civic.getCaliforniaGuide.queryOptions());
  const guide = query.isError ? undefined : query.data;

  return (
    <TabScreen title="Elections">
      <View style={s.entry}>
        <Text style={s.entryKicker}>
          {guide
            ? `${ballotElectionDate(guide.electionDate)} · GENERAL ELECTION`
            : "CALIFORNIA STATEWIDE GUIDE"}
        </Text>
        <Text style={s.entryTitle}>Voting in California?</Text>
        <Card style={s.entryGuide}>
          <View style={s.entryGuideHead}>
            <View
              style={s.entryIcon}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon name="book" size={18} color={colors.bill} />
            </View>
            <Text accessibilityRole="header" style={s.entryGuideTitle}>
              The statewide guide
            </Text>
          </View>
          <Text style={s.entryBody}>
            Read official candidate statements and statewide propositions.
          </Text>
          <Text style={s.entryNoteText}>
            Statewide information, not your personal ballot.
          </Text>
          {query.isPending ? (
            <View style={s.entryButton}>
              <Text accessibilityLiveRegion="polite" style={s.entryButtonText}>
                Loading statewide preview…
              </Text>
              <ActivityIndicator color={colors.bill} />
            </View>
          ) : guide ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Explore the California statewide guide"
              activeOpacity={0.8}
              onPress={onExplore}
              style={s.entryButton}
            >
              <Text style={s.entryButtonText}>Explore the guide</Text>
              <Icon name="arrowRight" size={16} color={colors.bill} />
            </TouchableOpacity>
          ) : (
            <SourceLink
              label="Read California’s official guide"
              url="https://voterguide.sos.ca.gov/"
              prominence="primary"
            />
          )}
        </Card>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Learn how elections work"
          onPress={() => router.push("/election-process")}
          style={s.entryTool}
        >
          <View
            style={s.entryIcon}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="users" size={18} color={colors.bill} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.entryGuideTitle}>How elections work</Text>
            <Text style={s.entryNoteText}>
              Primaries, nominations and your vote.
            </Text>
          </View>
          <Icon name="chevR" size={16} color={colors.bill} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push("/ballot-preparation")}
          style={s.entryTool}
        >
          <View
            style={s.entryIcon}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="bookmark" size={18} color={colors.bill} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.entryGuideTitle}>Your saved notes</Text>
            <Text style={s.entryNoteText}>
              Private reading notes on this device.
            </Text>
          </View>
          <Icon name="chevR" size={16} color={colors.bill} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onLookup}
          accessibilityLabel="Find my official ballot through my election office"
          style={s.entryTool}
        >
          <View
            style={s.entryIcon}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="pin" size={18} color={colors.bill} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.entryGuideTitle}>Find my official ballot</Text>
            <Text style={s.entryNoteText}>Through your election office.</Text>
          </View>
          <Icon name="arrowRight" size={16} color={colors.bill} />
        </TouchableOpacity>
      </View>
    </TabScreen>
  );
}

function ElectionsLive({
  previewAddress,
  devControls,
}: { previewAddress?: string; devControls?: ReactNode } = {}) {
  const router = useRouter();
  const { address: savedAddress } = useUserAddress();
  const [lookupAddress, setLookupAddress] = useState<string>();
  const storedAddress = lookupAddress ?? previewAddress ?? savedAddress;
  const isPreview = storedAddress?.startsWith("mock:") ?? false;
  const [electionId, setElectionId] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [expandedMeasures, setExpandedMeasures] = useState<Set<number>>(
    new Set(),
  );
  const [tab, setTab] = useState<BallotTab>("candidates");

  const toggleSet = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Set<number>>>,
      idx: number,
    ) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
    },
    [],
  );

  const toggleMeasure = useCallback(
    (idx: number, measure: Contest) => {
      toggleSet(setExpandedMeasures, idx);
      const isExpanding = !expandedMeasures.has(idx);
      if (isExpanding) {
        posthog.capture("ballot_measure_expanded", {
          measure_title: measure.referendumTitle ?? null,
          is_statewide: measureIsStatewide(measure),
        });
      }
    },
    [toggleSet, expandedMeasures, setExpandedMeasures],
  );

  const hasAddress = !!storedAddress;

  // Retain address-specific discovery so every election remains selectable.
  const discovery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({
      address: storedAddress ?? "",
      includeEnrichment: false,
    }),
    enabled: hasAddress,
    retry: false,
  });
  const selection = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({
      address: storedAddress ?? "",
      electionId,
      includeEnrichment: false,
    }),
    enabled: hasAddress && !!electionId,
    retry: false,
  });
  const voterInfoQuery = electionId ? selection : discovery;
  const { data, mismatch } = currentBallot({
    data: voterInfoQuery.data,
    requestedElectionId: electionId,
    editing,
    fetching: voterInfoQuery.isFetching,
    failed: voterInfoQuery.isError,
  });
  const elections = ballotElectionOptions(discovery.data, data);

  // Legacy results remain California-only; the migrated provider supplies national ballots.
  const unsupportedState =
    hasAddress &&
    !!data &&
    !isCaliforniaState(data.normalizedInput.state) &&
    data.provider?.name !== "democracy_works";

  const hasVerifiedCaliforniaAddress =
    !!data && isCaliforniaState(data.normalizedInput.state);

  // The address-specific election the ballot belongs to.
  const selected = unsupportedState ? undefined : data?.election;

  const contests = unsupportedState ? [] : (data?.contests ?? []);
  const measures = contests.filter((c: Contest) => c.referendumTitle);
  const candidateContests = contests.filter((c: Contest) => !c.referendumTitle);
  const candidateGroups = groupContestsByLevel(candidateContests);

  return (
    <TabScreen
      title="Your Ballot"
      contentStyle={{ gap: 24 }}
      headerExtra={
        <>
          {devControls}
          {editing || !storedAddress ? (
            <AddressAutocomplete
              initialValue={storedAddress ?? ""}
              onSubmit={(addr) => {
                setLookupAddress(addr);
                setExpandedMeasures(new Set());
                if (addr === storedAddress && !electionId)
                  void discovery.refetch();
                setElectionId(undefined);
                setEditing(false);
                posthog.capture("voter_address_set", {
                  is_update: !!storedAddress,
                });
              }}
            />
          ) : (
            <View style={s.addrCard}>
              <Icon name="pin" size={19} color={colors.bill} />
              <View style={s.addrBody}>
                <Text style={s.addrKicker}>VOTING ADDRESS</Text>
                <Text style={s.addrText} numberOfLines={1}>
                  {storedAddress}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={s.addrEdit}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      }
    >
      {!hasAddress && (
        <View style={s.section}>
          <Card>
            <Text style={s.empty}>
              Enter your registered address above to load the election and
              ballot for where you vote.
            </Text>
          </Card>
        </View>
      )}

      {hasAddress && voterInfoQuery.isError && (
        <View style={s.section}>
          <BallotStatusNotice
            evidence={{ kind: "provider-failure" }}
            onRetry={() => void voterInfoQuery.refetch()}
          />
        </View>
      )}
      {mismatch && (
        <View style={s.section}>
          <Card>
            <Text accessibilityRole="alert" style={s.empty}>
              The provider returned a different election. Choose another
              election or retry to load the ballot you selected.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void voterInfoQuery.refetch()}
            >
              <Text style={s.readMoreText}>Retry selected ballot</Text>
            </TouchableOpacity>
          </Card>
        </View>
      )}
      {unsupportedState && (
        <View style={s.section}>
          <Card>
            <Text style={s.empty}>
              We only cover California elections right now. Support for your
              state is coming soon.
            </Text>
          </Card>
        </View>
      )}

      {/* election hero — what election is happening, what it means */}
      {selected && <ElectionHero election={selected} />}

      {/* live results (CA SOS feed): statewide + the voter's district races,
          scoped from their ballot. Self-hides when off-season. Only
          meaningful once we know the voter is in a state we cover. */}
      {!isPreview && hasVerifiedCaliforniaAddress && selected && (
        <ElectionResultsSection
          contests={contests}
          electionDay={selected.electionDay}
          electionName={selected.name}
        />
      )}

      <RepsSection
        address={storedAddress}
        enabled={!isPreview && hasVerifiedCaliforniaAddress}
      />

      {voterInfoQuery.isFetching && (
        <ActivityIndicator color={colors.bill} style={{ marginVertical: 12 }} />
      )}

      {!editing && elections.length > 1 && (
        <View style={s.section}>
          <Kicker>Elections</Kicker>
          {elections.map((election) => (
            <TouchableOpacity
              key={election.id}
              accessibilityRole="button"
              accessibilityState={{ selected: selected?.id === election.id }}
              onPress={() => {
                setExpandedMeasures(new Set());
                setElectionId(election.id);
              }}
            >
              <Text style={s.readMoreText}>{election.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {data?.provider && (
        <View style={[s.section, { gap: 8 }]}>
          <Text style={s.empty}>
            {data.provider.addressScope === "statewide_only"
              ? "Statewide contests only. Local races and measures may be missing."
              : data.provider.addressScope === "unknown"
                ? "Address coverage unconfirmed. These contests may not match your address."
                : "Coverage may be incomplete."}
          </Text>
          <SourceLink
            label={
              isPreview ? "Synthetic development fixture" : "Democracy Works"
            }
            url={data.provider.sourceUrl}
          />
        </View>
      )}
      {/* ballot section tabs */}
      {contests.length > 0 && (
        <View style={s.section}>
          <Segmented<BallotTab>
            value={tab}
            onChange={setTab}
            options={[
              {
                id: "candidates",
                label: `Candidates ${candidateContests.length}`,
                icon: "vote",
              },
              {
                id: "measures",
                label: `Measures ${measures.length}`,
                icon: "scale",
              },
            ]}
          />
        </View>
      )}

      {/* CANDIDATES TAB — contests grouped by government level */}
      {contests.length > 0 && tab === "candidates" && (
        <View style={[s.section, { gap: 20 }]}>
          {candidateGroups.length === 0 && (
            <Card>
              <Text style={s.empty}>No candidate contests on this ballot.</Text>
            </Card>
          )}
          {candidateGroups.map((group) => (
            <View key={group.key} style={{ gap: 12 }}>
              <Kicker>{group.label}</Kicker>
              <View style={{ gap: 14 }}>
                {group.contests.map((c: Contest, i: number) => (
                  <BallotContestCard key={`${group.key}-${i}`} contest={c} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {contests.length > 0 && tab === "measures" && (
        <View style={[s.section, { gap: 14 }]}>
          <Kicker>Ballot measures</Kicker>
          {measures.length === 0 && (
            <Card>
              <Text style={s.empty}>No measures supplied for this ballot.</Text>
            </Card>
          )}
          {measures.map((m, i) => (
            <MeasureCard
              key={i}
              measure={m}
              expanded={expandedMeasures.has(i)}
              onToggle={() => toggleMeasure(i, m)}
              onReadMore={() => router.push(measureRoute(m))}
            />
          ))}
        </View>
      )}
      {hasAddress &&
        !editing &&
        !mismatch &&
        !unsupportedState &&
        contests.length === 0 &&
        !voterInfoQuery.isFetching &&
        !voterInfoQuery.isError && (
          <View style={s.section}>
            <Card>
              <Text style={s.empty}>
                Contest information is unavailable for this address. Check your
                election office for the official ballot.
              </Text>
            </Card>
          </View>
        )}

      <View style={s.section}>
        <VotingPlanSection
          election={selected}
          data={data}
          california={hasVerifiedCaliforniaAddress}
        />
        <VotingLogisticsSection
          data={data}
          status={
            !hasAddress || editing
              ? "idle"
              : voterInfoQuery.isFetching
                ? "loading"
                : voterInfoQuery.isError || mismatch
                  ? "error"
                  : "ready"
          }
        />
      </View>
    </TabScreen>
  );
}

const s = StyleSheet.create({
  entry: { paddingHorizontal: 20, paddingTop: 16, gap: 18 },
  entryKicker: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 0.5,
  },
  entryTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 30,
    lineHeight: 34,
    color: colors.white,
  },
  entryGuide: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderLeftWidth: 3,
    borderLeftColor: colors.bill,
    borderRadius: 14,
    padding: 16,
    gap: 13,
  },
  entryGuideHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  entryGuideTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.white,
  },
  entryIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: `${colors.bill}28`,
    alignItems: "center",
    justifyContent: "center",
  },
  entryBody: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.white,
  },
  entryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
  },
  entryButtonText: {
    fontFamily: fontBody.semibold,
    fontSize: 12,
    color: colors.white,
  },
  entryNoteText: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.70)",
  },
  entryTool: {
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[1],
    borderRadius: 14,
    padding: 14,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addrCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: planes.slate,
    borderWidth: 1,
    borderColor: hair[2],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  addrBody: { flex: 1, minWidth: 0 },
  addrKicker: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 0.4,
  },
  addrText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
    marginTop: 1,
  },
  addrEdit: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.white,
  },
  section: { paddingHorizontal: 20 },
  contestOffice: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 16,
    color: colors.white,
  },
  contestMeta: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.70)",
    marginTop: 3,
  },
  measureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  measureTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 17,
    color: colors.white,
    marginBottom: 12,
  },
  measureBody: { marginTop: 14, gap: 12 },
  measureSub: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: "rgba(255,255,255,0.70)",
    lineHeight: 20,
  },
  stanceRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stanceDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  stanceLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: colors.white,
    marginBottom: 3,
  },
  stanceText: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: planes.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  readMoreText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  aiChipText: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: colors.yellow[500],
  },
  fiscalRow: { gap: 3 },
  fiscalLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 11.5,
    color: "rgba(255,255,255,0.70)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  fiscalValue: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 19,
  },
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  sourceChipText: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: "rgba(255,255,255,0.70)",
  },
  empty: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.70)",
    textAlign: "center",
  },
  pollRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  pollIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pollTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: colors.white,
  },
  pollSub: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12.5,
    color: "rgba(255,255,255,0.70)",
  },
});
