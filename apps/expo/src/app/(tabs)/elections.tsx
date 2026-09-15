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
import { ElectionHero } from "~/components/ElectionHero";
import { ElectionResultsSection } from "~/components/ElectionResultsSection";
import { RepsSection } from "~/components/RepsSection";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, Segmented, TabScreen } from "~/components/ui";
import { VotingLogisticsSection } from "~/components/voting-logistics/VotingLogisticsSection";
import { posthog } from "~/config/posthog";
import { useUserAddress } from "~/hooks/useUserAddress";
import { colors, fontBody, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";
import {
  groupContestsByLevel,
  isCaliforniaState,
  measureIsStatewide,
} from "~/utils/elections";
import { electionsAreLive } from "~/utils/elections-live";

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
      citations: JSON.stringify(m.citations ?? []),
    },
  };
}

/** Short label for the most authoritative source backing a measure. */
function topSourceLabel(m: Contest): string | null {
  const official = m.sources?.find((src) => src.official);
  const src = official ?? m.sources?.[0];
  if (!src) return null;
  return src.official ? `Official · ${src.name}` : src.name;
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
                  m.sources?.some((src) => src.official) ? "shield" : "info"
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
  if (!electionsAreLive()) return <ElectionsComingSoon />;
  if (__DEV__) return <DevelopmentElections />;
  return <ElectionsLive />;
}

function DevelopmentElections() {
  const [scenario, setScenario] = useState("full");
  return (
    <ElectionsLive
      key={scenario}
      previewAddress={scenario === "live" ? undefined : `mock:${scenario}`}
      devControls={
        <View>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
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

function ElectionsComingSoon() {
  return (
    <TabScreen title="Elections">
      <View style={s.section}>
        <Card>
          <Text style={s.empty}>Elections page coming soon</Text>
        </Card>
      </View>
    </TabScreen>
  );
}

function ElectionsLive({
  previewAddress,
  devControls,
}: { previewAddress?: string; devControls?: ReactNode } = {}) {
  const router = useRouter();
  const { address: savedAddress, setAddress } = useUserAddress();
  const [previewEdit, setPreviewEdit] = useState<string>();
  const storedAddress = previewAddress
    ? (previewEdit ?? previewAddress)
    : savedAddress;
  const isPreview = !!previewAddress;
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
    [toggleSet, expandedMeasures],
  );

  const hasAddress = !!storedAddress;

  // Let Civic resolve the election for THIS address — getElections returns a
  // nationwide list, so picking the soonest from it surfaces the wrong
  // (e.g. out-of-state) election and breaks the ballot lookup.
  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({
      address: storedAddress ?? "",
      electionId,
      includeEnrichment: false,
    }),
    enabled: hasAddress,
    retry: false,
  });

  // Legacy results remain California-only; the migrated provider supplies national ballots.
  const unsupportedState =
    hasAddress &&
    !!voterInfoQuery.data &&
    !isCaliforniaState(voterInfoQuery.data.normalizedInput.state) &&
    voterInfoQuery.data.provider?.name !== "democracy_works";

  const hasVerifiedCaliforniaAddress =
    !!voterInfoQuery.data &&
    isCaliforniaState(voterInfoQuery.data.normalizedInput.state);

  // The address-specific election the ballot belongs to.
  const selected = unsupportedState ? undefined : voterInfoQuery.data?.election;

  const contests = unsupportedState
    ? []
    : (voterInfoQuery.data?.contests ?? []);
  const measures = contests.filter((c: Contest) => c.referendumTitle);
  const candidateContests = contests.filter(
    (c: Contest) => c.candidates && c.candidates.length > 0,
  );
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
                if (isPreview) setPreviewEdit(addr);
                else void setAddress(addr);
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
                <Text style={s.addrKicker}>REGISTERED ADDRESS</Text>
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

      {voterInfoQuery.isLoading && (
        <ActivityIndicator color={colors.bill} style={{ marginVertical: 12 }} />
      )}

      {!!voterInfoQuery.data?.otherElections?.length && (
        <View style={s.section}>
          <Kicker>Other elections</Kicker>
          {voterInfoQuery.data.otherElections.map((election) => (
            <TouchableOpacity
              key={election.id}
              onPress={() => setElectionId(election.id)}
            >
              <Text style={s.readMoreText}>{election.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {voterInfoQuery.data?.provider && (
        <View style={s.section}>
          <Text style={s.empty}>
            {voterInfoQuery.data.provider.addressScope === "statewide_only"
              ? "Statewide contests only. Local races and measures may be missing."
              : voterInfoQuery.data.provider.addressScope === "unknown"
                ? "Address coverage unconfirmed. These contests may not match your address."
                : "Coverage may be incomplete."}
          </Text>
          <SourceLink
            label={
              isPreview ? "Synthetic development fixture" : "Democracy Works"
            }
            url={voterInfoQuery.data.provider.sourceUrl}
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
        !unsupportedState &&
        contests.length === 0 &&
        !voterInfoQuery.isLoading &&
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
        <VotingLogisticsSection
          data={voterInfoQuery.data}
          status={
            !hasAddress
              ? "idle"
              : voterInfoQuery.isLoading
                ? "loading"
                : voterInfoQuery.isError
                  ? "error"
                  : "ready"
          }
        />
      </View>
    </TabScreen>
  );
}

const s = StyleSheet.create({
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
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  addrText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
    marginTop: 1,
  },
  addrEdit: { fontFamily: fontBody.semibold, fontSize: 13, color: colors.bill },
  section: { paddingHorizontal: 20 },
  contestOffice: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 16,
    color: colors.white,
  },
  contestMeta: {
    fontFamily: "AlbertSans-Medium",
    fontSize: 12,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
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
    color: colors.bill,
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  empty: {
    fontFamily: "AlbertSans-Regular",
    fontSize: 14,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
});
