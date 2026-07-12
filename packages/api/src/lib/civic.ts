/**
 * Google Civic Information API Client
 *
 * API Reference: https://developers.google.com/civic-information/docs/v2
 */

import { createHash } from "crypto";

import { and, eq, gt } from "@acme/db";
import { db } from "@acme/db/client";
import { CivicApiCache } from "@acme/db/schema";

import type {
  DistrictRef,
  ElectionContestResult,
  StatewideOffice,
} from "../clients/ca-sos-results";
import type { CrossValidateContext } from "./measure-crossvalidate";
import {
  getDistrictResults,
  getStatewideResults,
} from "../clients/ca-sos-results";
import { getCachedCandidate, setCachedCandidate } from "./candidate-cache";
import { crossValidateCandidate } from "./candidate-crossvalidate";
import { generateRoleDescription } from "./civic-ai";
import { getRoleDescription, saveRoleDescription } from "./civic-descriptions";
import { crossValidateMeasure } from "./measure-crossvalidate";
import { normalizeMeasureTitle } from "./measure-sources/ballotpedia";

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
  divisions: 30 * 24 * 60 * 60 * 1000,
  // Live results move fast on/after election night — keep it short so the feed
  // stays current, but long enough to shield the SOS source from every client.
  electionResults: 5 * 60 * 1000,
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
  /** Biography merged from candidate sources (Ballotpedia/Wikipedia/Vote Smart). */
  biography?: string;
  /** Verbatim candidate statement (county registrar / state SOS voter guide). */
  statement?: string;
  /** Citizen-friendly summary of `statement`. */
  statementSummary?: string;
  /** True when `statementSummary` was AI-generated, not from an official source. */
  statementSummaryIsAiGenerated?: boolean;
  /** True when the candidate currently holds the office (per Open States / Vote Smart). */
  incumbent?: boolean;
  /** Per-field source attribution for the enriched fields above. */
  citations?: MeasureCitationRef[];
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

export interface CivicDivision {
  name: string;
  alsoKnownAs?: string[];
}

export interface DivisionByAddressResponse {
  kind: string;
  normalizedInput: Address;
  divisions: Record<string, CivicDivision>;
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

/** Resolve an address to its current Open Civic Data political divisions. */
export async function getDivisionsByAddress(
  address: string,
): Promise<DivisionByAddressResponse> {
  const cached = await getCached<DivisionByAddressResponse>(
    address,
    "divisionsByAddress",
  );
  if (cached) return cached;

  const response = await fetchCivicApi<DivisionByAddressResponse>(
    "divisionsByAddress",
    { address },
  );
  await setCache(
    address,
    "divisionsByAddress",
    {},
    response,
    CACHE_TTL.divisions,
  );
  return response;
}

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

/**
 * Bound outbound enrichment fan-out for a whole voterinfo request. Contests are
 * enriched concurrently and each contest fans out per candidate × multiple
 * sources, so a cold ballot could otherwise burst hundreds of simultaneous
 * fetches. This module-level limiter caps in-flight enrichments GLOBALLY (not
 * per-contest) so N contests can't multiply the cap.
 */
const ENRICH_CONCURRENCY = 5;
let enrichInFlight = 0;
const enrichQueue: (() => void)[] = [];

function withEnrichLimit<T>(thunk: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      enrichInFlight++;
      thunk()
        .then(resolve, reject)
        .finally(() => {
          enrichInFlight--;
          enrichQueue.shift()?.();
        });
    };
    if (enrichInFlight < ENRICH_CONCURRENCY) run();
    else enrichQueue.push(run);
  });
}

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
    // Google Civic doubles the measure letter ("Measure A A"); collapse it for
    // display and so source matching keys off the clean title.
    contest.referendumTitle = normalizeMeasureTitle(contest.referendumTitle);

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

  // Candidate branch: a non-referendum contest with candidates. Mirror the
  // referendum branch — fan out to candidate sources, merge by trust tier, and
  // attribute every surfaced field — but cache-only per candidate (no DB rows).
  if (contest.candidates?.length) {
    const electionYear = ctx?.electionYear ?? new Date().getFullYear();
    const office = contest.office ?? "";
    const district = contest.district?.name;
    await Promise.all(
      contest.candidates.map((candidate) =>
        withEnrichLimit(async () => {
          try {
            let merged = await getCachedCandidate(
              candidate.name,
              office,
              electionYear,
              ctx?.stateAbbrev,
              district,
              ctx?.county,
            );
            if (!merged) {
              merged = await crossValidateCandidate(
                {
                  name: candidate.name,
                  party: candidate.party,
                  office: contest.office,
                  district,
                  roles: contest.roles,
                  level: contest.level,
                },
                {
                  stateAbbrev: ctx?.stateAbbrev,
                  county: ctx?.county,
                  electionYear,
                },
              );
              await setCachedCandidate(
                candidate.name,
                office,
                electionYear,
                merged,
                ctx?.stateAbbrev,
                district,
                ctx?.county,
              );
            }

            // Merge canonical fields back onto the candidate, preferring enriched
            // values but never clobbering existing Google Civic data with empties.
            candidate.biography = merged.biography ?? candidate.biography;
            candidate.statement = merged.statement ?? candidate.statement;
            candidate.statementSummary =
              merged.statementSummary ?? candidate.statementSummary;
            candidate.statementSummaryIsAiGenerated =
              merged.statementSummaryIsAiGenerated ??
              candidate.statementSummaryIsAiGenerated;
            candidate.incumbent = merged.incumbent ?? candidate.incumbent;
            candidate.photoUrl = merged.photoUrl ?? candidate.photoUrl;
            candidate.candidateUrl =
              merged.candidateUrl ?? candidate.candidateUrl;
            candidate.email = merged.email ?? candidate.email;
            candidate.phone = merged.phone ?? candidate.phone;
            candidate.channels = merged.channels ?? candidate.channels;

            // Cite raw Google Civic fields that survived onto the candidate but
            // no higher-tier source claimed. Better a cited official-ish link
            // than a blank card; each field is cited once (enriched citation
            // wins; google_civic only fills the gaps).
            const citations: MeasureCitationRef[] = [...merged.citations];
            const cited = new Set(citations.map((c) => c.field));
            const rawCivicFields: [string, unknown][] = [
              ["candidateUrl", candidate.candidateUrl],
              ["phone", candidate.phone],
              ["email", candidate.email],
              ["photoUrl", candidate.photoUrl],
              [
                "channels",
                candidate.channels?.length ? candidate.channels : undefined,
              ],
            ];
            for (const [field, value] of rawCivicFields) {
              if (value && !cited.has(field)) {
                citations.push({
                  field,
                  sourceName: "Google Civic Information API",
                  tier: "google_civic",
                  official: false,
                });
                cited.add(field);
              }
            }
            candidate.citations = citations.length ? citations : undefined;
          } catch {
            // Best-effort per candidate: one failure must not break the contest
            // or the other candidates — leave the raw Google Civic data intact.
          }
        }),
      ),
    );
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

  const response = await fetchCivicApi<ElectionsResponse>("elections");
  await setCache(
    "__global__",
    "elections",
    {},
    response.elections,
    CACHE_TTL.elections,
  );
  return response.elections;
}

