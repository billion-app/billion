import { useCallback, useMemo, useState } from "react";
import {
  Image,
  LayoutAnimation,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Fuse from "fuse.js";

import {
  EmptyBallotMark,
  SectionFlourish,
} from "~/components/digest/CraftMarks";
import { Text } from "~/components/Themed";
import {
  Card,
  Icon,
  Kicker,
  NavHeader,
  Pill,
  Pills,
  SearchInput,
  Segmented,
} from "~/components/ui";
import {
  DigestHair,
  DigestRadii,
  DigestSpace,
  fontBody,
  fontDisplay,
  DigestPalette as P,
} from "~/styles";

const cardChrome = {
  backgroundColor: P.card,
  borderRadius: DigestRadii.card,
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
  citations?: CandidateCitation[];
}

/** Human-readable label for a source tier (mirrors measure-detail). */
const TIER_LABEL: Record<string, string> = {
  county_registrar: "County Registrar",
  state_sos: "Secretary of State",
  lwv: "League of Women Voters",
  ballotpedia: "Ballotpedia",
  wikipedia: "Wikipedia",
  vote_smart: "Vote Smart",
  google_civic: "Google Civic",
  ai_generated: "AI-generated",
};

interface FooterSource {
  sourceName: string;
  sourceUrl?: string;
  official: boolean;
  tier: string;
}

/** Collapse per-field citations into one row per distinct source. */
function dedupeSources(citations: CandidateCitation[]): FooterSource[] {
  const byName = new Map<string, FooterSource>();
  for (const c of citations) {
    if (byName.has(c.sourceName)) continue;
    byName.set(c.sourceName, {
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      official: c.official,
      tier: c.tier,
    });
  }
  return [...byName.values()].sort(
    (a, b) => Number(b.official) - Number(a.official),
  );
}

function partyColor(party?: string): string {
  const p = (party ?? "").toLowerCase();
  if (p.startsWith("d")) return P.badgeBlue;
  if (p.startsWith("r")) return P.quiet;
  return P.quiet;
}

function partyInitial(party?: string): string {
  const p = (party ?? "").toLowerCase();
  if (p.startsWith("d")) return "D";
  if (p.startsWith("r")) return "R";
  return "NP";
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
  const [mode, setMode] = useState<"summary" | "verbatim">(
    hasSummary ? "summary" : "verbatim",
  );
  if (!hasSummary && !hasVerbatim) return null;

  const showTabs = hasSummary && hasVerbatim;
  const showingSummary = hasSummary && (mode === "summary" || !hasVerbatim);

  return (
    <View style={s.statementWrap}>
      {showTabs && (
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { id: "summary", label: "Plain summary", icon: "sparkle" },
            { id: "verbatim", label: "Statement", icon: "doc" },
          ]}
        />
      )}
      {showingSummary && cand.statementSummaryIsAiGenerated && (
        <View style={s.aiNotice}>
          <Icon name="sparkle" size={13} color={P.spark} />
          <Text style={s.aiNoticeText}>
            AI summary of the candidate&apos;s own statement — not an official
            source. Read the full statement for their exact words.
          </Text>
        </View>
      )}
      <Text style={s.candBio}>
        {showingSummary ? cand.statementSummary : cand.statement}
      </Text>
    </View>
  );
}

