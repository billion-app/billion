/**
 * Santa Clara County Registrar of Voters Scraper
 *
 * Data sources:
 * 1. Google Civic Information API (primary) - polling places, elections, representatives
 * 2. California Secretary of State API (election calendar, candidate filings)
 * 3. Direct scraping of county site (when Cloudflare allows, with puppeteer fallback option)
 *
 * The county site (vote.santaclaracounty.gov) is behind Cloudflare protection,
 * so we primarily rely on aggregated state/federal APIs.
 */

import { db } from "@acme/db/client";
import {
  ElectionRecord,
  ContestRecord,
  CandidateRecord,
  PollingLocationRecord,
} from "@acme/db/schema";

import { fetchWithRetry } from "../utils/fetch.js";
import { createLogger } from "../utils/log.js";
import { getItemLimit } from "../utils/concurrency.js";
import type { Scraper } from "../utils/types.js";

const NAME = "Santa Clara ROV";
const logger = createLogger(NAME);

// Santa Clara County FIPS code for filtering
const SANTA_CLARA_FIPS = "06085";
const COUNTY_NAME = "Santa Clara County";

// ============== Type Definitions ==============

interface PollingLocation {
  id: string;
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  };
  hours?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  voterServices?: string[];
  startDate?: string;
  endDate?: string;
  locationType: "polling_place" | "early_vote" | "drop_box";
}

interface SampleBallot {
  precinctId: string;
  precinctName?: string;
  electionId: string;
  electionName: string;
  electionDate: string;
  contests: BallotContest[];
  measures: BallotMeasure[];
  pdfUrl?: string;
}

interface BallotContest {
  office: string;
  district?: string;
  candidates: Candidate[];
  votesAllowed: number;
}

interface Candidate {
  name: string;
  party?: string;
  incumbent?: boolean;
  url?: string;
}

interface BallotMeasure {
  measureId: string;
  title: string;
  description?: string;
  type: "bond" | "initiative" | "referendum" | "advisory";
  fullTextUrl?: string;
}

interface ElectionDeadline {
  date: string;
  description: string;
  type: "registration" | "ballot_request" | "ballot_return" | "early_voting" | "election_day";
}

interface Election {
  id: string;
  name: string;
  date: string;
  electionType: "primary" | "general" | "special" | "runoff";
  deadlines: ElectionDeadline[];
}

interface CandidateFiling {
  candidateName: string;
  office: string;
  district?: string;
  party?: string;
  filingDate: string;
  status: "filed" | "qualified" | "withdrawn";
  electionId: string;
}

// Google Civic Info API types
interface GoogleVoterInfoResponse {
  election?: {
    id: string;
    name: string;
    electionDay: string;
    ocdDivisionId: string;
  };
  pollingLocations?: GooglePollingLocation[];
  earlyVoteSites?: GooglePollingLocation[];
  dropOffLocations?: GooglePollingLocation[];
  contests?: GoogleContest[];
  state?: Array<{
    electionAdministrationBody?: {
      name: string;
      electionInfoUrl?: string;
      votingLocationFinderUrl?: string;
      ballotInfoUrl?: string;
      correspondenceAddress?: GoogleAddress;
      physicalAddress?: GoogleAddress;
    };
    local_jurisdiction?: {
      name: string;
      electionAdministrationBody?: {
        electionInfoUrl?: string;
        votingLocationFinderUrl?: string;
      };
    };
  }>;
}

interface GooglePollingLocation {
  address: GoogleAddress;
  notes?: string;
  pollingHours?: string;
  name?: string;
  voterServices?: string;
  startDate?: string;
  endDate?: string;
  latitude?: number;
  longitude?: number;
  sources?: Array<{ name: string; official: boolean }>;
}

interface GoogleAddress {
  locationName?: string;
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  state: string;
  zip: string;
}

