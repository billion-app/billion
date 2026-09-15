import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Keyboard,
  LayoutAnimation,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Fuse from "fuse.js";

import {
  AiSummaryLabel,
  BallotDetailEvidence,
  BallotLanguages,
  BallotSources,
  ElectionOfficeLink,
} from "~/components/ballot-evidence/BallotEvidence";
import {
  BallotReadingMode,
  BallotReadingText,
} from "~/components/ballot-evidence/BallotReadingCard";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { Card, Icon, Kicker, NavHeader } from "~/components/ui";
import {
  DigestHair,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontDisplay,
  fontEditorial,
  DigestPalette as P,
  planes,
} from "~/styles";

const cardChrome = {
  backgroundColor: P.card,
  borderRadius: DigestRadii.menu,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: DigestHair.cardBorder,
} as const;

interface CandidateCitation {
  field: string;
  sourceName: string;
  sourceUrl?: string;
  tier: string;
  official: boolean;
}

interface CandidateParam {
  name: string;
  party?: string;
  candidateUrl?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  channels?: { type: string; id: string }[];
  biography?: string;
  statement?: string;
  statementSummary?: string;
  statementSummaryIsAiGenerated?: boolean;
  incumbent?: boolean;
  ballotStatus?: "onBallot" | "withdrewStillOnBallot";
  citations?: CandidateCitation[];
}

function partyLabel(party?: string): string {
  const label = party?.trim() ?? "";
  return label.length ? label : "Party unavailable";
}

/**
 * A candidate's statement of qualifications. When an AI summary exists alongside
 * the verbatim statement, show a two-tab control (AI summary first, then the
 * verbatim text) mirroring the measure detail screen. With only one of the two,
 * render it directly without tabs.
 */
function CandidateStatement({ cand }: { cand: CandidateParam }) {
  const hasSummary = !!cand.statementSummary?.trim();
  const hasVerbatim = !!cand.statement?.trim();
  const summaryIsAi =
    cand.statementSummaryIsAiGenerated === true ||
    cand.citations?.some(
      (citation) =>
        citation.field === "statementSummary" &&
        citation.tier === "ai_generated",
    );
  const [mode, setMode] = useState<"summary" | "verbatim">(
    hasSummary ? "summary" : "verbatim",
  );
  if (!hasSummary && !hasVerbatim) return null;

  const showTabs = hasSummary && hasVerbatim;
  const showingSummary = hasSummary && (mode === "summary" || !hasVerbatim);

  return (
    <View style={s.statementWrap}>
      <Text accessibilityRole="header" style={s.readingLabel}>
        {showTabs || !showingSummary
          ? "Candidate statement"
          : "Statement summary"}
      </Text>
      {showTabs && (
        <BallotReadingMode
          value={mode}
          onChange={setMode}
          options={[
            { value: "summary", label: "Summary" },
            { value: "verbatim", label: "Original statement" },
          ]}
        />
      )}
      {showingSummary && summaryIsAi && <AiSummaryLabel />}
      <BallotReadingText
        text={(showingSummary ? cand.statementSummary : cand.statement) ?? ""}
      />
    </View>
  );
}

