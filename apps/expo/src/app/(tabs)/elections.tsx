import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { Contest } from "@acme/api";

import { AddressAutocomplete } from "~/components/AddressAutocomplete";
import { EmptyBallotMark, PinMark } from "~/components/digest/CraftMarks";
import { EMPTY_CIVIC } from "~/components/digest/staticAssets";
import { ProfileMarkButton } from "~/components/DigestProfileMark";
import { ElectionHero } from "~/components/ElectionHero";
import { ElectionResultsSection } from "~/components/ElectionResultsSection";
import { LocalDecisionsPreview } from "~/components/LocalDecisionsPreview";
import { RepsSection } from "~/components/RepsSection";
import { Text } from "~/components/Themed";
import { Icon, Kicker, TabScreen } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useUserAddress } from "~/hooks/useUserAddress";
import {
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontDisplay,
} from "~/styles";
import { trpc } from "~/utils/api";
import { monthDay } from "~/utils/dates";
import {
  contestListTitle,
  earliestEarlyVoteStart,
  groupContestsByLevel,
  isCaliforniaState,
  measureIsStatewide,
  pickUpcomingCaliforniaElection,
  pollingPlaceSubtitle,
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

/** Expandable row for a single ballot measure (statewide or local). */
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
    <View style={s.measureRow}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onToggle}
        style={s.measureHeader}
      >
        <Text style={[s.measureTitle, { marginBottom: 0, flex: 1 }]}>
          {m.referendumTitle}
        </Text>
        <Icon
          name={expanded ? "chevD" : "chevR"}
          size={16}
          color={DigestPalette.quiet}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={s.measureBody}>
          {m.summaryShort || m.summary || m.referendumSubtitle ? (
            <Text style={s.measureSub}>
              {m.summaryShort ?? m.summary ?? m.referendumSubtitle}
            </Text>
          ) : null}
          {m.summaryIsAiGenerated && (
            <Text style={s.aiChipText}>Billion AI</Text>
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
                style={[
                  s.stanceDot,
                  { backgroundColor: DigestPalette.badgeTeal },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.stanceLabel}>A YES vote means</Text>
                <Text style={s.stanceText}>{m.referendumProStatement}</Text>
              </View>
            </View>
          ) : null}
          {m.referendumConStatement ? (
            <View style={s.stanceRow}>
              <View
                style={[s.stanceDot, { backgroundColor: DigestPalette.spark }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.stanceLabel}>A NO vote means</Text>
                <Text style={s.stanceText}>{m.referendumConStatement}</Text>
              </View>
            </View>
          ) : null}
          <TouchableOpacity
            style={s.readMoreBtn}
            activeOpacity={0.8}
            onPress={onReadMore}
          >
            <Text style={s.readMoreText}>Read full measure</Text>
          </TouchableOpacity>
          {topSourceLabel(m) ? (
            <Text style={s.sourceChipText} numberOfLines={1}>
              {topSourceLabel(m)}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function ElectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { address: storedAddress, setAddress } = useUserAddress();
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

  // Nationwide list is only a teaser before an address is set. Ballot contests
  // always come from getVoterInfo so Civic can resolve THIS address.
  const electionsQuery = useQuery({
    ...trpc.civic.getElections.queryOptions(),
    enabled: !hasAddress,
  });
  const upcomingCaliforniaElection = pickUpcomingCaliforniaElection(
    electionsQuery.data ?? [],
  );

  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: storedAddress ?? "" }),
    enabled: hasAddress,
    retry: 1,
  });

  // Ballot/results coverage is California-only. Civic usually sends "CA";
  // accept the full name so production voterinfo still gates correctly.
  const unsupportedState =
    hasAddress &&
    !!voterInfoQuery.data &&
    !isCaliforniaState(voterInfoQuery.data.normalizedInput.state);

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
  const statewideMeasures = measures.filter(measureIsStatewide);
  const localMeasures = measures.filter((m) => !measureIsStatewide(m));

  return (
    <TabScreen
      title="Ballot"
      action={<ProfileMarkButton menuTop={insets.top + 52} />}
      contentStyle={{
        gap: 8,
        paddingBottom: 100 + insets.bottom,
      }}
      headerExtra={
        editing || !storedAddress ? (
          <AddressAutocomplete
            initialValue={storedAddress ?? ""}
            hint={null}
            onSubmit={(addr) => {
              void setAddress(addr);
              setEditing(false);
              posthog.capture("voter_address_set", {
                is_update: !!storedAddress,
              });
            }}
          />
        ) : (
          <TouchableOpacity
            style={s.addrRow}
            onPress={() => setEditing(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Edit registered address"
          >
            <PinMark size={14} color={DigestPalette.spark} />
            <Text style={s.addrText} numberOfLines={1}>
              {storedAddress}
            </Text>
            <Text style={s.addrEdit}>Edit</Text>
          </TouchableOpacity>
        )
      }
    >
      {!hasAddress && (
        <View style={s.emptyStack}>
          <View style={s.emptyHero}>
            <Image
              source={EMPTY_CIVIC}
              style={s.emptyHeroImage}
              contentFit="cover"
              transition={200}
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={["transparent", DigestPalette.canvas]}
              locations={[0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.emptyOverlay}>
              <Text style={s.emptyEyebrow}>Your ballot</Text>
              <Text style={s.emptyLead}>Enter a registered address.</Text>
            </View>
          </View>

          {upcomingCaliforniaElection ? (
            <View style={s.emptyDates}>
              <Text style={s.emptyDatesEyebrow}>
                {upcomingCaliforniaElection.name}
              </Text>
              <View style={s.emptyDateRow}>
                <Text style={s.emptyDateLabel}>Election Day</Text>
                <Text style={s.emptyDateValue}>
                  {monthDay(upcomingCaliforniaElection.electionDay)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {hasAddress && voterInfoQuery.isError && (
        <View style={s.section}>
          <EmptyBallotMark width={72} />
          <Text style={s.empty}>
            Couldn’t look up this ballot. Check the address and try again.
          </Text>
        </View>
      )}

      {unsupportedState && (
        <View style={s.section}>
          <EmptyBallotMark width={72} />
          <Text style={s.empty}>
            California ballots only, for now. Your state is coming.
          </Text>
        </View>
      )}

      {/* local government decisions — what city hall is doing right now */}
      <LocalDecisionsPreview address={storedAddress} />

      {/* election hero — what election is happening, what it means */}
      {selected && (
        <ElectionHero
          election={selected}
          earlyVoteStart={earliestEarlyVoteStart(
            voterInfoQuery.data?.earlyVoteSites,
          )}
        />
      )}

      {/* live results (CA SOS feed): statewide + the voter's district races,
          scoped from their ballot. Self-hides when off-season. Only
          meaningful once we know the voter is in a state we cover. */}
      {hasVerifiedCaliforniaAddress && selected && (
        <ElectionResultsSection
          contests={contests}
          electionDay={selected.electionDay}
          electionName={selected.name}
        />
      )}

      <RepsSection
        address={storedAddress}
        enabled={hasVerifiedCaliforniaAddress}
      />

      {voterInfoQuery.isLoading && (
        <View style={s.section}>
          <View style={s.lookupRow}>
            <ActivityIndicator color={DigestPalette.spark} />
            <Text style={s.lookupTitle}>Looking up your ballot</Text>
          </View>
        </View>
      )}

      {contests.length > 0 && (
        <View style={s.filterRow}>
          {(
            [
              {
                id: "candidates" as const,
                label: "Candidates",
                count: candidateContests.length,
              },
              {
                id: "measures" as const,
                label: "Measures",
                count: measures.length,
              },
            ] as const
          ).map((f) => {
            const active = tab === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setTab(f.id)}
                activeOpacity={0.8}
                style={s.filterTab}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.filterLabel, active && s.filterLabelOn]}>
                  {f.label}
                  {f.count ? `  ${f.count}` : ""}
                </Text>
                {active ? <View style={s.filterRule} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* CANDIDATES TAB — contests grouped by government level */}
      {contests.length > 0 && tab === "candidates" && (
        <View style={[s.section, { gap: 20 }]}>
          {candidateGroups.length === 0 && (
            <Text style={s.empty}>No candidate contests on this ballot.</Text>
          )}
          {candidateGroups.map((group) => (
            <View key={group.key}>
              <Kicker>{group.label}</Kicker>
              {group.contests.map((c: Contest, i: number) => (
                <TouchableOpacity
                  key={`${group.key}-${i}`}
                  activeOpacity={0.85}
                  onPress={() => {
                    posthog.capture("contest_detail_opened", {
                      office: c.office ?? null,
                      district: c.district?.name ?? null,
                      candidate_count: c.candidates?.length ?? 0,
                      government_level: group.label,
                    });
                    router.push({
                      pathname: "/contest-detail",
                      params: {
                        office: c.office ?? "",
                        roles: JSON.stringify(c.roles ?? []),
                        levels: JSON.stringify(c.level ?? []),
                        candidates: JSON.stringify(c.candidates ?? []),
                        districtName: c.district?.name ?? "",
                        roleDescription: c.roleDescription ?? "",
                      },
                    });
                  }}
                  style={[s.contestRow, i > 0 && s.rowHair]}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={s.contestOffice} numberOfLines={2}>
                      {contestListTitle(c)}
                    </Text>
                    {c.candidates && c.candidates.length > 0 && (
                      <Text style={s.contestMeta}>
                        {c.candidates.length} candidate
                        {c.candidates.length !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                  <Icon name="chevR" size={16} color={DigestPalette.quiet} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* MEASURES TAB — statewide propositions + local measures */}
      {contests.length > 0 && tab === "measures" && (
        <View style={[s.section, { gap: 20 }]}>
          <View style={{ gap: 12 }}>
            <Kicker>Statewide propositions</Kicker>
            {statewideMeasures.length === 0 ? (
              <Text style={s.empty}>
                No statewide propositions on this ballot.
              </Text>
            ) : (
              statewideMeasures.map((m, i) => (
                <View
                  key={`sw-${measures.indexOf(m)}`}
                  style={i > 0 ? s.rowHair : undefined}
                >
                  <MeasureCard
                    measure={m}
                    expanded={expandedMeasures.has(measures.indexOf(m))}
                    onToggle={() => toggleMeasure(measures.indexOf(m), m)}
                    onReadMore={() => {
                      posthog.capture("ballot_measure_detail_opened", {
                        measure_title: m.referendumTitle ?? null,
                        is_statewide: true,
                      });
                      router.push(measureRoute(m));
                    }}
                  />
                </View>
              ))
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Kicker>Local measures</Kicker>
            {localMeasures.length === 0 ? (
              <Text style={s.empty}>No local measures on this ballot.</Text>
            ) : (
              localMeasures.map((m, i) => (
                <View
                  key={`lo-${measures.indexOf(m)}`}
                  style={i > 0 ? s.rowHair : undefined}
                >
                  <MeasureCard
                    measure={m}
                    expanded={expandedMeasures.has(measures.indexOf(m))}
                    onToggle={() => toggleMeasure(measures.indexOf(m), m)}
                    onReadMore={() => {
                      posthog.capture("ballot_measure_detail_opened", {
                        measure_title: m.referendumTitle ?? null,
                        is_statewide: false,
                      });
                      router.push(measureRoute(m));
                    }}
                  />
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {hasAddress &&
        !unsupportedState &&
        contests.length === 0 &&
        !voterInfoQuery.isLoading &&
        !voterInfoQuery.isError && (
          <View style={s.section}>
            <EmptyBallotMark width={72} />
            <Text style={s.empty}>
              No ballot for this address yet. Edit above to try another.
            </Text>
          </View>
        )}

      {/* polling place exit — locations come from getVoterInfo when present */}
      <View style={s.section}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/local-elections")}
          style={s.pollRow}
          accessibilityRole="button"
          accessibilityLabel="Find your polling place"
        >
          <PinMark size={18} color={DigestPalette.spark} />
          <View style={{ flex: 1 }}>
            <Text style={s.pollTitle}>Polling place</Text>
            <Text style={s.pollSub}>
              {pollingPlaceSubtitle(
                voterInfoQuery.data?.pollingLocations,
                voterInfoQuery.data?.mailOnly,
              ) ??
                (hasAddress
                  ? "Maps, hours, and drop boxes"
                  : "Look up after you add an address")}
            </Text>
          </View>
          <Icon name="chevR" size={16} color={DigestPalette.quiet} />
        </TouchableOpacity>
      </View>
    </TabScreen>
  );
}

const s = StyleSheet.create({
  addrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 4,
  },
  addrText: {
    flex: 1,
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
  },
  addrEdit: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.spark,
  },
  section: { paddingHorizontal: DigestSpace.screenPadX },
  lookupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
  },
  lookupTitle: {
    fontFamily: fontBody.medium,
    fontSize: 15,
    color: DigestPalette.quiet,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: DigestSpace.screenPadX,
    gap: 20,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: "flex-end",
  },
  filterTab: {
    paddingBottom: 8,
  },
  filterLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 16,
    color: DigestPalette.quiet,
  },
  filterLabelOn: {
    color: DigestPalette.inkOnNight,
  },
  filterRule: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: DigestPalette.spark,
    borderRadius: 1,
  },
  contestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  rowHair: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
  },
  contestOffice: {
    fontFamily: fontDisplay.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: DigestPalette.inkOnNight,
  },
  contestMeta: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: DigestPalette.quiet,
    marginTop: 4,
  },
  measureRow: {
    paddingVertical: 16,
  },
  measureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  measureTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: DigestPalette.inkOnNight,
    marginBottom: 12,
  },
  measureBody: { marginTop: 14, gap: 12 },
  measureSub: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: DigestPalette.quiet,
    lineHeight: 21,
  },
  stanceRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stanceDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  stanceLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 12.5,
    color: DigestPalette.inkOnNight,
    marginBottom: 3,
  },
  stanceText: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: DigestPalette.quiet,
    lineHeight: 20,
  },
  readMoreBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  readMoreText: {
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: DigestPalette.spark,
  },
  aiChipText: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: DigestPalette.spark,
  },
  fiscalRow: { gap: 3 },
  fiscalLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  fiscalValue: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: DigestPalette.quiet,
    lineHeight: 20,
  },
  sourceChipText: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: DigestPalette.quiet,
  },
  empty: {
    fontFamily: fontBody.regular,
    fontSize: 15,
    color: DigestPalette.quiet,
    lineHeight: 22,
    marginTop: 10,
  },
  emptyStack: {
    paddingHorizontal: DigestSpace.screenPadX,
    gap: 8,
  },
  emptyHero: {
    height: 240,
    borderRadius: DigestRadii.card,
    overflow: "hidden",
    backgroundColor: DigestPalette.stone,
  },
  emptyHeroImage: {
    width: "100%",
    height: "100%",
  },
  emptyOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    gap: 6,
  },
  emptyEyebrow: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: DigestPalette.spark,
    textTransform: "uppercase",
  },
  emptyLead: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: DigestPalette.inkOnNight,
  },
  emptyDates: {
    paddingTop: 8,
  },
  emptyDatesEyebrow: {
    fontFamily: fontBody.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emptyDateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  emptyDateLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
  },
  emptyDateValue: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 14,
    lineHeight: 18,
    color: DigestPalette.quiet,
    textAlign: "right",
  },
  pollRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.sectionRule,
    marginTop: 12,
  },
  pollTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: DigestPalette.inkOnNight,
  },
  pollSub: {
    fontFamily: fontBody.medium,
    fontSize: 13,
    color: DigestPalette.quiet,
    marginTop: 2,
  },
});
