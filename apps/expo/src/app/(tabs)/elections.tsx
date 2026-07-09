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
import { ElectionHero } from "~/components/ElectionHero";
import { ElectionResultsSection } from "~/components/ElectionResultsSection";
import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, Segmented, TabScreen } from "~/components/ui";
import { useUserAddress } from "~/hooks/useUserAddress";
import { colors, fontBody, hair, planes } from "~/styles";
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
                <Text style={s.stanceLabel}>A YES vote means</Text>
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
  const router = useRouter();
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
    (idx: number) => toggleSet(setExpandedMeasures, idx),
    [toggleSet],
  );

  const hasAddress = !!storedAddress;

  // Let Civic resolve the election for THIS address — getElections returns a
  // nationwide list, so picking the soonest from it surfaces the wrong
  // (e.g. out-of-state) election and breaks the ballot lookup.
  const voterInfoQuery = useQuery({
    ...trpc.civic.getVoterInfo.queryOptions({ address: storedAddress ?? "" }),
    enabled: hasAddress,
  });

  // We only have ballot/results data sourced for California right now.
  const unsupportedState =
    hasAddress &&
    !!voterInfoQuery.data &&
    voterInfoQuery.data.normalizedInput.state !== "CA";

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
      contentStyle={{ gap: 24 }}
      headerExtra={
        editing || !storedAddress ? (
          <AddressAutocomplete
            initialValue={storedAddress ?? ""}
            onSubmit={(addr) => {
              void setAddress(addr);
              setEditing(false);
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
        )
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
          <Card>
            <Text style={s.empty}>
              We couldn't look up your ballot. Check your address and try again.
            </Text>
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
      {hasAddress && !unsupportedState && (
        <ElectionResultsSection contests={contests} />
      )}

      {voterInfoQuery.isLoading && (
        <ActivityIndicator color={colors.bill} style={{ marginVertical: 12 }} />
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
                  <TouchableOpacity
                    key={`${group.key}-${i}`}
                    activeOpacity={0.85}
                    onPress={() =>
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
                      })
                    }
                  >
                    <Card
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
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
                      <Icon name="chevR" size={16} color="#5B6172" />
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
              <Card>
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
                    onToggle={() => toggleMeasure(measures.indexOf(m))}
                    onReadMore={() => router.push(measureRoute(m))}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <Kicker>Local measures</Kicker>
            {localMeasures.length === 0 ? (
              <Card>
                <Text style={s.empty}>No local measures on this ballot.</Text>
              </Card>
            ) : (
              <View style={{ gap: 14 }}>
                {localMeasures.map((m) => (
                  <MeasureCard
                    key={`lo-${measures.indexOf(m)}`}
                    measure={m}
                    expanded={expandedMeasures.has(measures.indexOf(m))}
                    onToggle={() => toggleMeasure(measures.indexOf(m))}
                    onReadMore={() => router.push(measureRoute(m))}
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
            <Card>
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
              <Icon name="pin" size={22} color={colors.green[500]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.pollTitle}>Find your polling place</Text>
              <Text style={s.pollSub}>Verified on vote.gov</Text>
            </View>
            <Icon name="external" size={18} color={colors.textSecondary} />
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
