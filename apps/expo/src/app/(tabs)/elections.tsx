import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import type { Contest } from "@acme/api";

import { AddressAutocomplete } from "~/components/AddressAutocomplete";
import { EMPTY_CIVIC } from "~/components/digest/staticAssets";
import { ProfileMarkButton } from "~/components/DigestProfileMark";
import { ElectionHero } from "~/components/ElectionHero";
import { ElectionResultsSection } from "~/components/ElectionResultsSection";
import { LocalDecisionsPreview } from "~/components/LocalDecisionsPreview";
import { RepsSection } from "~/components/RepsSection";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, Segmented, TabScreen } from "~/components/ui";
import { posthog } from "~/config/posthog";
import { useUserAddress } from "~/hooks/useUserAddress";
import {
  fontBody,
  fontDisplay,
  DigestHair,
  DigestPalette,
  DigestRadii,
  DigestSpace,
} from "~/styles";
import { trpc } from "~/utils/api";
import { groupContestsByLevel, measureIsStatewide } from "~/utils/elections";

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
    <Card
      style={{
        padding: 18,
        borderRadius: DigestRadii.card,
        borderColor: DigestHair.cardBorder,
        backgroundColor: DigestPalette.card,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onToggle}
        style={s.measureHeader}
      >
        <Text style={[s.measureTitle, { marginBottom: 0, flex: 1 }]}>
          {m.referendumTitle}
        </Text>
        <Icon name={expanded ? "chevD" : "chevR"} size={16} color={DigestPalette.quiet} />
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
              <Icon name="sparkle" size={11} color={DigestPalette.spark} />
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
                style={[s.stanceDot, { backgroundColor: DigestPalette.badgeTeal }]}
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
                style={[s.stanceDot, { backgroundColor: DigestPalette.badgeIndigo }]}
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
            <Icon name="doc" size={15} color={DigestPalette.spark} />
            <Text style={s.readMoreText}>Read full measure</Text>
          </TouchableOpacity>
          {topSourceLabel(m) ? (
            <View style={s.sourceChip}>
              <Icon
                name={
                  m.sources?.some((src) => src.official) ? "shield" : "info"
                }
                size={11}
                color={DigestPalette.quiet}
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

  // Let Civic resolve the election for THIS address — getElections returns a
  // nationwide list, so picking the soonest from it surfaces the wrong
  // (e.g. out-of-state) election and breaks the ballot lookup.
  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: storedAddress ?? "" }),
    enabled: hasAddress,
    retry: 1,
  });

  // We only have ballot/results data sourced for California right now.
  const unsupportedState =
    hasAddress &&
    !!voterInfoQuery.data &&
    voterInfoQuery.data.normalizedInput.state !== "CA";

  const hasVerifiedCaliforniaAddress =
    !!voterInfoQuery.data && voterInfoQuery.data.normalizedInput.state === "CA";

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
      title="Your Ballot"
      action={<ProfileMarkButton menuTop={insets.top + 52} />}
      contentStyle={{
        gap: 18,
        // Match DigestHome / tab clearance: tab bar + home-indicator + breath
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
          <View style={s.addrCard}>
            <Icon name="pin" size={19} color={DigestPalette.spark} />
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
        )
      }
    >
      {!hasAddress && (
        <View style={s.emptyStack}>
          {/* Calm editorial empty — photo + one serene lead (tips merged; no duplicate) */}
          <View style={s.emptyHero}>
            <Image
              source={EMPTY_CIVIC}
              style={s.emptyHeroImage}
              contentFit="cover"
              transition={200}
              accessibilityIgnoresInvertColors
            />
            <View style={s.emptyHeroBody}>
              <Text style={s.emptyEyebrow}>YOUR BALLOT</Text>
              <Text style={s.emptyLead}>
                Enter your registered address above.
              </Text>
              <Text style={s.emptyDek}>
                We&apos;ll load official contests, measures, and who represents
                you for that address — never inventing districts.
              </Text>
            </View>
          </View>

          {/* Generic civic calendar hints only — no invented election/district data */}
          <View style={s.emptyDates}>
            <Text style={s.emptyDatesEyebrow}>BEFORE ELECTION DAY</Text>
            <Text style={s.emptyDatesTitle}>Typical California timeline</Text>
            <View style={s.emptyDateRow}>
              <Text style={s.emptyDateLabel}>Register</Text>
              <Text style={s.emptyDateValue}>
                About 15 days before Election Day
              </Text>
            </View>
            <View style={s.emptyDateHair} />
            <View style={s.emptyDateRow}>
              <Text style={s.emptyDateLabel}>Ballots mailed</Text>
              <Text style={s.emptyDateValue}>
                About 4 weeks before Election Day
              </Text>
            </View>
            <View style={s.emptyDateHair} />
            <View style={s.emptyDateRow}>
              <Text style={s.emptyDateLabel}>Election Day</Text>
              <Text style={s.emptyDateValue}>
                Exact dates appear after address lookup
              </Text>
            </View>
          </View>
        </View>
      )}

      {hasAddress && voterInfoQuery.isError && (
        <View style={s.section}>
          <Card
            style={{
              borderRadius: DigestRadii.card,
              borderColor: DigestHair.cardBorder,
              backgroundColor: DigestPalette.card,
            }}
          >
            <Text style={s.empty}>
              We couldn't look up your ballot. Check your address and try again.
            </Text>
          </Card>
        </View>
      )}

      {unsupportedState && (
        <View style={s.section}>
          <Card
            style={{
              borderRadius: DigestRadii.card,
              borderColor: DigestHair.cardBorder,
              backgroundColor: DigestPalette.card,
            }}
          >
            <Text style={s.empty}>
              We only cover California elections right now. Support for your
              state is coming soon.
            </Text>
          </Card>
        </View>
      )}

      {/* local government decisions — what city hall is doing right now */}
      <LocalDecisionsPreview address={storedAddress} />

      {/* election hero — what election is happening, what it means */}
      {selected && <ElectionHero election={selected} />}

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
          <Card style={s.lookupCard}>
            <ActivityIndicator color={DigestPalette.spark} />
            <View style={s.lookupCopy}>
              <Text style={s.lookupTitle}>Looking up your ballot</Text>
              <Text style={s.lookupSub}>
                Checking your election and elected officials…
              </Text>
            </View>
          </Card>
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
            <Card
            style={{
              borderRadius: DigestRadii.card,
              borderColor: DigestHair.cardBorder,
              backgroundColor: DigestPalette.card,
            }}
          >
              <Text style={s.empty}>No candidate contests on this ballot.</Text>
            </Card>
          )}
          {candidateGroups.map((group) => (
            <View key={group.key} style={{ gap: 12 }}>
              <Kicker>{group.label}</Kicker>
              <View style={{ gap: 14 }}>
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
                  >
                    <Card
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderRadius: DigestRadii.card,
                        borderColor: DigestHair.cardBorder,
                        backgroundColor: DigestPalette.card,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={s.contestOffice} numberOfLines={2}>
                          {c.office}
                        </Text>
                        {c.candidates && c.candidates.length > 0 && (
                          <Text style={s.contestMeta}>
                            {c.candidates.length} candidate
                            {c.candidates.length !== 1 ? "s" : ""}
                          </Text>
                        )}
                      </View>
                      <Icon name="chevR" size={16} color={DigestPalette.quiet} />
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
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
              <Card
            style={{
              borderRadius: DigestRadii.card,
              borderColor: DigestHair.cardBorder,
              backgroundColor: DigestPalette.card,
            }}
          >
                <Text style={s.empty}>
                  No statewide propositions on this ballot.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: 14 }}>
                {statewideMeasures.map((m) => (
                  <MeasureCard
                    key={`sw-${measures.indexOf(m)}`}
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
                ))}
              </View>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Kicker>Local measures</Kicker>
            {localMeasures.length === 0 ? (
              <Card
            style={{
              borderRadius: DigestRadii.card,
              borderColor: DigestHair.cardBorder,
              backgroundColor: DigestPalette.card,
            }}
          >
                <Text style={s.empty}>No local measures on this ballot.</Text>
              </Card>
            ) : (
              <View style={{ gap: 14 }}>
                {localMeasures.map((m) => (
                  <MeasureCard
                    key={`lo-${measures.indexOf(m)}`}
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
                ))}
              </View>
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
            <Card
            style={{
              borderRadius: DigestRadii.card,
              borderColor: DigestHair.cardBorder,
              backgroundColor: DigestPalette.card,
            }}
          >
              <Text style={s.empty}>
                No ballot information for this address yet. Tap Edit above to
                try a different registered address.
              </Text>
            </Card>
          </View>
        )}

      {/* polling place exit */}
      <View style={s.section}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/local-elections")}
        >
          <Card style={s.pollRow}>
            <View style={s.pollIcon}>
              <Icon name="pin" size={22} color={DigestPalette.badgeTeal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pollTitle}>Find your polling place</Text>
              <Text style={s.pollSub}>Verified on vote.gov</Text>
            </View>
            <Icon name="external" size={18} color={DigestPalette.quiet} />
          </Card>
        </TouchableOpacity>
      </View>
    </TabScreen>
  );
}

