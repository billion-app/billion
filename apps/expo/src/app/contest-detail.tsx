import { useCallback, useState } from "react";
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

import { Text } from "~/components/Themed";
import { Card, Icon, Kicker, NavHeader, Segmented } from "~/components/ui";
import { colors, fontBody, fontDisplay, hair, planes } from "~/styles";

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
  if (p.startsWith("d")) return "#7BA0FF";
  if (p.startsWith("r")) return "#C9CDDA";
  return colors.textSecondary;
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
          <Icon name="sparkle" size={13} color={colors.yellow[500]} />
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

  const candidates: CandidateParam[] = params.candidates
    ? (JSON.parse(params.candidates) as CandidateParam[])
    : [];
  const description = params.roleDescription || null;

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = useCallback((idx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  return (
    <View style={s.screen}>
      <NavHeader title={params.office} onBack={() => router.back()} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.office}>{params.office}</Text>
        {params.districtName ? (
          <Text style={s.district}>{params.districtName}</Text>
        ) : null}

        {description ? (
          <View style={s.section}>
            <Kicker>About this office</Kicker>
            <Card>
              <Text style={s.descText}>{description}</Text>
            </Card>
          </View>
        ) : null}

        <View style={s.section}>
          <Kicker>
            {`${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}`}
          </Kicker>
          <View style={{ gap: 12 }}>
            {candidates.map((cand, i) => {
              const open = expanded.has(i);
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
                hasContact || !!cand.biography || hasStatement || sources.length > 0;

              return (
                <Card key={i}>
                  <TouchableOpacity
                    style={s.candHeader}
                    activeOpacity={0.7}
                    onPress={() => toggle(i)}
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
                      color="#5B6172"
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
                          <Icon
                            name="doc"
                            size={13}
                            color={colors.textSecondary}
                          />
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
                            <Icon
                              name={row.icon}
                              size={16}
                              color={colors.bill}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={s.contactLabel}>{row.label}</Text>
                              <Text style={s.contactValue} numberOfLines={1}>
                                {row.value}
                              </Text>
                            </View>
                            <Icon
                              name="external"
                              size={13}
                              color={colors.textSecondary}
                            />
                          </TouchableOpacity>
                        ))}
                      {cand.channels && cand.channels.length > 0 && (
                        <View style={s.channelsWrap}>
                          {cand.channels.map((ch) => (
                            <View
                              key={`${ch.type}-${ch.id}`}
                              style={s.contactRow}
                            >
                              <Icon
                                name="globe"
                                size={16}
                                color={colors.bill}
                              />
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
                                  color={
                                    src.official
                                      ? colors.green[500]
                                      : colors.textSecondary
                                  }
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
                                    color={colors.textSecondary}
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
  screen: { flex: 1, backgroundColor: planes.navy },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  office: {
    fontFamily: fontDisplay.bold,
    fontSize: 26,
    color: colors.white,
    marginBottom: 6,
    lineHeight: 32,
  },
  district: {
    fontFamily: fontBody.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  section: { marginBottom: 24 },
  descText: {
    fontFamily: fontBody.regular,
    fontSize: 14.5,
    color: "rgba(255,255,255,0.85)",
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
    backgroundColor: planes.surface,
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
    fontFamily: fontBody.semibold,
    fontSize: 15,
    color: colors.white,
  },
  incumbentBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  incumbentText: {
    fontFamily: fontBody.semibold,
    fontSize: 10.5,
    color: colors.green[500],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  candBio: {
    fontFamily: fontBody.regular,
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 21,
    marginBottom: 4,
  },
  candParty: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  candBody: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: hair[1],
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
    backgroundColor: "rgba(245, 200, 66, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 66, 0.25)",
    borderRadius: 10,
    padding: 12,
  },
  aiNoticeText: {
    flex: 1,
    fontFamily: fontBody.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  contactValue: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: colors.white,
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
    color: colors.textSecondary,
  },
  channelsWrap: {
    borderTopWidth: 1,
    borderTopColor: hair[1],
    paddingTop: 8,
    marginTop: 4,
  },
  sourcesWrap: {
    borderTopWidth: 1,
    borderTopColor: hair[1],
    paddingTop: 10,
    marginTop: 4,
  },
  sourcesLabel: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: colors.textSecondary,
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
    color: colors.white,
  },
  sourceMeta: {
    fontFamily: fontBody.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
