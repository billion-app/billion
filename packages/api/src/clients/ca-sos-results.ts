/**
 * California Secretary of State — Election-Night Results feed
 * https://media.sos.ca.gov/ (official, free, no API key)
 *
 * The SOS publishes one JSON file per statewide office plus district-based
 * offices (US House / State Senate / State Assembly). Each file is a bare array
 * of contest objects; we normalize the string-encoded vote/percent fields into
 * numbers the UI can chart directly. Google retired its Civic results endpoints,
 * so this is the canonical live source for California races.
 */

const BASE_URL = "https://media.sos.ca.gov/media";

/**
 * Human-facing results site (distinct from the JSON `media` host). Each contest
 * links back here so the app stays a gateway to the official source, not a
 * dead-end stat — the Bradbury Principle in BRANDING.md.
 */
const RESULTS_SITE = "https://dp.electionresults.sos.ca.gov/returns";

/** Homepage of the official results site, used for the section-level attribution link. */
export const SOS_RESULTS_HOME = "https://electionresults.sos.ca.gov/";

/**
 * The results-site URL slug differs from our internal chamber key for US House
 * ("us-rep" in the URL vs our "us-house"); the others match.
 */
const CHAMBER_URL_SLUG: Record<DistrictChamber, string> = {
  "us-house": "us-rep",
  "state-senate": "state-senate",
  "state-assembly": "state-assembly",
};

function statewideUrl(office: StatewideOffice): string {
  return `${RESULTS_SITE}/maps/${office}`;
}

function districtUrl(chamber: DistrictChamber, number: string): string {
  return `${RESULTS_SITE}/${CHAMBER_URL_SLUG[chamber]}/district/${number}`;
}

/**
 * Statewide-office feeds. Keyed by a stable slug the API exposes; the value is
 * the published JSON filename. District-based offices (us-rep, state-senate,
 * state-assembly) are intentionally omitted — those return every district in
 * the state and aren't useful without an address to scope them.
 */
const STATEWIDE_FEEDS = {
  governor: "governor.json",
  "lieutenant-governor": "lieutenant-governor.json",
  "secretary-of-state": "secretary-of-state.json",
  controller: "controller.json",
  treasurer: "treasurer.json",
  "attorney-general": "attorney-general.json",
  "insurance-commissioner": "insurance-commissioner.json",
  "superintendent-of-public-instruction":
    "superintendent-of-public-instruction.json",
} as const;

export type StatewideOffice = keyof typeof STATEWIDE_FEEDS;

/**
 * District-based office feeds. Unlike the statewide files, each of these holds
 * a contest per district (plus per-county breakdowns), so callers must scope to
 * the specific districts on a voter's ballot. The `match` regex identifies which
 * chamber a `raceTitle` belongs to.
 */
const DISTRICT_FEEDS = {
  "us-house": { file: "us-rep.json", match: /United States Representative/i },
  "state-senate": { file: "state-senate.json", match: /State Senate/i },
  "state-assembly": { file: "state-assembly.json", match: /State Assembly/i },
} as const;

export type DistrictChamber = keyof typeof DISTRICT_FEEDS;

/** A single district race to look up, e.g. { chamber: "state-assembly", number: "28" }. */
export interface DistrictRef {
  chamber: DistrictChamber;
  number: string;
}

// ============================================================================
// Raw feed shapes (as published by the SOS — all numbers are strings)
// ============================================================================

interface RawCandidate {
  Name: string;
  Party: string;
  Votes: string;
  Percent: string;
  incumbent?: boolean;
}

interface RawContest {
  raceTitle: string;
  /** e.g. "100% (19,788 of 19,788) precincts reporting" */
  Reporting: string;
  /** e.g. "June 8, 2026, 3:17 p.m." */
  ReportingTime: string;
  candidates: RawCandidate[];
}

// ============================================================================
// Normalized shapes (what the tRPC procedure + UI consume)
// ============================================================================

export interface ResultCandidate {
  name: string;
  party?: string;
  votes: number;
  /** 0–100, as reported by the SOS. */
  percent: number;
  incumbent: boolean;
  /**
   * True for the candidates advancing out of CA's top-two primary (the two
   * highest vote-getters). Computed here, not in the feed.
   */
  advancing: boolean;
}

export interface ElectionContestResult {
  /**
   * Stable key for the contest. Statewide races use the office slug
   * ("governor"); district races use "<chamber>-<number>" ("state-assembly-28")
   * so the UI can key off it uniquely across both kinds.
   */
  office: string;
  /** Set for district races; identifies the chamber for grouping/labels. */
  chamber?: DistrictChamber;
  /** Set for district races; the district number from the feed title. */
  district?: string;
  /** Display title straight from the feed, e.g. "Governor - Statewide Results". */
  title: string;
  /** Whole-number percent of precincts reporting (0–100), parsed from `Reporting`. */
  percentReporting: number | null;
  /** Verbatim reporting string for display, e.g. "100% (19,788 of 19,788)…". */
  reportingLabel: string;
  /** Human-readable "last updated" straight from the feed. */
  asOf: string;
  /** Deep link to this race on the official SOS results site (Bradbury exit). */
  sourceUrl: string;
  candidates: ResultCandidate[];
}