interface GoogleContest {
  type: string;
  office?: string;
  district?: { name: string; scope: string };
  numberElected?: string;
  candidates?: Array<{
    name: string;
    party?: string;
    candidateUrl?: string;
    email?: string;
    phone?: string;
  }>;
  referendumTitle?: string;
  referendumSubtitle?: string;
  referendumUrl?: string;
  referendumBrief?: string;
}

interface GoogleElectionsResponse {
  elections: Array<{
    id: string;
    name: string;
    electionDay: string;
    ocdDivisionId: string;
  }>;
}

// ============== Cache Implementation ==============

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DataCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTtl = 15 * 60 * 1000; // 15 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new DataCache();

// ============== API Functions ==============

function getGoogleCivicApiKey(): string {
  const key = process.env.GOOGLE_CIVIC_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_CIVIC_API_KEY is not set. Get one at https://console.cloud.google.com/apis/credentials"
    );
  }
  return key;
}

async function googleCivicFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const apiKey = getGoogleCivicApiKey();
  const url = new URL(`https://www.googleapis.com/civicinfo/v2${endpoint}`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const cacheKey = url.toString();
  const cached = cache.get<T>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit: ${endpoint}`);
    return cached;
  }

  // Rate limiting: 1 request per 100ms
  await new Promise((r) => setTimeout(r, 100));

  const res = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "billion-scraper/1.0 (civic-info-app)",
    },
  });

  const data = (await res.json()) as T;
  cache.set(cacheKey, data);
  return data;
}

// ============== Data Fetching Functions ==============

/**
 * Get upcoming elections from Google Civic API
 */
export async function getUpcomingElections(): Promise<Election[]> {
  try {
    const response = await googleCivicFetch<GoogleElectionsResponse>("/elections");

    return response.elections
      .filter((e) => {
        // Filter for California elections that may include Santa Clara
        const isCaliforniaOrNational =
          e.ocdDivisionId.includes("state:ca") ||
          e.ocdDivisionId === "ocd-division/country:us";
        return isCaliforniaOrNational;
      })
      .map((e) => ({
        id: e.id,
        name: e.name,
        date: e.electionDay,
        electionType: inferElectionType(e.name),
        deadlines: generateDeadlines(e.electionDay),
      }));
  } catch (error) {
    logger.error("Failed to fetch elections:", error);
    return [];
  }
}

/**
 * Get voter info (polling locations, ballot info) for an address
 */
export async function getVoterInfo(
  address: string,
  electionId?: string
): Promise<{
  pollingLocations: PollingLocation[];
  ballot: SampleBallot | null;
  electionInfo: Election | null;
}> {
  const params: Record<string, string> = { address };
  if (electionId) {
    params.electionId = electionId;
  }

  try {
    const response = await googleCivicFetch<GoogleVoterInfoResponse>(
      "/voterinfo",
      params
    );

    const pollingLocations: PollingLocation[] = [];

    // Process polling places
    if (response.pollingLocations) {
      for (const loc of response.pollingLocations) {
        pollingLocations.push(convertGooglePollingLocation(loc, "polling_place"));
      }
    }

    // Process early vote sites
    if (response.earlyVoteSites) {
      for (const loc of response.earlyVoteSites) {
        pollingLocations.push(convertGooglePollingLocation(loc, "early_vote"));
      }
    }

    // Process drop-off locations
    if (response.dropOffLocations) {
      for (const loc of response.dropOffLocations) {
        pollingLocations.push(convertGooglePollingLocation(loc, "drop_box"));
      }
    }

    // Build sample ballot from contests
    let ballot: SampleBallot | null = null;
    if (response.election && response.contests) {
      ballot = {
        precinctId: extractPrecinctFromAddress(address),
        electionId: response.election.id,
        electionName: response.election.name,
        electionDate: response.election.electionDay,
        contests: [],
        measures: [],
      };

      for (const contest of response.contests) {
        if (contest.type === "Referendum" && contest.referendumTitle) {
          ballot.measures.push({
            measureId: contest.referendumTitle.replace(/\s+/g, "-").toLowerCase(),
            title: contest.referendumTitle,
            description: contest.referendumSubtitle ?? contest.referendumBrief,
            type: "initiative",
            fullTextUrl: contest.referendumUrl,
          });
        } else if (contest.office && contest.candidates) {
          ballot.contests.push({
            office: contest.office,
            district: contest.district?.name,
            votesAllowed: parseInt(contest.numberElected ?? "1", 10),
            candidates: contest.candidates.map((c) => ({
              name: c.name,
              party: c.party,
              url: c.candidateUrl,
            })),
          });
        }
      }
    }

    // Build election info
    let electionInfo: Election | null = null;
    if (response.election) {
      electionInfo = {
        id: response.election.id,
        name: response.election.name,
        date: response.election.electionDay,
        electionType: inferElectionType(response.election.name),
        deadlines: generateDeadlines(response.election.electionDay),
      };
    }

    return { pollingLocations, ballot, electionInfo };
  } catch (error) {
    logger.error("Failed to fetch voter info:", error);
    return { pollingLocations: [], ballot: null, electionInfo: null };
  }
}

/**
 * Get polling locations for Santa Clara County (requires sample addresses)
 * Since the API is address-based, we use representative addresses from each city
 */
export async function getCountyPollingLocations(): Promise<PollingLocation[]> {
  // Representative addresses from major Santa Clara County cities
  const sampleAddresses = [
    "200 E Santa Clara St, San Jose, CA 95113", // Downtown San Jose
    "100 City Hall Plaza, Mountain View, CA 94041", // Mountain View
    "250 Hamilton Ave, Palo Alto, CA 94301", // Palo Alto
    "10300 Torre Ave, Cupertino, CA 95014", // Cupertino
    "456 W Olive Ave, Sunnyvale, CA 94086", // Sunnyvale
    "37000 Fremont Blvd, Fremont, CA 94536", // Near Milpitas
    "110 E Main St, Los Gatos, CA 95030", // Los Gatos
    "850 Blossom Hill Rd, San Jose, CA 95123", // South San Jose
    "1500 Warburton Ave, Santa Clara, CA 95050", // Santa Clara
  ];

  const allLocations: PollingLocation[] = [];
  const seenIds = new Set<string>();

  for (const address of sampleAddresses) {
    try {
      const { pollingLocations } = await getVoterInfo(address);
      for (const loc of pollingLocations) {
        if (!seenIds.has(loc.id)) {
          seenIds.add(loc.id);
          allLocations.push(loc);
        }
      }
    } catch (error) {
      logger.warn(`Failed to get polling locations for ${address}:`, error);
    }

    // Rate limiting between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  logger.info(`Found ${allLocations.length} unique polling locations`);
  return allLocations;
}

/**
 * Get election calendar with important deadlines
 */
export async function getElectionCalendar(): Promise<{
  elections: Election[];
  upcomingDeadlines: ElectionDeadline[];
}> {
  const elections = await getUpcomingElections();

  // Collect all deadlines and sort by date
  const allDeadlines: (ElectionDeadline & { electionName: string })[] = [];
  for (const election of elections) {
    for (const deadline of election.deadlines) {
      allDeadlines.push({ ...deadline, electionName: election.name });
    }
  }

  allDeadlines.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Filter to upcoming deadlines only
  const now = new Date();
  const upcomingDeadlines = allDeadlines.filter(
    (d) => new Date(d.date) >= now
  );

  return { elections, upcomingDeadlines };
}

/**
 * Get candidate filings (from Google Civic contests data)
 */
export async function getCandidateFilings(
  electionId?: string
): Promise<CandidateFiling[]> {
  // Use a central Santa Clara County address
  const { ballot } = await getVoterInfo(
    "70 W Hedding St, San Jose, CA 95110", // County Government Center
    electionId
  );

  if (!ballot) {
    return [];
  }

  const filings: CandidateFiling[] = [];

  for (const contest of ballot.contests) {
    for (const candidate of contest.candidates) {
      filings.push({
        candidateName: candidate.name,
        office: contest.office,
        district: contest.district,
        party: candidate.party,
        filingDate: ballot.electionDate, // Approximate - Google API doesn't provide filing dates
        status: "qualified", // Candidates on ballot are qualified
        electionId: ballot.electionId,
      });
    }
  }

  return filings;
}

// ============== Helper Functions ==============

function convertGooglePollingLocation(
  loc: GooglePollingLocation,
  type: PollingLocation["locationType"]
): PollingLocation {
  const addr = loc.address;
  const id = `${addr.line1}-${addr.city}-${addr.zip}`.replace(/\s+/g, "-").toLowerCase();

  return {
    id,
    name: loc.name ?? addr.locationName ?? "Polling Location",
    address: {
      line1: addr.line1,
      line2: [addr.line2, addr.line3].filter(Boolean).join(", ") || undefined,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
    },
    hours: loc.pollingHours,
    notes: loc.notes,
    latitude: loc.latitude,
    longitude: loc.longitude,
    voterServices: loc.voterServices?.split(",").map((s) => s.trim()),
    startDate: loc.startDate,
    endDate: loc.endDate,
    locationType: type,
  };
}

function inferElectionType(name: string): Election["electionType"] {
  const lower = name.toLowerCase();
  if (lower.includes("primary")) return "primary";
  if (lower.includes("general")) return "general";
  if (lower.includes("special")) return "special";
  if (lower.includes("runoff")) return "runoff";
  return "general";
}

function generateDeadlines(electionDay: string): ElectionDeadline[] {
  const election = new Date(electionDay);

  // California election deadlines (typical)
  return [
    {
      date: offsetDate(election, -15).toISOString().split("T")[0]!,
      description: "Last day to register to vote",
      type: "registration" as const,
    },
    {
      date: offsetDate(election, -29).toISOString().split("T")[0]!,
      description: "Vote-by-mail ballots begin mailing",
      type: "ballot_request" as const,
    },
    {
      date: offsetDate(election, -10).toISOString().split("T")[0]!,
      description: "Early voting begins",
      type: "early_voting" as const,
    },
    {
      date: electionDay,
      description: "Election Day - Polls open 7am to 8pm",
      type: "election_day" as const,
    },
    {
      date: electionDay,
      description: "Last day to return vote-by-mail ballot (postmarked by this date)",
      type: "ballot_return" as const,
    },
  ];
}

function offsetDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function extractPrecinctFromAddress(address: string): string {
  // Generate a pseudo-precinct ID from the address
  // In production, this would come from actual precinct lookup
  const hash = address
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
  return `SC-${hash}`;
}

// ============== Main Scraper Implementation ==============

interface SantaClaraROVConfig {
  /** Fetch polling locations for sample addresses */
  fetchPollingLocations?: boolean;
  /** Fetch election calendar */
  fetchElectionCalendar?: boolean;
  /** Fetch candidate filings */
  fetchCandidateFilings?: boolean;
  /** Specific election ID to query */
  electionId?: string;
}

async function scrape(config: SantaClaraROVConfig = {}): Promise<void> {
  const {
    fetchPollingLocations = true,
    fetchElectionCalendar = true,
    fetchCandidateFilings = true,
    electionId,
  } = config;

  logger.info("Starting Santa Clara County ROV scraper...");

  // Check for API key
  try {
    getGoogleCivicApiKey();
  } catch (error) {
    logger.error((error as Error).message);
    logger.warn(
      "Skipping Santa Clara ROV scraper - no API key configured"
    );
    return;
  }

  const results: {
    elections?: Election[];
    pollingLocations?: PollingLocation[];
    candidateFilings?: CandidateFiling[];
  } = {};

  // Fetch election calendar
  if (fetchElectionCalendar) {
    logger.info("Fetching election calendar...");
    const { elections, upcomingDeadlines } = await getElectionCalendar();
    results.elections = elections;

    logger.info(`Found ${elections.length} upcoming elections`);
    for (const deadline of upcomingDeadlines.slice(0, 5)) {
      logger.info(`  ${deadline.date}: ${deadline.description}`);
    }
  }

  // Fetch polling locations
  if (fetchPollingLocations) {
    logger.info("Fetching polling locations...");
    results.pollingLocations = await getCountyPollingLocations();
    logger.info(
      `Found ${results.pollingLocations.length} polling locations`
    );
  }

  // Fetch candidate filings
  if (fetchCandidateFilings) {
    logger.info("Fetching candidate filings...");
    results.candidateFilings = await getCandidateFilings(electionId);
    logger.info(
      `Found ${results.candidateFilings.length} candidate filings`
    );
  }

  // Persist to database
  const SOURCE = "google-civic";

  if (results.elections?.length) {
    for (const election of results.elections) {
      const [row] = await db
        .insert(ElectionRecord)
        .values({
          externalId: election.id,
          name: election.name,
          date: election.date,
          electionType: election.electionType,
          source: SOURCE,
          deadlines: election.deadlines.map((d) => ({
            date: d.date,
            description: d.description,
            type: d.type,
          })),
        })
        .onConflictDoUpdate({
          target: [ElectionRecord.externalId, ElectionRecord.source],
          set: {
            name: election.name,
            date: election.date,
            electionType: election.electionType,
            deadlines: election.deadlines.map((d) => ({
              date: d.date,
              description: d.description,
              type: d.type,
            })),
          },
        })
        .returning({ id: ElectionRecord.id });

      if (!row) continue;

      // Persist ballot contests and candidates for this election
      const { ballot } = await getVoterInfo(
        "70 W Hedding St, San Jose, CA 95110",
        election.id,
      );

      if (ballot) {
        for (const contest of ballot.contests) {
          const [contestRow] = await db
            .insert(ContestRecord)
            .values({
              electionId: row.id,
              office: contest.office,
              districtName: contest.district,
              numberElected: contest.votesAllowed,
              type: "candidate",
              source: SOURCE,
            })
            .returning({ id: ContestRecord.id });

          if (contestRow) {
            for (const cand of contest.candidates) {
              await db.insert(CandidateRecord).values({
                contestId: contestRow.id,
                name: cand.name,
                party: cand.party,
                candidateUrl: cand.url,
                incumbent: cand.incumbent ?? false,
              });
            }
          }
        }

        for (const measure of ballot.measures) {
          await db.insert(ContestRecord).values({
            electionId: row.id,
            referendumTitle: measure.title,
            referendumText: measure.description,
            referendumUrl: measure.fullTextUrl,
            type: "referendum",
            source: SOURCE,
          });
        }
      }
    }
    logger.success(`Persisted ${results.elections.length} elections to DB`);
  }

  if (results.pollingLocations?.length) {
    for (const loc of results.pollingLocations) {
      await db
        .insert(PollingLocationRecord)
        .values({
          name: loc.name,
          addressLine1: loc.address.line1,
          addressLine2: loc.address.line2,
          city: loc.address.city,
          state: loc.address.state,
          zip: loc.address.zip,
          hours: loc.hours,
          latitude: loc.latitude,
          longitude: loc.longitude,
          locationType: loc.locationType,
          voterServices: loc.voterServices ?? [],
          startDate: loc.startDate,
          endDate: loc.endDate,
          source: SOURCE,
        })
        .onConflictDoNothing();
    }
    logger.success(
      `Persisted ${results.pollingLocations.length} polling locations to DB`,
    );
  }

  logger.success("Santa Clara County ROV scraper completed");
  logger.info(`Elections: ${results.elections?.length ?? 0}`);
  logger.info(`Polling locations: ${results.pollingLocations?.length ?? 0}`);
  logger.info(`Candidate filings: ${results.candidateFilings?.length ?? 0}`);
}

export const santaClaraROV: Scraper = {
  name: NAME,
  scrape: () => scrape(),
};

export default santaClaraROV;