export default function ContestDetailScreen() {
  const router = useRouter();
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  /** Party initials actually present in this contest, in first-seen order. */
  const partyOptions = useMemo(() => {
    const seen: string[] = [];
    for (const c of candidates) {
      const p = partyInitial(c.party);
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
      if (activeParty && partyInitial(c.party) !== activeParty) return false;
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
        title={params.office}
        tone="dark"
        onBack={() => router.back()}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.contestKicker}>Contest</Text>
        <Text style={s.office}>{params.office}</Text>
        {params.districtName ? (
          <Text style={s.district}>{params.districtName}</Text>
        ) : null}
        <View style={s.flourishWrap}>
          <SectionFlourish width={88} />
        </View>

        {description ? (
          <View style={s.section}>
            <Kicker style={s.kicker}>About this office</Kicker>
            <Card style={cardChrome}>
              <Text style={s.descText}>{description}</Text>
            </Card>
          </View>
        ) : null}

        <View style={s.section}>
          <Kicker style={s.kicker}>
            {filtering
              ? `${filtered.length} of ${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`
              : `${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`}
          </Kicker>

          {candidates.length > 1 ? (
            <View style={s.filters}>
              <SearchInput
                placeholder="Search candidates…"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              <View style={s.pillsBleed}>
                <Pills>
                  <Pill
                    label="Has statement"
                    icon="doc"
                    active={hasStatementOnly}
                    onPress={() => setHasStatementOnly((v) => !v)}
                  />
                  {partyOptions.map((p) => (
                    <Pill
                      key={p}
                      label={p}
                      active={activeParty === p}
                      onPress={() =>
                        setActiveParty((cur) => (cur === p ? null : p))
                      }
                    />
                  ))}
                </Pills>
              </View>
            </View>
          ) : null}

          {filtered.length === 0 ? (
            <Card style={[cardChrome, s.emptyCard]}>
              <EmptyBallotMark width={80} />
              <Text style={s.emptyTitle}>No candidates match</Text>
              <Text style={s.noContact}>
                Try clearing search or party filters.
              </Text>
            </Card>
          ) : null}

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

              const sources = cand.citations
                ? dedupeSources(cand.citations)
                : [];
              const hasStatement =
                !!cand.statement?.trim() || !!cand.statementSummary?.trim();
              const hasContact =
                contactRows.length > 0 || (cand.channels?.length ?? 0) > 0;
              const hasBody =
                hasContact ||
                !!cand.biography ||
                hasStatement ||
                sources.length > 0;

              return (
                <Card key={key} style={cardChrome}>
                  <TouchableOpacity
                    style={s.candHeader}
                    activeOpacity={0.7}
                    onPress={() => toggle(key)}
                  >
                    <View style={s.partyTile}>
                      {cand.photoUrl ? (
                        <Image
                          source={{ uri: cand.photoUrl }}
                          style={s.partyPhoto}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text
                          style={[
                            s.partyText,
                            { color: partyColor(cand.party) },
                          ]}
                        >
                          {partyInitial(cand.party)}
                        </Text>
                      )}
                    </View>
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
                        <Text style={s.candBio}>{cand.biography}</Text>
                      ) : null}
                      <CandidateStatement cand={cand} />
                      {!hasStatement ? (
                        <View style={s.emptyNote}>
                          <Icon name="doc" size={13} color={P.quiet} />
                          <Text style={s.noContact}>
                            No statement submitted to the official voter guide.
                          </Text>
                        </View>
                      ) : null}
                      {!hasBody ? (
                        <Text style={s.noContact}>
                          No contact information available.
                        </Text>
                      ) : null}
                      {contactRows.length > 0 &&
                        contactRows.map((row) => (
                          <TouchableOpacity
                            key={row.label}
                            style={s.contactRow}
                            onPress={row.onPress}
                            activeOpacity={0.7}
                          >
                            <Icon name={row.icon} size={16} color={P.spark} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.contactLabel}>{row.label}</Text>
                              <Text style={s.contactValue} numberOfLines={1}>
                                {row.value}
                              </Text>
                            </View>
                            <Icon name="external" size={13} color={P.quiet} />
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
                      {sources.length > 0 && (
                        <View style={s.sourcesWrap}>
                          <Text style={s.sourcesLabel}>Sources</Text>
                          {sources.map((src, si) => {
                            const openSrc = src.sourceUrl
                              ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                () => void Linking.openURL(src.sourceUrl!)
                              : undefined;
                            return (
                              <Pressable
                                key={`src-${si}`}
                                onPress={openSrc}
                                disabled={!openSrc}
                                style={s.sourceRow}
                              >
                                <Icon
                                  name={src.official ? "shield" : "info"}
                                  size={13}
                                  color={src.official ? P.badgeTeal : P.quiet}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text style={s.sourceName}>
                                    {src.sourceName}
                                  </Text>
                                  <Text style={s.sourceMeta}>
                                    {src.official ? "Official · " : ""}
                                    {TIER_LABEL[src.tier] ?? src.tier}
                                  </Text>
                                </View>
                                {openSrc ? (
                                  <Icon
                                    name="external"
                                    size={13}
                                    color={P.quiet}
                                  />
                                ) : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: DigestSpace.coverPadX,
    paddingTop: 8,
    paddingBottom: 48,
  },
  kicker: {
    color: P.spark,
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  contestKicker: {
    fontFamily: fontBody.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: P.spark,
    marginBottom: 8,
  },
  office: {
    fontFamily: fontDisplay.bold,
    fontSize: 28,
    color: P.inkOnNight,
    marginBottom: 4,
    lineHeight: 34,
    letterSpacing: -0.55,
  },
  district: {
    fontFamily: fontBody.medium,
    fontSize: 13.5,
    color: P.quiet,
    marginBottom: 12,
  },
  flourishWrap: { marginBottom: 20, alignItems: "flex-start" },
  section: { marginBottom: 28 },
  filters: { gap: 12, marginBottom: 12 },
  emptyCard: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  emptyTitle: {
    fontFamily: fontDisplay.bold,
    fontSize: 18,
    color: P.inkOnNight,
  },
  pillsBleed: { marginHorizontal: -20 },
  descText: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: P.inkOnNight,
    lineHeight: 22,
  },
  candHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  partyTile: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: P.stone,
    alignItems: "center",
    justifyContent: "center",
  },
  partyText: { fontFamily: fontBody.bold, fontSize: 13 },
  partyPhoto: { width: 34, height: 34, borderRadius: 9 },
  candNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  candName: {
    fontFamily: fontDisplay.bold,
    fontSize: 17,
    lineHeight: 22,
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
  candBio: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: P.inkOnNight,
    lineHeight: 21,
    marginBottom: 4,
  },
  candParty: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: P.quiet,
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
  aiNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: DigestHair.tabActivePill,
    borderWidth: 1,
    borderColor: DigestHair.coverBorder,
    borderRadius: DigestRadii.menu,
    padding: 12,
  },
  aiNoticeText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: P.quiet,
    lineHeight: 18,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  contactLabel: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: P.quiet,
  },
  contactValue: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: P.inkOnNight,
    marginTop: 1,
  },
  emptyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noContact: {
    fontFamily: fontBody.regular,
    fontSize: 13,
    color: P.quiet,
  },
  channelsWrap: {
    borderTopWidth: 1,
    borderTopColor: DigestHair.cardBorder,
    paddingTop: 8,
    marginTop: 4,
  },
  sourcesWrap: {
    borderTopWidth: 1,
    borderTopColor: DigestHair.cardBorder,
    paddingTop: 10,
    marginTop: 4,
  },
  sourcesLabel: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: P.quiet,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 7,
  },
  sourceName: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: P.inkOnNight,
  },
  sourceMeta: {
    fontFamily: fontBody.regular,
    fontSize: 11,
    color: P.quiet,
    marginTop: 1,
  },
});
