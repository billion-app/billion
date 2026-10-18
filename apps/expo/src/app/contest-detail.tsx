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
  BallotDisclosure,
  BallotLanguages,
  BallotProvenanceRows,
  BallotSources,
  ElectionOfficeLink,
  SourceLink,
} from "~/components/ballot-evidence/BallotEvidence";
import {
  BallotAiDisclosure,
  BallotBiography,
  BallotReadingCard,
  BallotReadingMode,
} from "~/components/ballot-evidence/BallotReadingCard";
import { BallotText as Text } from "~/components/ballot-evidence/BallotText";
import { CandidateBallotStatus } from "~/components/ballot-evidence/CandidateBallotStatus";
import { candidateStatusLabel } from "~/components/ballot-evidence/election-status";
import { webUrl } from "~/components/ballot-evidence/model";
import { ContestMarking } from "~/components/ballot-marking/ContestMarking";
import { CardTranslationNotice } from "~/components/CardTranslationNotice";
import { OfficeRole } from "~/components/office-role/OfficeRole";
import { Card, Icon, NavHeader } from "~/components/ui";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import { useBallotTranslation } from "~/hooks/useBallotTranslation";
import {
  DigestHair,
  DigestRadii,
  fontBody,
  fontEditorial,
  hair,
  DigestPalette as P,
  planes,
} from "~/styles";
import { ballotElectionDate } from "~/utils/ballot-lookup";
import { ballotIdentityFromRoute } from "~/utils/ballot-translation";
import { parseRouteArray } from "~/utils/route-array";

const cardChrome = {
  backgroundColor: P.card,
  borderRadius: DigestRadii.menu,
  borderWidth: 1,
  borderColor: hair[1],
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

function websiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
  const { t: tx } = useAppTranslation();

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
      {showTabs && (
        <BallotReadingMode
          value={mode}
          onChange={setMode}
          options={[
            { value: "summary", label: tx("Summary") },
            { value: "verbatim", label: tx("Original statement") },
          ]}
        />
      )}
      <BallotReadingCard
        inset={showingSummary}
        accent={showingSummary}
        icon={showingSummary ? (summaryIsAi ? "sparkle" : "book") : "doc"}
        title={
          showingSummary
            ? tx("Statement summary")
            : tx("Original candidate statement")
        }
        label={
          showingSummary && summaryIsAi ? <BallotAiDisclosure /> : undefined
        }
        text={(showingSummary ? cand.statementSummary : cand.statement) ?? ""}
      />
    </View>
  );
}

