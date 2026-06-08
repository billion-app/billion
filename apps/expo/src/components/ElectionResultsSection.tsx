/**
 * ElectionResultsSection — live California results from the Secretary of State
 * feed. Renders the statewide marquee races (governor, secretary of state) and,
 * when ballot contests are supplied, the voter's own district races (US House /
 * State Senate / State Assembly). Each race is a card of candidate rows with a
 * proportional vote bar, party tint, and an "advancing" marker for the top-two
 * who move on to the general. Refetches on a short poll so the numbers stay
 * current on election night.
 *
 * Two brand-driven behaviors:
 *  - The section only shows while results are *current* — gated on the feed's own
 *    "as of" timestamp (within RESULTS_WINDOW_DAYS), so stale numbers never
 *    linger mislabeled as live once an election cycle passes.
 *  - Every race links back to its official SOS results page (the Bradbury
 *    Principle: be a gateway to the source, not a dead-end stat).
 *
 * Shared Card/Icon design system.
 */
import { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import type {
  Contest,
  DistrictRef,
  ElectionContestResult,
  ResultCandidate,
} from "@acme/api";
import { SOS_RESULTS_HOME } from "@acme/api";

import { Text } from "~/components/Themed";
import { Card, Icon, Kicker } from "~/components/ui";
import { colors, fontBody, hair, planes } from "~/styles";
import { trpc } from "~/utils/api";

/** How often to refetch while the screen is focused (live election night). */
const POLL_MS = 5 * 60 * 1000;

/**
 * Show the section only while the feed's latest "as of" timestamp is within this
 * many days. Anchored on the data itself (not the mock election dates), so it
 * stays honest: results disappear ~10 days after counting stops.
 */
const RESULTS_WINDOW_DAYS = 10;

/**
 * Parse the date out of the SOS feed's `asOf` string, e.g.
 * "June 8, 2026, 3:17 p.m." → a Date at that day. We only need day granularity
 * for the recency gate, and JS Date can't parse the "p.m." time portion, so we
 * take just the "Month D, YYYY" prefix. Returns null if it doesn't parse.
 */
function parseAsOfDate(asOf: string): Date | null {
  const m = /^([A-Za-z]+ \d{1,2}, \d{4})/.exec(asOf.trim());
  if (!m?.[1]) return null;
  const d = new Date(m[1]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days between `date` and now (negative if in the future). */
function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Whether any contest in the set was reported recently enough to still be
 * "current". Contests with an unparseable timestamp are treated as fresh so a
 * format change at the source can't silently hide live results.
 */
function resultsAreCurrent(contests: ElectionContestResult[]): boolean {
  if (contests.length === 0) return false;
  return contests.some((c) => {
    const d = parseAsOfDate(c.asOf);
    return d === null || daysSince(d) <= RESULTS_WINDOW_DAYS;
  });
}

function openUrl(url: string) {
  void Linking.openURL(url);
}

interface ElectionResultsSectionProps {
  /**
   * Ballot contests for the voter's address. Used to scope district races to
   * the voter — without them, only the statewide marquee races show.
   */
  contests?: Contest[];
}

const CHAMBER_LABEL: Record<DistrictRef["chamber"], string> = {
  "us-house": "U.S. House",
  "state-senate": "State Senate",
  "state-assembly": "State Assembly",
};

/**
 * Pull the voter's US House / State Senate / State Assembly districts out of the
 * ballot contests. Civic leaves the district OCD id null, so we read the chamber
 * + number from the office string or district.name — e.g. "Member of the State
 * Assembly, District 28" → { "state-assembly", "28" }. Mirrors RepsSection's
 * extraction but also captures federal House seats (which the SOS feed has).
 */
function extractDistrictRefs(contests: Contest[]): DistrictRef[] {
  const seen = new Set<string>();
  const out: DistrictRef[] = [];
  for (const c of contests) {
    const text = `${c.office ?? ""} ${c.district?.name ?? ""}`;
    const chamber: DistrictRef["chamber"] | null =
      /\b(u\.?s\.?|united states|congress)\b/i.test(text) &&
      /\b(rep|representative|house|congress)/i.test(text)
        ? "us-house"
        : /assembly/i.test(text)
          ? "state-assembly"
          : /\b(state )?sen(ate|ator)\b/i.test(text)
            ? "state-senate"
            : null;
    if (!chamber) continue;
    // "District 28" or "28th … District" → 28
    const number = (/district\s+(\d+)/i.exec(text) ??
      /\b(\d+)(?:st|nd|rd|th)\b/i.exec(text))?.[1];
    if (!number) continue;
    const key = `${chamber}:${number}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ chamber, number });
    }
  }
  return out;
}

/** Bar/label tint by party. Falls back to civic blue for anything unmapped. */
function partyColor(party?: string): string {
  switch (party?.toLowerCase()) {
    case "dem":
    case "democratic":
      return colors.bill; // civic blue
    case "rep":
    case "republican":
      return colors.red[500];
    case "grn":
    case "green":
      return colors.green[500];
    default:
      return colors.general;
  }
}

function CandidateRow({
  candidate,
  leadVotes,
}: {
  candidate: ResultCandidate;
  /** Vote count of the front-runner — bars are drawn relative to this. */
  leadVotes: number;
}) {
  const tint = partyColor(candidate.party);
  // Width is relative to the leader so the strongest bar fills the row; guard
  // against divide-by-zero before any votes are in.
  const width = leadVotes > 0 ? (candidate.votes / leadVotes) * 100 : 0;

  return (
    <View style={s.row}>
      <View style={s.rowHeader}>
        <View style={s.nameWrap}>
          <Text style={s.candidateName} numberOfLines={1}>
            {candidate.name}
          </Text>
          {candidate.incumbent ? (
            <Text style={s.incumbentTag}>INCUMBENT</Text>
          ) : null}
          {candidate.advancing ? (
            <View style={s.advChip}>
              <Icon name="check" size={9} color={colors.green[500]} />
              <Text style={s.advChipText}>Advances</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.percent}>{candidate.percent.toFixed(1)}%</Text>
      </View>
      <View style={s.barTrack}>
        <View
          style={[s.barFill, { width: `${width}%`, backgroundColor: tint }]}
        />
      </View>
      <Text style={s.subline}>
        {candidate.party ? `${candidate.party} · ` : ""}
        {candidate.votes.toLocaleString()} votes
      </Text>
    </View>
  );
}

function ContestCard({ contest }: { contest: ElectionContestResult }) {
  // Show the meaningful field. A statewide primary often has a long tail of
  // sub-1% candidates; cap the visible list and summarize the rest.
  const VISIBLE = 6;
  const shown = contest.candidates.slice(0, VISIBLE);
  const hidden = contest.candidates.length - shown.length;
  const leadVotes = contest.candidates[0]?.votes ?? 0;

  // District races carry a verbose feed title ("State Assembly Member District
  // 28 - Districtwide Results"); present the cleaner "<chamber> · District N".
  const title =
    contest.chamber && contest.district
      ? `${CHAMBER_LABEL[contest.chamber]} · District ${contest.district}`
      : contest.title;

  return (
    <Card style={{ padding: 18, gap: 14 }}>
      <View>
        <Text style={s.contestTitle}>{title}</Text>
        <View style={s.reportingRow}>
          <Icon name="clock" size={11} color={colors.textSecondary} />
          <Text style={s.reportingText} numberOfLines={1}>
            {contest.percentReporting !== null
              ? `${contest.percentReporting}% reporting · as of ${contest.asOf}`
              : `As of ${contest.asOf}`}
          </Text>
        </View>
      </View>

      <View style={{ gap: 14 }}>
        {shown.map((c) => (
          <CandidateRow key={c.name} candidate={c} leadVotes={leadVotes} />
        ))}
      </View>

      {hidden > 0 ? (
        <Text style={s.moreText}>
          +{hidden} more candidate{hidden !== 1 ? "s" : ""}
        </Text>
      ) : null}

      {/* Bradbury exit — every race is a gateway to the official source. */}
      <TouchableOpacity
        style={s.sourceLink}
        activeOpacity={0.8}
        onPress={() => openUrl(contest.sourceUrl)}
      >
        <Icon name="external" size={13} color={colors.bill} />
        <Text style={s.sourceLinkText}>View official results</Text>
      </TouchableOpacity>
    </Card>
  );
}

export function ElectionResultsSection({
  contests: ballotContests,
}: ElectionResultsSectionProps = {}) {
  const statewideQuery = useQuery({
    ...trpc.civic.getElectionResults.queryOptions({}),
    refetchInterval: POLL_MS,
  });

  // Derive the voter's district races from their ballot; only query when there
  // are any (empty refs short-circuit to [] in the procedure anyway).
  const refs = useMemo(
    () => extractDistrictRefs(ballotContests ?? []),
    [ballotContests],
  );
  const districtQuery = useQuery({
    ...trpc.civic.getDistrictResults.queryOptions({ refs }),
    enabled: refs.length > 0,
    refetchInterval: POLL_MS,
  });

  const statewide = useMemo(
    () => statewideQuery.data ?? [],
    [statewideQuery.data],
  );
  const district = useMemo(
    () => districtQuery.data ?? [],
    [districtQuery.data],
  );

  const isLoading =
    statewideQuery.isLoading || (refs.length > 0 && districtQuery.isLoading);

  const all = useMemo(() => [...statewide, ...district], [statewide, district]);

  // Gate on recency: only surface while the feed's own "as of" timestamp is
  // within the window. Keeps results from lingering, mislabeled as live, once a
  // cycle passes — the section self-hides until the next election reports.
  const current = useMemo(() => resultsAreCurrent(all), [all]);

  // Still "live" while any race is below 100% precincts reporting; once every
  // shown race is fully reported, drop the live framing to plain "Results".
  const stillCounting = all.some(
    (c) => c.percentReporting !== null && c.percentReporting < 100,
  );

  // Drop the whole section when nothing came back (off-season, source down) or
  // when the data is stale. Keep it mounted while loading so it can appear.
  if (!isLoading && (all.length === 0 || !current)) {
    return null;
  }

  return (
    <View style={s.container}>
      <View style={s.headingRow}>
        <Text style={s.heading}>
          {stillCounting ? "Live Results" : "Results"}
        </Text>
        <View style={s.liveBadge}>
          {stillCounting ? <View style={s.liveDot} /> : null}
          <Text style={s.liveText}>CA Primary</Text>
        </View>
      </View>

      {isLoading && all.length === 0 ? (
        <ActivityIndicator color={colors.bill} style={{ marginVertical: 12 }} />
      ) : (
        <>
          {statewide.length > 0 && (
            <View style={s.group}>
              <Kicker>Statewide</Kicker>
              {statewide.map((contest) => (
                <ContestCard key={contest.office} contest={contest} />
              ))}
            </View>
          )}

          {district.length > 0 && (
            <View style={s.group}>
              <Kicker>Your district races</Kicker>
              {district.map((contest) => (
                <ContestCard key={contest.office} contest={contest} />
              ))}
            </View>
          )}
        </>
      )}

      {/* Section-level Bradbury exit + attribution, as a real link. */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openUrl(SOS_RESULTS_HOME)}
        style={s.attributionRow}
      >
        <Text style={s.attribution}>Source: California Secretary of State</Text>
        <Icon name="external" size={11} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 12 },
  group: { gap: 12 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 18,
    color: colors.white,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: planes.surface,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.red[500],
  },
  liveText: {
    fontFamily: fontBody.semibold,
    fontSize: 11,
    color: colors.white,
    letterSpacing: 0.3,
  },
  contestTitle: {
    fontFamily: "InriaSerif-Bold",
    fontSize: 16,
    color: colors.white,
  },
  reportingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  reportingText: {
    fontFamily: fontBody.medium,
    fontSize: 11.5,
    color: colors.textSecondary,
    flex: 1,
  },
  row: { gap: 5 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  nameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  candidateName: {
    fontFamily: fontBody.semibold,
    fontSize: 14,
    color: colors.white,
    flexShrink: 1,
  },
  incumbentTag: {
    fontFamily: fontBody.medium,
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  advChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  advChipText: {
    fontFamily: fontBody.semibold,
    fontSize: 10,
    color: colors.green[500],
  },
  percent: {
    fontFamily: fontBody.bold,
    fontSize: 14,
    color: colors.white,
  },
  barTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: hair[1],
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  subline: {
    fontFamily: fontBody.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  moreText: {
    fontFamily: fontBody.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: planes.surface,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginTop: 2,
  },
  sourceLinkText: {
    fontFamily: fontBody.semibold,
    fontSize: 13,
    color: colors.bill,
  },
  attributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  attribution: {
    fontFamily: fontBody.medium,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
