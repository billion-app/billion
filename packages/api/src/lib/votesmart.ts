/**
 * Vote Smart API Client
 *
 * Fetches ballot measure data (summaries, full text, pro/con URLs) for
 * state-level measures. Local measures are not covered by this API.
 *
 * API Reference: https://api.votesmart.org/docs/Measure.html
 */

const VOTESMART_API_BASE = "https://api.votesmart.org";

export function getApiKey(): string | null {
  return process.env.VOTE_SMART_API_KEY ?? null;
}

export interface VoteSmartMeasure {
  measureId: string;
  measureCode: string;
  title: string;
  electionDate?: string;
  electionType?: string;
  outcome?: string;
  source?: string;
  url?: string;
  summary?: string;
  summaryUrl?: string;
  measureText?: string;
  textUrl?: string;
  proUrl?: string;
  conUrl?: string;
  yes?: string;
  no?: string;
}

export async function fetchVoteSmart<T>(
  className: string,
  method: string,
  params: Record<string, string>,
): Promise<T> {
  const key = getApiKey();
  if (!key) throw new Error("VOTE_SMART_API_KEY is not set");

  const url = new URL(`${VOTESMART_API_BASE}/${className}.${method}`);
  url.searchParams.set("key", key);
  url.searchParams.set("o", "JSON");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`Vote Smart API ${resp.status}: ${resp.statusText}`);
  }

  const data = (await resp.json()) as T & {
    error?: { errorMessage: string };
  };
  if (data.error) {
    throw new Error(`Vote Smart API error: ${data.error.errorMessage}`);
  }
  return data;
}

// US state name → two-letter abbreviation
const STATE_ABBREVS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

export function stateNameToAbbrev(name: string): string | null {
  return STATE_ABBREVS[name.toLowerCase().trim()] ?? null;
}

interface MeasureListResponse {
  measures: {
    measure: VoteSmartMeasure | VoteSmartMeasure[];
  };
}

interface MeasureDetailResponse {
  measure: VoteSmartMeasure;
}

/**
 * Get all ballot measures for a state in a given year.
 */
export async function getMeasuresByYearState(
  year: number,
  stateId: string,
): Promise<VoteSmartMeasure[]> {
  const data = await fetchVoteSmart<MeasureListResponse>(
    "Measure",
    "getMeasuresByYearState",
    { year: String(year), stateId },
  );
  const raw = data.measures?.measure;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Get full details for a specific ballot measure.
 */
export async function getMeasureDetail(
  measureId: string,
): Promise<VoteSmartMeasure> {
  const data = await fetchVoteSmart<MeasureDetailResponse>(
    "Measure",
    "getMeasure",
    { measureId },
  );
  return data.measure;
}

/**
 * Try to match a referendum title from Google Civic to a Vote Smart measure.
 *
 * Uses fuzzy matching on the title: strips measure codes like "Prop 36",
 * "Measure A", etc. and compares remaining words.
 */
function normalizeMeasureTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(proposition|prop|measure|amendment|question|initiative)\s+[a-z0-9]+\s*[-–—:.]?\s*/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeMeasureTitle(a).split(/\s+/));
  const wordsB = new Set(normalizeMeasureTitle(b).split(/\s+/));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

export interface VoteSmartEnrichment {
  summary?: string;
  measureText?: string;
  textUrl?: string;
  proUrl?: string;
  conUrl?: string;
  source: string;
  voteSmartUrl?: string;
}

/**
 * Try to enrich a ballot measure with Vote Smart data.
 *
 * @param referendumTitle - Title from Google Civic API
 * @param stateAbbrev - Two-letter state code, or full state name
 * @param electionYear - Year of the election
 * @returns Enrichment data if a match is found, null otherwise
 */
export async function enrichFromVoteSmart(
  referendumTitle: string,
  stateAbbrev: string,
  electionYear: number,
): Promise<VoteSmartEnrichment | null> {
  if (!getApiKey()) return null;

  const stateId =
    stateAbbrev.length === 2
      ? stateAbbrev.toUpperCase()
      : stateNameToAbbrev(stateAbbrev);
  if (!stateId) return null;

  try {
    const measures = await getMeasuresByYearState(electionYear, stateId);
    if (!measures.length) return null;

    // Find best title match
    let best: VoteSmartMeasure | null = null;
    let bestScore = 0;
    for (const m of measures) {
      const score = titleSimilarity(referendumTitle, m.title);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }

    if (!best || bestScore < 0.3) return null;

    const detail = await getMeasureDetail(best.measureId);

    return {
      summary: detail.summary || undefined,
      measureText: detail.measureText || undefined,
      textUrl: detail.textUrl || undefined,
      proUrl: detail.proUrl || undefined,
      conUrl: detail.conUrl || undefined,
      source: detail.source || "Vote Smart",
      voteSmartUrl: detail.url || undefined,
    };
  } catch {
    return null;
  }
}