export default function ContestDetailScreen() {
  const { t: tx, language: uiLanguage } = useAppTranslation();

  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const params = useLocalSearchParams<{
    translationReference?: string;
    translationIdentity?: string;
    translationTitleField?: string;
    office: string;
    roles: string;
    levels: string;
    candidates: string;
    districtName: string;
    roleDescription: string;
    state?: string;
    electionDate?: string;
    electionStage?: string;
    ballotSourceName?: string;
    ballotSourceUrl?: string;
    ballotFetchedAt?: string;
    districtId?: string;
    citations?: string;
  }>();

  const localization = useBallotTranslation(
    params.translationReference,
    ballotIdentityFromRoute(params.translationIdentity) ?? {
      kind: "contest",
      title: params.office,
      candidates: parseRouteArray<CandidateParam>(
        params.candidates,
        ["name"],
        [],
      ).map((candidate) => candidate.name),
    },
  );
  const candidates = useMemo(
    () =>
      parseRouteArray<CandidateParam>(
        params.candidates,
        ["name"],
        [
          "party",
          "candidateUrl",
          "phone",
          "email",
          "photoUrl",
          "biography",
          "statement",
          "statementSummary",
          "ballotStatus",
        ],
      ).map((candidate, index) => ({
        ...candidate,
        statementSummary: localization.text(
          `candidates.${index}.statementSummary`,
          candidate.statementSummary,
        ),
        citations: parseRouteArray<CandidateCitation>(
          JSON.stringify(candidate.citations),
          ["field", "sourceName"],
          ["sourceUrl", "tier", "fetchedAt", "verifiedAt", "verifiedBy"],
        ),
        channels: parseRouteArray<{ type: string; id: string }>(
          JSON.stringify(candidate.channels),
          ["type", "id"],
        ),
      })),
    [params.candidates, localization],
  );
  const raceCitations = useMemo(
    () =>
      parseRouteArray<CandidateCitation>(
        params.citations,
        ["field", "sourceName"],
        ["sourceUrl", "tier", "fetchedAt", "verifiedAt", "verifiedBy"],
      ),
    [params.citations],
  );
  const [contactError, setContactError] = useState<string>();
  const openContact = (url: string, label: string) => {
    void Linking.openURL(url).then(
      () => setContactError(undefined),
      () =>
        setContactError(
          tx("Could not open {value1}. Tap the contact again to retry.", {
            value1: label,
          }),
        ),
    );
  };
  const description =
    localization.text("roleDescription", params.roleDescription) || null;
  const [showRoleDescription, setShowRoleDescription] = useState(false);

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
        title={tx("Candidates")}
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
        {params.translationReference && (
          <CardTranslationNotice
            items={[localization]}
            onRetry={localization.retry}
          />
        )}
        {localization.expired && (
          <Pressable onPress={() => router.replace("/ballot")}>
            <Text style={s.descText}>{tx("Reload ballot to translate")}</Text>
          </Pressable>
        )}

        <Text accessibilityRole="header" style={s.office}>
          {localization.text(
            params.translationTitleField ?? "office",
            params.office,
          )}
        </Text>
        <Text style={s.district}>
          {[
            params.districtName,
            params.electionDate
              ? ballotElectionDate(params.electionDate, uiLanguage)
              : tx("Election date unavailable"),
            params.electionStage?.trim()
              ? params.electionStage.trim()
              : tx("Election stage unavailable"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {candidates.length > 0 && (
          <View style={{ marginTop: 12, gap: 4 }}>
            <Text style={s.district}>
              {tx(
                "This list may be incomplete. Confirm whether this race is on your ballot with your election office.",
              )}
            </Text>
            <SourceLink
              label={tx("Find your election office")}
              url="https://www.usa.gov/state-election-office"
            />
          </View>
        )}
        <OfficeRole
          office={localization.text(
            params.translationTitleField ?? "office",
            params.office,
          )}
          state={params.state}
          districtId={params.districtId}
        />

        <ContestMarking
          scope={{
            contestId: "",
            electionDate: params.electionDate ?? "",
            jurisdiction: params.state ?? "",
          }}
        />

        {description ? (
          <View style={s.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showRoleDescription }}
              onPress={() => setShowRoleDescription((value) => !value)}
              style={{
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={s.websiteTitle}>
                {showRoleDescription
                  ? tx("Hide ballot office description")
                  : tx("Ballot office description")}
              </Text>
              <Icon
                name={showRoleDescription ? "chevD" : "chevR"}
                size={16}
                color={P.inkOnNight}
              />
            </Pressable>
            {showRoleDescription && (
              <Card style={cardChrome}>
                <Text style={s.descText}>{description}</Text>
              </Card>
            )}
          </View>
        ) : null}

        <View style={s.section}>
          {(candidates.length > 0 || filtering) && (
            <Text accessibilityRole="header" style={s.readingLabel}>
              {filtering
                ? tx("{value1} of {value2} names shown", {
                    value1: filtered.length,
                    value2: candidates.length,
                  })
                : tx("Candidates · {value1}", { value1: candidates.length })}
            </Text>
          )}

          {candidates.length > 5 && (
            <View style={s.filters}>
              <TextInput
                accessibilityLabel={tx("Search candidates")}
                placeholder={tx("Search candidates")}
                placeholderTextColor="rgba(255,255,255,0.70)"
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
                  accessibilityRole="checkbox"
                  aria-checked={hasStatementOnly}
                  style={[s.filterOption, hasStatementOnly && s.filterSelected]}
                  onPress={() => setHasStatementOnly((v) => !v)}
                >
                  <Text style={s.filterText}>{tx("Has statement")}</Text>
                </Pressable>
                {partyOptions.length > 1 &&
                  partyOptions.map((p) => (
                    <Pressable
                      key={p}
                      accessibilityRole="checkbox"
                      aria-checked={activeParty === p}
                      style={[
                        s.filterOption,
                        activeParty === p && s.filterSelected,
                      ]}
                      onPress={() =>
                        setActiveParty((cur) => (cur === p ? null : p))
                      }
                    >
                      <Text style={s.filterText}>
                        {p === "Party unavailable"
                          ? tx("Party unavailable")
                          : p}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          )}

          {filtered.length === 0 && (
            <View style={s.emptyState}>
              <Text accessibilityRole="header" style={s.emptyTitle}>
                {candidates.length
                  ? tx("No candidates match your filters.")
                  : tx("Candidate details unavailable")}
              </Text>
              {!candidates.length && (
                <Text style={s.candBio}>
                  {tx(
                    "Billion has no candidate details for this contest. Check your election office for the official candidate list.",
                  )}
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
                    {tx("Clear filters")}
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
              const candidateUrl = webUrl(cand.candidateUrl);
              const contactRows = [
                candidateUrl && {
                  icon: "globe" as const,
                  label: tx("Website"),
                  value: candidateUrl,
                  onPress: () => openContact(candidateUrl, "website"),
                },
                cand.phone && {
                  icon: "message" as const,
                  label: tx("Phone"),
                  value: cand.phone,
                  onPress: () => openContact(`tel:${cand.phone}`, "phone"),
                },
                cand.email && {
                  icon: "edit" as const,
                  label: tx("Email"),
                  value: cand.email,
                  onPress: () => openContact(`mailto:${cand.email}`, "email"),
                },
              ].filter(Boolean) as {
                icon: "globe" | "message" | "edit";
                label: string;
                value: string;
                onPress: () => void;
              }[];

              const sources = cand.citations;
              const hasStatement =
                !!cand.statement?.trim() || !!cand.statementSummary?.trim();

              return (
                <View key={key} style={s.candidateSection}>
                  <TouchableOpacity
                    style={s.candHeader}
                    accessibilityRole="button"
                    accessibilityLabel={[
                      cand.name,
                      cand.party,
                      cand.incumbent ? tx("Incumbent") : undefined,
                      candidateStatusLabel(
                        cand.ballotStatus,
                        false,
                        uiLanguage,
                      ),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    aria-expanded={open}
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
                            <Text style={s.incumbentText}>
                              {tx("Incumbent")}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {cand.party ? (
                        <Text style={s.candParty}>{cand.party}</Text>
                      ) : null}
                      <CandidateBallotStatus
                        status={cand.ballotStatus}
                        compact
                      />
                    </View>
                    <Icon
                      name={open ? "chevD" : "chevR"}
                      size={16}
                      color={P.quiet}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={tx("Open {value1} candidate page", {
                      value1: cand.name,
                    })}
                    onPress={() =>
                      router.push({
                        pathname: "/candidate-detail",
                        params: {
                          name: cand.name,
                          office: params.office,
                          state: params.state,
                          electionDate: params.electionDate,
                          electionStage: params.electionStage,
                          ballotSourceName: params.ballotSourceName,
                          ballotSourceUrl: params.ballotSourceUrl,
                          ballotFetchedAt: params.ballotFetchedAt,
                          districtId: params.districtId,
                          district: params.districtName,
                          roles: params.roles,
                          levels: params.levels,
                          candidate: JSON.stringify(cand),
                        },
                      })
                    }
                    style={s.fieldGuideAction}
                  >
                    <Text
                      style={[
                        s.websiteTitle,
                        { color: P.spark, textDecorationLine: "underline" },
                      ]}
                    >
                      {tx("Research this candidate")}
                    </Text>
                    <Icon name="arrowRight" size={16} color={P.spark} />
                  </TouchableOpacity>
                  {open && (
                    <View style={s.candBody}>
                      <CandidateStatement cand={cand} />
                      {cand.biography ? (
                        <BallotBiography text={cand.biography} />
                      ) : null}
                      {!hasStatement && (
                        <Text style={s.noContact}>
                          {tx("Statement unavailable to Billion.")}
                        </Text>
                      )}
                      {contactRows.length > 0 &&
                        contactRows.map((row) => (
                          <TouchableOpacity
                            key={row.label}
                            accessibilityRole="link"
                            accessibilityLabel={`${row.label === tx("Website") ? tx("Candidate website") : row.label}: ${row.value}`}
                            style={[s.contactRow, s.contactAction]}
                            onPress={row.onPress}
                            activeOpacity={0.7}
                          >
                            <Icon
                              name={row.icon}
                              size={16}
                              color={P.badgeIndigo}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={
                                  row.label === tx("Website")
                                    ? s.websiteTitle
                                    : s.contactLabel
                                }
                              >
                                {row.label === tx("Website")
                                  ? tx("Candidate website")
                                  : row.label}
                              </Text>
                              <Text
                                style={
                                  row.label === tx("Website")
                                    ? s.websiteHost
                                    : [s.contactValue, { color: P.badgeIndigo }]
                                }
                              >
                                {row.label === tx("Website")
                                  ? websiteLabel(row.value)
                                  : row.value}
                              </Text>
                            </View>
                            <Icon
                              name="external"
                              size={13}
                              color={P.badgeIndigo}
                            />
                          </TouchableOpacity>
                        ))}
                      {cand.channels.length > 0 && (
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
                      {sources.length || hasStatement || cand.biography ? (
                        <BallotSources
                          citations={sources}
                          contentKind="citations"
                          showRecovery={false}
                        />
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
        {contactError && (
          <Text accessibilityRole="alert" style={s.noContact}>
            {contactError}
          </Text>
        )}
        <BallotDisclosure
          title={tx("Sources & updates")}
          detail={tx("Ballot source and retrieval date")}
        >
          <BallotProvenanceRows
            sourceName={params.ballotSourceName}
            sourceUrl={params.ballotSourceUrl}
            fetchedAt={params.ballotFetchedAt}
          />
          <BallotSources
            citations={raceCitations}
            contentKind="citations"
            showRecovery={false}
          />
        </BallotDisclosure>
        <BallotLanguages items={[]} showRecovery={false} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.canvas },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
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
  fieldGuideAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
  },
  office: {
    fontFamily: fontEditorial.bold,
    fontSize: 22,
    lineHeight: 28,
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
    ...cardChrome,
    padding: 14,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  identityIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
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
    lineHeight: 21,
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
  emptyState: { ...cardChrome, gap: 11, padding: 15 },
  emptyTitle: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
    color: P.inkOnNight,
  },
  candidateSection: { gap: 8 },
  readingLabel: {
    fontFamily: fontEditorial.bold,
    fontSize: 16,
    lineHeight: 21,
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
    fontSize: 15,
    color: P.inkOnNight,
    lineHeight: 23,
    marginBottom: 4,
  },
  candParty: {
    fontFamily: fontBody.medium,
    fontSize: 12.5,
    color: P.inkOnNight,
    opacity: 0.7,
  },
  candBody: { gap: 18 },
  statementWrap: {
    gap: 18,
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
  websiteTitle: {
    fontFamily: fontBody.semibold,
    fontSize: 13.5,
    color: P.badgeIndigo,
  },
  websiteHost: {
    fontFamily: fontBody.regular,
    fontSize: 12,
    color: P.inkOnNight,
    opacity: 0.7,
    marginTop: 3,
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