// ============================================================================
// Parsing helpers
// ============================================================================

/** "1,897,716" → 1897716; tolerant of blanks/garbage → 0. */
function parseCount(raw: string): number {
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** "27.1" → 27.1; tolerant of blanks → 0. */
function parsePercent(raw: string): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Pull the leading "100%" out of the reporting string → 100. */
function parsePercentReporting(reporting: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(reporting);
  return m?.[1] ? parsePercent(m[1]) : null;
}

function normalizeContest(
  raw: RawContest,
  extra: Pick<
    ElectionContestResult,
    "office" | "chamber" | "district" | "sourceUrl"
  >,
): ElectionContestResult {
  const candidates: ResultCandidate[] = raw.candidates
    .map((c) => ({
      name: c.Name,
      party: c.Party || undefined,
      votes: parseCount(c.Votes),
      percent: parsePercent(c.Percent),
      incumbent: c.incumbent ?? false,
      advancing: false,
    }))
    .sort((a, b) => b.votes - a.votes);

  // CA runs a top-two primary: the two highest vote-getters advance to the
  // general regardless of party. Flag them so the UI can mark who moved on.
  for (const c of candidates.slice(0, 2)) c.advancing = true;

  return {
    ...extra,
    title: raw.raceTitle,
    percentReporting: parsePercentReporting(raw.Reporting),
    reportingLabel: raw.Reporting,
    asOf: raw.ReportingTime,
    candidates,
  };
}

// ============================================================================
// Public API
// ============================================================================

async function fetchFeed(file: string): Promise<RawContest[]> {
  const res = await fetch(`${BASE_URL}/${file}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `CA SOS results feed error for ${file} (${res.status}): ${res.statusText}`,
    );
  }
  return (await res.json()) as RawContest[];
}

/** Pull the district number out of a feed title, e.g. "… District 28 …" → "28". */
function titleDistrict(title: string): string | null {
  return /district\s+(\d+)/i.exec(title)?.[1] ?? null;
}

/**
 * Fetch normalized results for the given statewide offices (defaults to the
 * marquee races). Each office's feed may contain several contest objects
 * (statewide + per-county); we keep only the statewide roll-up — the first
 * entry, whose title carries "Statewide".
 */
export async function getStatewideResults(
  offices: StatewideOffice[] = ["governor", "secretary-of-state"],
): Promise<ElectionContestResult[]> {
  const settled = await Promise.allSettled(
    offices.map(async (office) => {
      const feed = await fetchFeed(STATEWIDE_FEEDS[office]);
      const statewide =
        feed.find((c) => /statewide/i.test(c.raceTitle)) ?? feed[0];
      if (!statewide) return null;
      return normalizeContest(statewide, {
        office,
        sourceUrl: statewideUrl(office),
      });
    }),
  );

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<ElectionContestResult | null> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((c): c is ElectionContestResult => c !== null);
}

/**
 * Fetch normalized results for specific district races on a voter's ballot
 * (US House / State Senate / State Assembly). We fetch each chamber's feed at
 * most once and pick out the "Districtwide" roll-up matching each requested
 * district number — the per-county breakdowns in the same feed are ignored.
 * Output preserves the order of `refs` so the UI can present them as the ballot
 * does (federal → state).
 */
export async function getDistrictResults(
  refs: DistrictRef[],
): Promise<ElectionContestResult[]> {
  if (refs.length === 0) return [];

  // One fetch per distinct chamber, even if several districts share it.
  const chambers = [...new Set(refs.map((r) => r.chamber))];
  const feeds = new Map<DistrictChamber, RawContest[]>();
  await Promise.all(
    chambers.map(async (chamber) => {
      try {
        feeds.set(chamber, await fetchFeed(DISTRICT_FEEDS[chamber].file));
      } catch (error) {
        console.warn(`[ca-sos] district feed failed for ${chamber}:`, error);
      }
    }),
  );

  const out: ElectionContestResult[] = [];
  for (const ref of refs) {
    const feed = feeds.get(ref.chamber);
    if (!feed) continue;
    const { match } = DISTRICT_FEEDS[ref.chamber];
    const contest = feed.find(
      (c) =>
        match.test(c.raceTitle) &&
        /districtwide/i.test(c.raceTitle) &&
        titleDistrict(c.raceTitle) === ref.number,
    );
    if (!contest) continue;
    out.push(
      normalizeContest(contest, {
        office: `${ref.chamber}-${ref.number}`,
        chamber: ref.chamber,
        district: ref.number,
        sourceUrl: districtUrl(ref.chamber, ref.number),
      }),
    );
  }
  return out;
}

export const caSosResultsClient = {
  getStatewideResults,
  getDistrictResults,
  STATEWIDE_OFFICES: Object.keys(STATEWIDE_FEEDS) as StatewideOffice[],
  DISTRICT_CHAMBERS: Object.keys(DISTRICT_FEEDS) as DistrictChamber[],
};
