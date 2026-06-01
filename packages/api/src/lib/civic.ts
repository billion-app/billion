/**
 * Google Civic Information API Client
 *
 * API Reference: https://developers.google.com/civic-information/docs/v2
 */

import { createHash } from "crypto";

import { and, eq, gt } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type { CrossValidateContext } from "./measure-crossvalidate";
import { generateRoleDescription } from "./civic-ai";
import { getRoleDescription, saveRoleDescription } from "./civic-descriptions";
import { crossValidateMeasure } from "./measure-crossvalidate";

const CIVIC_API_BASE = "https://www.googleapis.com/civicinfo/v2";

function getApiKey(): string | null {
  return process.env.GOOGLE_CIVIC_API_KEY ?? null;
}

// ============================================================================
// DB Cache Helpers
// ============================================================================

const CACHE_TTL = {
  elections: 7 * 24 * 60 * 60 * 1000,
  voterinfo: 24 * 60 * 60 * 1000,
  representatives: 30 * 24 * 60 * 60 * 1000,
  representativesEnriched: 30 * 24 * 60 * 60 * 1000,
} as const;

function hashAddress(address: string): string {
  return createHash("sha256")
    .update(address.toLowerCase().trim())
    .digest("hex");
}

function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

async function getCached<T>(
  addressOrGlobal: string,
  endpoint: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  const hash =
    addressOrGlobal === "__global__"
      ? "__global__"
      : hashAddress(addressOrGlobal);
  const paramsStr = stableStringify(params);
  const [row] = await db
    .select()
    .from(CivicApiCache)
    .where(
      and(
        eq(CivicApiCache.addressHash, hash),
        eq(CivicApiCache.endpoint, endpoint),
        eq(CivicApiCache.params, paramsStr),
        gt(CivicApiCache.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ? (row.responseData as T) : null;
}

async function setCache(
  addressOrGlobal: string,
  endpoint: string,
  params: Record<string, unknown>,
  data: unknown,
  ttlMs: number,
): Promise<void> {
  const hash =
    addressOrGlobal === "__global__"
      ? "__global__"
      : hashAddress(addressOrGlobal);
  const paramsStr = stableStringify(params);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  await db
    .insert(CivicApiCache)
    .values({
      addressHash: hash,
      endpoint,
      params: paramsStr,
      responseData: data,
      fetchedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        CivicApiCache.addressHash,
        CivicApiCache.endpoint,
        CivicApiCache.params,
      ],
      set: { responseData: data, fetchedAt: now, expiresAt },
    });
}

// ============================================================================
// Types
// ============================================================================

export interface Election {
  id: string;
  name: string;
  electionDay: string;
  ocdDivisionId: string;
}

export interface ElectionsResponse {
  kind: string;
  elections: Election[];
}

export interface Address {
  locationName?: string;
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  state: string;
  zip: string;
}

export interface PollingLocation {
  address: Address;
  notes?: string;
  pollingHours?: string;
  name?: string;
  voterServices?: string;
  startDate?: string;
  endDate?: string;
  sources?: Source[];
}

export interface Source {
  name: string;
  official: boolean;
  url?: string;
  /** Trust tier of this source (county_registrar > state_sos > … > ai). */
  tier?: string;
}

/** Which source supplied a particular measure field, for UI attribution. */
export interface MeasureCitationRef {
  field: string;
  sourceName: string;
  sourceUrl?: string;
  tier: string;
  official: boolean;
}

/** A single pro/con argument with attribution. */
export interface MeasureArgumentRef {
  text: string;
  author?: string;
  sourceName: string;
  sourceUrl?: string;
}

export interface Contest {
  type: string;
  primaryParty?: string;
  electorateSpecifications?: string;
  special?: string;
  ballotTitle?: string;
  office?: string;
  level?: string[];
  roles?: string[];
  district?: ElectoralDistrict;
  numberElected?: string;
  numberVotingFor?: string;
  ballotPlacement?: string;
  candidates?: Candidate[];
  referendumTitle?: string;
  referendumSubtitle?: string;
  referendumUrl?: string;
  referendumBrief?: string;
  referendumText?: string;
  referendumProStatement?: string;
  referendumConStatement?: string;
  referendumPassageThreshold?: string;
  referendumEffectOfAbstain?: string;
  sources?: Source[];
  roleDescription?: string;
  summary?: string;
  /** One-sentence summary for the ballot card preview. */
  summaryShort?: string;
  /** Fuller plain-language summary for the measure detail screen. */
  summaryLong?: string;
  /** True when `summary` was AI-generated rather than from an official source. */
  summaryIsAiGenerated?: boolean;
  /** Official fiscal impact analysis (e.g. from the LAO or county). */
  fiscalImpact?: string;
  /** Structured, attributed pro arguments (preferred over referendumProStatement). */
  proArguments?: MeasureArgumentRef[];
  /** Structured, attributed con arguments. */
  conArguments?: MeasureArgumentRef[];
  /** Per-field source attribution for everything above. */
  citations?: MeasureCitationRef[];
}

export interface Candidate {
  name: string;
  party?: string;
  candidateUrl?: string;
  phone?: string;
  photoUrl?: string;
  email?: string;
  orderOnBallot?: string;
  channels?: Channel[];
}

export interface Channel {
  type: string;
  id: string;
}

export interface ElectoralDistrict {
  name: string;
  scope?: string;
  id?: string;
}

export interface AdministrationRegion {
  name: string;
  electionAdministrationBody?: AdministrationBody;
  localJurisdiction?: AdministrationRegion;
  sources?: Source[];
}

export interface AdministrationBody {
  name?: string;
  electionInfoUrl?: string;
  electionRegistrationUrl?: string;
  electionRegistrationConfirmationUrl?: string;
  absenteeVotingInfoUrl?: string;
  votingLocationFinderUrl?: string;
  ballotInfoUrl?: string;
  electionRulesUrl?: string;
  voterServices?: string[];
  hoursOfOperation?: string;
  correspondenceAddress?: Address;
  physicalAddress?: Address;
  electionOfficials?: ElectionOfficial[];
}

export interface ElectionOfficial {
  name?: string;
  title?: string;
  officePhoneNumber?: string;
  faxNumber?: string;
  emailAddress?: string;
}

export interface VoterInfoResponse {
  kind: string;
  election: Election;
  normalizedInput: Address;
  pollingLocations?: PollingLocation[];
  earlyVoteSites?: PollingLocation[];
  dropOffLocations?: PollingLocation[];
  contests?: Contest[];
  state?: AdministrationRegion[];
  mailOnly?: boolean;
}

export interface Official {
  name: string;
  address?: Address[];
  party?: string;
  phones?: string[];
  urls?: string[];
  photoUrl?: string;
  emails?: string[];
  channels?: Channel[];
}

export interface Office {
  name: string;
  divisionId: string;
  levels?: string[];
  roles?: string[];
  officialIndices: number[];
}

export interface Division {
  name: string;
  alsoKnownAs?: string[];
  officeIndices?: number[];
}

export interface RepresentativesResponse {
  kind: string;
  normalizedInput: Address;
  divisions: Record<string, Division>;
  offices: Office[];
  officials: Official[];
}

// Enriched types that combine office info with officials
export interface Representative extends Official {
  office: string;
  divisionId: string;
  levels?: string[];
  roles?: string[];
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchCivicApi<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GOOGLE_CIVIC_API_KEY not configured");
  }
  const url = new URL(`${CIVIC_API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Google Civic API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`,
    );
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Mock Data (used when GOOGLE_CIVIC_API_KEY is not configured)
// ============================================================================

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return d.toISOString().split("T")[0]!;
}

const MOCK_ELECTIONS: Election[] = [
  {
    id: "9000",
    name: "California Primary Election",
    electionDay: futureDate(45),
    ocdDivisionId: "ocd-division/country:us/state:ca",
  },
  {
    id: "9001",
    name: "San Jose City Council Special Election",
    electionDay: futureDate(90),
    ocdDivisionId: "ocd-division/country:us/state:ca/place:san_jose",
  },
];

function getMockVoterInfo(address: string): VoterInfoResponse {
  return {
    kind: "civicinfo#voterInfoResponse",
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    election: MOCK_ELECTIONS[0]!,
    normalizedInput: {
      line1: address.split(",")[0] ?? address,
      city: "San Jose",
      state: "CA",
      zip: "95112",
    },
    pollingLocations: [
      {
        address: {
          locationName: "Washington Elementary School",
          line1: "100 Oak St",
          city: "San Jose",
          state: "CA",
          zip: "95112",
        },
        pollingHours: "7:00 AM - 8:00 PM",
        name: "Washington Elementary School",
      },
    ],
    earlyVoteSites: [
      {
        address: {
          locationName: "Santa Clara County Registrar",
          line1: "1555 Berger Dr",
          city: "San Jose",
          state: "CA",
          zip: "95112",
        },
        pollingHours: "Mon-Fri 8:00 AM - 5:00 PM",
        name: "Santa Clara County Registrar of Voters",
        startDate: futureDate(-14),
        endDate: futureDate(44),
      },
    ],
    contests: [
      {
        type: "General",
        office: "U.S. Representative, District 17",
        level: ["country"],
        roles: ["legislatorLowerBody"],
        district: {
          name: "California's 17th Congressional District",
          scope: "congressional",
        },
        candidates: [
          {
            name: "Ro Khanna",
            party: "Democratic",
            candidateUrl: "https://example.com",
          },
          { name: "Anita Chen", party: "Republican" },
        ],
      },
      {
        type: "General",
        office: "State Senator, District 15",
        level: ["administrativeArea1"],
        roles: ["legislatorUpperBody"],
        district: {
          name: "California State Senate District 15",
          scope: "stateUpper",
        },
        candidates: [
          { name: "Dave Cortese", party: "Democratic" },
          { name: "Robert Singh", party: "Republican" },
        ],
      },
      {
        type: "General",
        office: "Mayor, City of San Jose",
        level: ["locality"],
        roles: ["headOfGovernment"],
        district: { name: "City of San Jose", scope: "citywide" },
        candidates: [
          { name: "Maria Gonzalez", party: "Nonpartisan" },
          { name: "Kevin Park", party: "Nonpartisan" },
          { name: "Lisa Tran", party: "Nonpartisan" },
        ],
      },
      {
        type: "General",
        office: "City Council, District 3",
        level: ["locality"],
        roles: ["legislatorLowerBody"],
        district: {
          name: "San Jose City Council District 3",
          scope: "cityCouncil",
        },
        candidates: [
          { name: "Omar Hernandez", party: "Nonpartisan" },
          { name: "Jennifer Wu", party: "Nonpartisan" },
        ],
      },
      {
        type: "Referendum",
        referendumTitle: "Measure A — Affordable Housing Bond",
        referendumSubtitle:
          "Shall the City of San Jose issue $450 million in general obligation bonds to fund affordable housing construction and rehabilitation?",
        referendumProStatement:
          "Addresses critical housing shortage. Creates thousands of affordable units for working families, seniors, and veterans.",
        referendumConStatement:
          "Increases property taxes by approximately $19.60 per $100,000 of assessed value. Adds to existing city debt obligations.",
      },
      {
        type: "Referendum",
        referendumTitle: "Measure B — Parks and Recreation Funding",
        referendumSubtitle:
          "Shall the City authorize a 1/8-cent sales tax increase to fund park maintenance, recreational programs, and new green spaces?",
        referendumProStatement:
          "Invests in neighborhood parks and youth programs. All funds stay local with independent oversight.",
        referendumConStatement:
          "Sales tax increases disproportionately affect lower-income residents. City should prioritize existing revenue for parks.",
      },
      {
        type: "Referendum",
        referendumTitle: "Measure C — Police Oversight Commission",
        referendumSubtitle:
          "Shall the City Charter be amended to establish an independent Police Oversight Commission with subpoena power?",
        referendumProStatement:
          "Creates accountability and transparency in policing. Commission would have independent investigative authority.",
        referendumConStatement:
          "Duplicates existing oversight structures. Could interfere with active investigations and officer due process rights.",
      },
    ],
    state: [
      {
        name: "California",
        electionAdministrationBody: {
          name: "Santa Clara County Registrar of Voters",
          electionInfoUrl: "https://www.sccgov.org/rov",
          electionRegistrationUrl: "https://registertovote.ca.gov",
          absenteeVotingInfoUrl: "https://www.sccgov.org/rov/vbm",
        },
      },
    ],
  };
}

const MOCK_REPRESENTATIVES: Representative[] = [
  {
    name: "Ro Khanna",
    office: "U.S. Representative, CA-17",
    party: "Democratic Party",
    divisionId: "ocd-division/country:us/state:ca/cd:17",
    levels: ["country"],
    roles: ["legislatorLowerBody"],
    urls: ["https://example.com"],
    phones: ["(202) 555-0117"],
  },
  {
    name: "Alex Padilla",
    office: "U.S. Senator",
    party: "Democratic Party",
    divisionId: "ocd-division/country:us/state:ca",
    levels: ["country"],
    roles: ["legislatorUpperBody"],
    phones: ["(202) 555-0100"],
  },
  {
    name: "Matt Mahan",
    office: "Mayor of San Jose",
    party: "Nonpartisan",
    divisionId: "ocd-division/country:us/state:ca/place:san_jose",
    levels: ["locality"],
    roles: ["headOfGovernment"],
    phones: ["(408) 555-0199"],
  },
];

// ============================================================================
// Role/Level Inference from office name
// ============================================================================

function inferRole(office: string): string | undefined {
  const o = office.toLowerCase();
  if (o.includes("governor") && !o.includes("lieutenant"))
    return "headOfGovernment";
  if (o.includes("lieutenant governor")) return "deputyHeadOfGovernment";
  if (o.includes("president")) return "headOfState";
  if (o.includes("mayor")) return "headOfGovernment";
  if (
    o.includes("senator") ||
    o.includes("state senate") ||
    o.includes("upper")
  )
    return "legislatorUpperBody";
  if (
    o.includes("representative") ||
    o.includes("assembly") ||
    o.includes("house") ||
    o.includes("council") ||
    o.includes("delegate")
  )
    return "legislatorLowerBody";
  if (o.includes("judge") || o.includes("justice")) return "judge";
  if (o.includes("school board")) return "schoolBoard";
  if (
    o.includes("secretary of state") ||
    o.includes("attorney general") ||
    o.includes("treasurer") ||
    o.includes("controller") ||
    o.includes("comptroller") ||
    o.includes("superintendent") ||
    o.includes("commissioner") ||
    o.includes("auditor")
  )
    return "governmentOfficer";
  return undefined;
}

function inferLevel(office: string): string | undefined {
  const o = office.toLowerCase();
  if (
    o.includes("us ") ||
    o.includes("u.s.") ||
    o.includes("united states") ||
    o.includes("president")
  )
    return "country";
  if (
    o.includes("state ") ||
    o.includes("governor") ||
    o.includes("lieutenant governor") ||
    o.includes("secretary of state") ||
    o.includes("attorney general") ||
    o.includes("state treasurer") ||
    o.includes("state controller") ||
    o.includes("state comptroller") ||
    o.includes("state superintendent") ||
    o.includes("assembly")
  )
    return "administrativeArea1";
  if (o.includes("county") || o.includes("supervisor"))
    return "administrativeArea2";
  if (
    o.includes("mayor") ||
    o.includes("city council") ||
    o.includes("city ") ||
    o.includes("town ")
  )
    return "locality";
  return undefined;
}

// ============================================================================
// Contest Enrichment
// ============================================================================

interface EnrichmentContext {
  stateAbbrev?: string;
  county?: string;
  electionYear?: number;
}

/**
 * Best-effort county extraction from a voter-info response. The Civic API has
 * no explicit county field, so we scan the places it tends to appear — the
 * election administration region/jurisdiction names and contest district
 * names — for a "<Name> County" string. Used to scope local measure sources.
 */
function deriveCounty(resp: VoterInfoResponse): string | undefined {
  const haystacks: (string | undefined)[] = [];
  for (const region of resp.state ?? []) {
    haystacks.push(region.name);
    haystacks.push(region.electionAdministrationBody?.name);
    haystacks.push(region.localJurisdiction?.name);
    haystacks.push(region.localJurisdiction?.electionAdministrationBody?.name);
  }
  for (const c of resp.contests ?? []) {
    haystacks.push(c.district?.name);
  }
  for (const h of haystacks) {
    const m = /([A-Z][A-Za-z.\s]+?)\s+County\b/.exec(h ?? "");
    if (m?.[1]) return `${m[1].trim()} County`;
  }
  return undefined;
}

async function enrichContest(
  contest: Contest,
  ctx?: EnrichmentContext,
): Promise<Contest> {
  if (contest.referendumTitle) {
    // Cross-validate across all measure sources (county registrar, state SOS,
    // Vote Smart, Google Civic) and merge by trust tier with source
    // attribution. AI is only used as a clearly-labeled last resort.
    const cvCtx: CrossValidateContext = {
      stateAbbrev: ctx?.stateAbbrev,
      county: ctx?.county,
      electionYear: ctx?.electionYear ?? new Date().getFullYear(),
    };

    try {
      const merged = await crossValidateMeasure(
        {
          title: contest.referendumTitle,
          subtitle: contest.referendumSubtitle,
          text: contest.referendumText,
          url: contest.referendumUrl,
          proStatement: contest.referendumProStatement,
          conStatement: contest.referendumConStatement,
        },
        cvCtx,
      );

      contest.summary = merged.summary ?? contest.summary;
      contest.summaryShort = merged.summaryShort ?? merged.summary;
      contest.summaryLong = merged.summaryLong ?? merged.summary;
      contest.summaryIsAiGenerated = merged.summaryIsAiGenerated;
      contest.fiscalImpact = merged.fiscalImpact;
      contest.proArguments = merged.proArguments.length
        ? merged.proArguments
        : undefined;
      contest.conArguments = merged.conArguments.length
        ? merged.conArguments
        : undefined;
      contest.citations = merged.citations.length
        ? merged.citations
        : undefined;

      // Back-fill the legacy single-field shape so existing UI keeps working.
      if (!contest.referendumText && merged.fullText) {
        contest.referendumText = merged.fullText;
      }
      if (!contest.referendumUrl && merged.fullTextUrl) {
        contest.referendumUrl = merged.fullTextUrl;
      }
      if (!contest.referendumProStatement && merged.proArguments[0]) {
        contest.referendumProStatement = merged.proArguments[0].text;
      }
      if (!contest.referendumConStatement && merged.conArguments[0]) {
        contest.referendumConStatement = merged.conArguments[0].text;
      }

      // Expose each citation as a Source entry for attribution UIs.
      contest.sources = merged.citations.map((c) => ({
        name: c.sourceName,
        official: c.official,
        url: c.sourceUrl,
        tier: c.tier,
      }));
    } catch {
      // Enrichment failed entirely — leave the raw Google Civic data intact.
    }
    return contest;
  }

  if (contest.office && !contest.roleDescription) {
    const role = contest.roles?.[0] ?? inferRole(contest.office);
    const level = contest.level?.[0] ?? inferLevel(contest.office);

    const dbDesc = await getRoleDescription(role, level);
    if (dbDesc) {
      contest.roleDescription = dbDesc;
      return contest;
    }

    try {
      const generated = await generateRoleDescription(
        contest.office,
        role,
        level,
        contest.district?.name,
      );
      contest.roleDescription = generated;
      if (role) {
        await saveRoleDescription(role, level ?? null, generated, "ai").catch(
          () => {
            // best-effort cache write; ignore failures
          },
        );
      }
    } catch {
      // AI generation failed
    }
  }

  return contest;
}

async function enrichContests(
  contests?: Contest[],
  ctx?: EnrichmentContext,
): Promise<Contest[] | undefined> {
  if (!contests?.length) return contests;
  return Promise.all(contests.map((c) => enrichContest(c, ctx)));
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get a list of upcoming elections
 *
 * @returns List of elections visible to the API
 */
export async function getElections(): Promise<Election[]> {
  const cached = await getCached<Election[]>("__global__", "elections");
  if (cached) return cached;

  if (!getApiKey()) return MOCK_ELECTIONS;
  try {
    const response = await fetchCivicApi<ElectionsResponse>("elections");
    const result =
      response.elections.length > 0 ? response.elections : MOCK_ELECTIONS;
    await setCache("__global__", "elections", {}, result, CACHE_TTL.elections);
    return result;
  } catch (error) {
    console.warn("[civic] getElections failed, using mock data:", error);
    return MOCK_ELECTIONS;
  }
}

/**
 * Get voter info for a specific address
 *
 * @param address - The registered address of the voter
 * @param electionId - Optional election ID (from getElections). If not provided,
 *                     returns info for the most relevant upcoming election.
 * @returns Polling locations, ballot info, and contests for the address
 */
export async function getVoterInfo(
  address: string,
  electionId?: string,
): Promise<VoterInfoResponse> {
  const cacheParams: Record<string, unknown> = electionId ? { electionId } : {};
  const cached = await getCached<VoterInfoResponse>(
    address,
    "voterinfo",
    cacheParams,
  );
  if (cached) return cached;

  const enrichCtx = (resp: VoterInfoResponse): EnrichmentContext => ({
    stateAbbrev: resp.normalizedInput.state,
    county: deriveCounty(resp),
    electionYear: resp.election.electionDay
      ? new Date(resp.election.electionDay).getFullYear()
      : new Date().getFullYear(),
  });

  if (!getApiKey()) {
    const mock = getMockVoterInfo(address);
    mock.contests = await enrichContests(mock.contests, enrichCtx(mock));
    return mock;
  }
  const params: Record<string, string> = { address };

  if (electionId) {
    params.electionId = electionId;
  }

  try {
    let result: VoterInfoResponse;
    try {
      result = await fetchCivicApi<VoterInfoResponse>("voterinfo", params);
    } catch (err) {
      // A stale/invalid electionId yields "Election unknown" (400). Retry
      // without it so Civic resolves the relevant upcoming election itself.
      if (electionId && /election unknown/i.test(String(err))) {
        console.warn(
          "[civic] electionId rejected, retrying without it:",
          electionId,
        );
        delete params.electionId;
        result = await fetchCivicApi<VoterInfoResponse>("voterinfo", params);
      } else {
        throw err;
      }
    }
    result.contests = await enrichContests(result.contests, enrichCtx(result));
    await setCache(
      address,
      "voterinfo",
      cacheParams,
      result,
      CACHE_TTL.voterinfo,
    );
    return result;
  } catch (error) {
    console.warn("[civic] getVoterInfo failed, using mock data:", error);
    const mock = getMockVoterInfo(address);
    mock.contests = await enrichContests(mock.contests, enrichCtx(mock));
    return mock;
  }
}

/**
 * Get elected officials (representatives) for an address
 *
 * @param address - The address to look up
 * @param levels - Optional filter by government level: country, administrativeArea1 (state),
 *                 administrativeArea2 (county), locality, regional, special, subLocality1, subLocality2
 * @param roles - Optional filter by role: headOfState, headOfGovernment, deputyHeadOfGovernment,
 *                governmentOfficer, executiveCouncil, legislatorUpperBody, legislatorLowerBody,
 *                highestCourtJudge, judge, schoolBoard, specialPurposeOfficer
 * @returns Representatives with their offices and contact information
 */
export async function getRepresentatives(
  address: string,
  options?: {
    levels?: string[];
    roles?: string[];
    includeOffices?: boolean;
  },
): Promise<RepresentativesResponse> {
  const cacheParams: Record<string, unknown> = {
    ...(options?.levels?.length ? { levels: options.levels } : {}),
    ...(options?.roles?.length ? { roles: options.roles } : {}),
  };
  const cached = await getCached<RepresentativesResponse>(
    address,
    "representatives",
    cacheParams,
  );
  if (cached) return cached;

  if (!getApiKey()) {
    return {
      kind: "civicinfo#representativeInfoResponse",
      normalizedInput: {
        line1: address,
        city: "San Jose",
        state: "CA",
        zip: "95112",
      },
      divisions: {},
      offices: MOCK_REPRESENTATIVES.map((r, i) => ({
        name: r.office,
        divisionId: r.divisionId,
        levels: r.levels,
        roles: r.roles,
        officialIndices: [i],
      })),
      officials: MOCK_REPRESENTATIVES.map((r) => ({
        name: r.name,
        party: r.party,
        phones: r.phones,
        urls: r.urls,
      })),
    };
  }
  const params: Record<string, string> = { address };

  if (options?.levels?.length) {
    params.levels = options.levels.join(",");
  }

  if (options?.roles?.length) {
    params.roles = options.roles.join(",");
  }

  if (options?.includeOffices === false) {
    params.includeOffices = "false";
  }

  const result = await fetchCivicApi<RepresentativesResponse>(
    "representatives",
    params,
  );
  await setCache(
    address,
    "representatives",
    cacheParams,
    result,
    CACHE_TTL.representatives,
  );
  return result;
}

/**
 * Get representatives with office info merged (convenience function)
 *
 * @param address - The address to look up
 * @returns Array of representatives with their office information included
 */
export async function getRepresentativesEnriched(
  address: string,
  options?: {
    levels?: string[];
    roles?: string[];
  },
): Promise<Representative[]> {
  const cacheParams: Record<string, unknown> = {
    ...(options?.levels?.length ? { levels: options.levels } : {}),
    ...(options?.roles?.length ? { roles: options.roles } : {}),
  };
  const cached = await getCached<Representative[]>(
    address,
    "representativesEnriched",
    cacheParams,
  );
  if (cached) return cached;

  if (!getApiKey()) return MOCK_REPRESENTATIVES;
  const response = await getRepresentatives(address, options);

  const representatives: Representative[] = [];

  for (const office of response.offices) {
    for (const index of office.officialIndices) {
      const official = response.officials[index];
      if (official) {
        representatives.push({
          ...official,
          office: office.name,
          divisionId: office.divisionId,
          levels: office.levels,
          roles: office.roles,
        });
      }
    }
  }

  await setCache(
    address,
    "representativesEnriched",
    cacheParams,
    representatives,
    CACHE_TTL.representativesEnriched,
  );
  return representatives;
}