const s = StyleSheet.create({
  addrCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: DigestPalette.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    borderRadius: DigestRadii.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  addrBody: { flex: 1, minWidth: 0 },
  addrKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    color: DigestPalette.spark,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  addrText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: DigestPalette.inkOnNight,
    marginTop: 1,
  },
  addrEdit: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: DigestPalette.spark,
  },
  section: { paddingHorizontal: DigestSpace.screenPadX },
  lookupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderRadius: DigestRadii.card,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.card,
  },
  lookupCopy: { flex: 1, gap: 2 },
  lookupTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: DigestPalette.inkOnNight,
  },
  lookupSub: {
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: DigestPalette.quiet,
  },
  contestOffice: {
    fontFamily: fontDisplay.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: DigestPalette.inkOnNight,
  },
  contestMeta: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: DigestPalette.quiet,
    marginTop: 3,
  },
  measureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  measureTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 17,
    letterSpacing: -0.35,
    color: DigestPalette.inkOnNight,
    marginBottom: 12,
  },
  measureBody: { marginTop: 14, gap: 12 },
  measureSub: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    color: DigestPalette.quiet,
    lineHeight: 20,
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
    fontSize: 13.5,
    color: DigestPalette.quiet,
    lineHeight: 20,
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: DigestPalette.canvas,
    borderRadius: DigestRadii.menu,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  readMoreText: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: DigestPalette.spark,
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
    color: DigestPalette.spark,
  },
  fiscalRow: { gap: 3 },
  fiscalLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 11.5,
    color: DigestPalette.quiet,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  fiscalValue: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: DigestPalette.quiet,
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
    color: DigestPalette.quiet,
  },
  empty: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: DigestPalette.quiet,
    lineHeight: 20,
    textAlign: "left",
  },
  emptyStack: {
    paddingHorizontal: DigestSpace.screenPadX,
    gap: 10,
  },
  emptyHero: {
    borderRadius: DigestRadii.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.card,
    overflow: "hidden",
  },
  emptyHeroImage: {
    width: "100%",
    height: 148,
  },
  emptyHeroBody: {
    paddingHorizontal: DigestSpace.cardBodyPadX,
    paddingTop: DigestSpace.cardBodyPadTop,
    paddingBottom: DigestSpace.cardBodyPadBottom,
    gap: 8,
  },
  emptyEyebrow: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: DigestPalette.spark,
    textTransform: "uppercase",
  },
  emptyLead: {
    fontFamily: fontDisplay.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.45,
    color: DigestPalette.inkOnNight,
  },
  emptyDek: {
    fontFamily: fontBody.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: DigestPalette.quiet,
  },
  emptyDates: {
    borderRadius: DigestRadii.card,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.card,
    paddingHorizontal: DigestSpace.cardBodyPadX,
    paddingTop: 14,
    paddingBottom: 14,
  },
  emptyDatesEyebrow: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: DigestPalette.spark,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  emptyDatesTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.35,
    color: DigestPalette.inkOnNight,
    marginBottom: 12,
  },
  emptyDateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
  },
  emptyDateLabel: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: DigestPalette.inkOnNight,
    width: 110,
  },
  emptyDateValue: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 13,
    lineHeight: 18,
    color: DigestPalette.quiet,
    textAlign: "right",
  },
  emptyDateHair: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DigestHair.sectionRule,
  },
  pollRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: DigestRadii.card,
    borderColor: DigestHair.cardBorder,
    backgroundColor: DigestPalette.card,
  },
  pollIcon: {
    width: 44,
    height: 44,
    borderRadius: DigestRadii.menu,
    backgroundColor: DigestHair.tabActivePill,
    alignItems: "center",
    justifyContent: "center",
  },
  pollTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 14.5,
    color: DigestPalette.inkOnNight,
  },
  pollSub: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: DigestPalette.quiet,
  },
});