/**
 * Get live, normalized results for the requested California statewide offices,
 * sourced from the Secretary of State election-night feed. Cached briefly (see
 * CACHE_TTL.electionResults) so the marquee races stay current without hammering
 * the SOS on every client request. Returns [] on total failure rather than
 * throwing — the results section is supplementary and shouldn't break the tab.
 */
export async function getElectionResults(
  offices?: StatewideOffice[],
): Promise<ElectionContestResult[]> {
  // Cache key is global (results aren't address-scoped); the office list
  // distinguishes entries so different selections don't collide.
  const params = { offices: offices ?? "default" };
  const cached = await getCached<ElectionContestResult[]>(
    "__global__",
    "electionResults",
    params,
  );
  if (cached) return cached;

  try {
    const results = await getStatewideResults(offices);
    await setCache(
      "__global__",
      "electionResults",
      params,
      results,
      CACHE_TTL.electionResults,
    );
    return results;
  } catch (error) {
    console.warn("[civic] getElectionResults failed:", error);
    return [];
  }
}

/**
 * Get live results for the specific district races on a voter's ballot (US
 * House / State Senate / State Assembly). The district refs are supplied by the
 * caller (derived from the ballot), so results are scoped to the voter rather
 * than dumping every district in the state. Cached and fail-soft like the
 * statewide variant.
 */
export async function getDistrictElectionResults(
  refs: DistrictRef[],
): Promise<ElectionContestResult[]> {
  if (refs.length === 0) return [];

  // Sort refs so the cache key is stable regardless of caller ordering.
  const sorted = [...refs].sort((a, b) =>
    `${a.chamber}-${a.number}`.localeCompare(`${b.chamber}-${b.number}`),
  );
  const params = { refs: sorted };
  const cached = await getCached<ElectionContestResult[]>(
    "__global__",
    "districtResults",
    params,
  );
  if (cached) return cached;

  try {
    const results = await getDistrictResults(refs);
    await setCache(
      "__global__",
      "districtResults",
      params,
      results,
      CACHE_TTL.electionResults,
    );
    return results;
  } catch (error) {
    console.warn("[civic] getDistrictElectionResults failed:", error);
    return [];
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
    console.error("[civic] getVoterInfo failed:", error);
    throw error;
  }
}

// NOTE: Representatives lookup was removed when Google turned down the Civic
// Representatives API (2025-04-30). A replacement "your elected officials"
// feature is tracked as a roadmap enhancement — see issue #123.