export default function ContestDetailScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const params = useLocalSearchParams<{
    office: string;
    roles: string;
    levels: string;
    candidates: string;
    districtName: string;
    roleDescription: string;
  }>();

  const candidates: CandidateParam[] = useMemo(
    () =>
      params.candidates
        ? (JSON.parse(params.candidates) as CandidateParam[])
        : [],
    [params.candidates],
  );
  const description = params.roleDescription || null;

  // Expansion keyed by candidate identity (name + original index), not array
  // index — index-keying breaks once the list is filtered.
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    candidates.length === 1 && candidates[0]
      ? new Set([`${candidates[0].name}-0`])
      : new Set(),
  );
  const [query, setQuery] = useState("");
  const [hasStatementOnly, setHasStatementOnly] = useState(false);
  const [activeParty, setActiveParty] = useState<string | null>(null);

  const toggle = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /** Party labels actually present in this contest, in first-seen order. */
  const partyOptions = useMemo(() => {
    const seen: string[] = [];
    for (const c of candidates) {
      const p = partyLabel(c.party);
      if (!seen.includes(p)) seen.push(p);
    }
    return seen;
  }, [candidates]);

  // Fuzzy index over fields a voter might type. Weighted so a name hit
  // outranks a stray statement/party hit. Rebuilt only when the list changes.
  const fuse = useMemo(
    () =>
      new Fuse(candidates, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "party", weight: 0.2 },
          { name: "statementSummary", weight: 0.05 },
          { name: "statement", weight: 0.05 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [candidates],
  );

  const filtered = useMemo(() => {
    // Exact predicates (party chip, has-statement toggle) narrow first.
    const base = candidates.filter((c) => {
      if (
        hasStatementOnly &&
        !c.statement?.trim() &&
        !c.statementSummary?.trim()
      )
        return false;
      if (activeParty && partyLabel(c.party) !== activeParty) return false;
      return true;
    });

    const q = query.trim();
    if (!q) return base;

    // Fuzzy-rank by relevance. Search the full index, then keep only rows that
    // also survived the exact predicates — preserves Fuse's score order.
    const allowed = new Set(base);
    return fuse
      .search(q)
      .map((r) => r.item)
      .filter((c) => allowed.has(c));
  }, [candidates, fuse, query, hasStatementOnly, activeParty]);

  const filtering = !!query.trim() || hasStatementOnly || activeParty !== null;

  return (
    <View style={s.screen}>
      <NavHeader
        key={fontScale}
        title="Candidates"
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text accessibilityRole="header" style={s.office}>
          {params.office}
        </Text>
        {params.districtName ? (
          <Text style={s.district}>{params.districtName}</Text>
        ) : null}

        {description ? (
          <View style={s.section}>
            <Kicker style={s.kicker}>About this office</Kicker>
            <Card style={cardChrome}>
              <Text style={s.descText}>{description}</Text>
            </Card>
          </View>
        ) : null}

        <View style={s.section}>
          {(candidates.length > 1 || filtering) && (
            <Text style={s.readingLabel}>
              {filtering
                ? `${filtered.length} of ${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`
                : `${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`}
            </Text>
          )}

          {candidates.length > 5 && (
            <View style={s.filters}>
              <TextInput
                accessibilityLabel="Search candidates"
                placeholder="Search candidates"
                placeholderTextColor={P.quiet}
                style={s.search}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
                clearButtonMode="while-editing"
              />
              <View style={s.filterOptions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: hasStatementOnly }}
                  style={[s.filterOption, hasStatementOnly && s.filterSelected]}
                  onPress={() => setHasStatementOnly((v) => !v)}
                >
                  <Text style={s.filterText}>Has statement</Text>
                </Pressable>
                {partyOptions.length > 1 &&
                  partyOptions.map((p) => (
                    <Pressable
                      key={p}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activeParty === p }}
                      style={[
                        s.filterOption,
                        activeParty === p && s.filterSelected,
                      ]}
                      onPress={() =>
                        setActiveParty((cur) => (cur === p ? null : p))
                      }
                    >
                      <Text style={s.filterText}>{p}</Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          )}

          {filtered.length === 0 && (
            <View style={s.emptyState}>
              <Text accessibilityRole="header" style={s.emptyTitle}>
                {candidates.length
                  ? "No candidates match your filters."
                  : "Candidate details unavailable"}
              </Text>
              {!candidates.length && (
                <Text style={s.candBio}>
                  Billion has no candidate details for this contest. Check your
                  election office for the official candidate list.
                </Text>
              )}
              {candidates.length ? (
                <Pressable
                  accessibilityRole="button"
                  style={[s.statementTab, s.clearFilters]}
                  onPress={() => {
                    setQuery("");
                    setActiveParty(null);
                    setHasStatementOnly(false);
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={[s.statementTabText, { color: P.canvas }]}>
                    Clear filters
                  </Text>
                </Pressable>
              ) : (
                <ElectionOfficeLink prominence="primary" />
              )}
            </View>
          )}

          <View style={{ gap: 12 }}>
            {filtered.map((cand) => {
              const key = `${cand.name}-${candidates.indexOf(cand)}`;
              const open = expanded.has(key);
              const contactRows = [
                cand.candidateUrl && {
                  icon: "globe" as const,
                  label: "Website",
                  value: cand.candidateUrl,
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  onPress: () => void Linking.openURL(cand.candidateUrl!),
                },
                cand.phone && {
                  icon: "message" as const,
                  label: "Phone",
                  value: cand.phone,
                  onPress: () => void Linking.openURL(`tel:${cand.phone}`),
                },
                cand.email && {
                  icon: "edit" as const,
                  label: "Email",
                  value: cand.email,
                  onPress: () => void Linking.openURL(`mailto:${cand.email}`),
                },
              ].filter(Boolean) as {
                icon: "globe" | "message" | "edit";
                label: string;
                value: string;
                onPress: () => void;
              }[];

              const sources = cand.citations ?? [];
              const hasStatement =
                !!cand.statement?.trim() || !!cand.statementSummary?.trim();

              return (
                <Card key={key} style={s.candidateSection}>
                  <TouchableOpacity
                    style={s.candHeader}
                    accessibilityRole="button"
                    accessibilityLabel={[
                      cand.name,
                      cand.party,
                      cand.incumbent ? "Incumbent" : undefined,
                      cand.ballotStatus === "withdrewStillOnBallot"
                        ? "Withdrawn; still on ballot"
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    accessibilityState={{ expanded: open }}
                    activeOpacity={0.7}
                    onPress={() => toggle(key)}
                  >
                    {cand.photoUrl ? (
                      <Image
                        source={{ uri: cand.photoUrl }}
                        style={s.partyPhoto}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={s.identityIcon}>
                        <Icon name="user" size={20} color={P.inkOnNight} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={s.candNameRow}>
                        <Text style={s.candName}>{cand.name}</Text>
                        {cand.incumbent ? (
                          <View style={s.incumbentBadge}>
                            <Text style={s.incumbentText}>Incumbent</Text>
                          </View>
                        ) : null}
                      </View>
                      {cand.party ? (
                        <Text style={s.candParty}>{cand.party}</Text>
                      ) : null}
                      {cand.ballotStatus === "withdrewStillOnBallot" && (
                        <Text style={s.withdrawn}>
                          Withdrawn; still on ballot
                        </Text>
                      )}
                    </View>
                    <Icon
                      name={open ? "chevD" : "chevR"}
                      size={16}
                      color={P.quiet}
                    />
                  </TouchableOpacity>
                  {open && (
                    <View style={s.candBody}>
                      {cand.biography ? (
                        <View style={s.readingSection}>
                          <Text
                            accessibilityRole="header"
                            style={s.readingLabel}
                          >
                            About the candidate
                          </Text>
                          <BallotReadingText text={cand.biography} />
                        </View>
                      ) : null}
                      <CandidateStatement cand={cand} />
                      {!hasStatement && (
                        <Text style={s.noContact}>
                          Statement unavailable to Billion.
                        </Text>
                      )}
                      {contactRows.length > 0 &&
                        contactRows.map((row) => (
                          <TouchableOpacity
                            key={row.label}
                            accessibilityRole="link"
                            accessibilityLabel={`${row.label}: ${row.value}`}
                            style={[s.contactRow, s.contactAction]}
                            onPress={row.onPress}
                            activeOpacity={0.7}
                          >
                            <Icon name={row.icon} size={16} color={P.primary} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.contactLabel}>{row.label}</Text>
                              <Text
                                style={[s.contactValue, { color: P.primary }]}
                              >
                                {row.value}
                              </Text>
                            </View>
                            <Icon name="external" size={13} color={P.primary} />
                          </TouchableOpacity>
                        ))}
                      {cand.channels && cand.channels.length > 0 && (
                        <View style={s.channelsWrap}>
                          {cand.channels.map((ch) => (
                            <View
                              key={`${ch.type}-${ch.id}`}
                              style={s.contactRow}
                            >
                              <Icon name="globe" size={16} color={P.spark} />
                              <View style={{ flex: 1 }}>
                                <Text style={s.contactLabel}>{ch.type}</Text>
                                <Text style={s.contactValue}>{ch.id}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                      <BallotSources
                        citations={sources}
                        contentKind="citations"
                        showRecovery={false}
                      />
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        </View>
        {candidates.length === 0 ? (
          <BallotDetailEvidence citations={[]} showOfficeLink={false} />
        ) : (
          <BallotLanguages items={[]} />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: DigestSpace.screenPadX,
    paddingTop: 20,
    paddingBottom: 48,
  },
  section: { marginTop: 12, marginBottom: 12 },
  filters: { gap: 12, marginBottom: 16 },
  kicker: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  office: {
    fontFamily: fontDisplay.bold,
    fontSize: 34,
    lineHeight: 38,
    color: P.inkOnNight,
    marginBottom: 4,
    letterSpacing: -0.55,
  },
  district: {
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    color: P.inkOnNight,
    opacity: 0.7,
    marginBottom: 12,
  },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 10,
    padding: 12,
    color: P.inkOnNight,
    fontFamily: fontBody.regular,
    fontSize: 16,
  },
  filterOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterOption: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 8,
  },
  filterSelected: { backgroundColor: P.card, borderColor: P.inkOnNight },
  filterText: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: P.inkOnNight,
  },
  descText: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: P.inkOnNight,
    lineHeight: 22,
  },
  candHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  identityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: planes.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  partyPhoto: { width: 34, height: 34, borderRadius: 9 },
  candNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  candName: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.2,
    color: P.inkOnNight,
  },
  incumbentBadge: {
    backgroundColor: DigestHair.tabActivePill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DigestHair.coverBorder,
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  incumbentText: {
    fontFamily: fontBody.semibold,
    fontSize: 10.5,
    color: P.spark,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  emptyState: { ...cardChrome, gap: 12, padding: 20 },
  emptyTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    color: P.inkOnNight,
  },
  candidateSection: {
    ...cardChrome,
    padding: 16,
  },
  readingSection: { gap: 12, marginBottom: 16 },
  readingLabel: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 19,
    color: P.inkOnNight,
    marginBottom: 8,
  },
  clearFilters: { backgroundColor: P.inkOnNight, alignSelf: "flex-start" },
  statementTab: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: DigestRadii.menuRow,
  },
  statementTabText: {
    fontFamily: fontBody.medium,
    fontSize: 16,
    color: P.inkOnNight,
  },
  candBio: {
    fontFamily: fontBody.regular,
    fontSize: 17,
    color: P.inkOnNight,
    lineHeight: 26,
    marginBottom: 4,
  },
  withdrawn: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: P.inkOnNight,
    marginTop: 8,
  },
  candParty: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: P.inkOnNight,
    opacity: 0.7,
  },
  candBody: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DigestHair.cardBorder,
    paddingTop: 12,
    gap: 8,
  },
  statementWrap: {
    gap: 10,
  },
  contactRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  contactAction: {
    backgroundColor: P.canvas,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DigestHair.cardBorder,
  },
  contactLabel: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: P.inkOnNight,
    opacity: 0.7,
  },
  contactValue: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: P.inkOnNight,
    marginTop: 1,
  },
  noContact: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: P.inkOnNight,
    opacity: 0.7,
  },
  channelsWrap: {
    borderTopWidth: 1,
    borderTopColor: DigestHair.cardBorder,
    paddingTop: 8,
    marginTop: 4,
  },
});
