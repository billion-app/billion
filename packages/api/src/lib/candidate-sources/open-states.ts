/**
 * Open States adapter — incumbent detection + contact/photo for state
 * legislators.
 *
 * Scope: STATE LEGISLATORS ONLY. Open States covers state upper/lower house
 * members, not local offices (city council, mayor, county supervisor) or
 * federal seats. We gate hard on contest level/roles and return null for
 * anything out of scope.
 *
 * What it contributes: incumbent flag (a current_role means they hold the seat
 * now), photo, email, phone, website, and social channels. Tier is
 * `vote_smart` (rank 3) — Open States is a credible public-records aggregator,
 * not a primary government source, so it sits at the same trust level as Vote
 * Smart in the merge engine.
 *
 * Matching requires BOTH name (fuzzy token overlap) AND district to align so a
 * common name in a multi-seat chamber can't false-match. Best-effort: gate on
 * the API key (the client throws when it is unset), never throw, return null on
 * any failure or no match.
 */

import type { OpenStatesPerson } from "../../clients/open-states";
import type { CandidateChannel, CandidateSourceData } from "./types";
import { getLegislators } from "../../clients/open-states";
import { candidateNameSimilarity } from "./types";

const SOURCE_NAME = "Open States";
/** Token-overlap threshold to accept a name match (handles nicknames). */
const NAME_MATCH_THRESHOLD = 0.5;

/**
 * Context passed to candidate enrichment adapters. Extracted from the Contest
 * and the surrounding enrichment context in civic.ts. `district` is the
 * human-readable district name (e.g. "State Senate District 1").
 */
export interface CandidateEnrichmentContext {
  office?: string;
  district?: string;
  roles?: string[];
  level?: string[];
  stateAbbrev?: string;
}

/** Treat empty/whitespace strings as missing. */
function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

/** Map contest roles to Open States org_classification. */
function orgClassificationFromRoles(
  roles: string[] | undefined,
): "upper" | "lower" | undefined {
  if (!roles) return undefined;
  if (roles.includes("legislatorUpperBody")) return "upper";
  if (roles.includes("legislatorLowerBody")) return "lower";
  return undefined;
}

/**
 * Pull the numeric district out of a human-readable district name. Open States
 * keys districts as bare strings ("1", "12"). Returns null when no number is
 * present (e.g. "at-large"), in which case we let Open States return all
 * district legislators and rely on the name match.
 */
function extractDistrict(districtName: string | undefined): string | null {
  if (!districtName) return null;
  const m = /\d+/.exec(districtName);
  return m ? m[0] : null;
}

/** Pick the candidate's homepage/website from their links. */
function pickWebsite(person: OpenStatesPerson): string | undefined {
  const links = person.links;
  if (!links || links.length === 0) return undefined;
  const preferred = links.find((l) => {
    const note = l.note?.toLowerCase() ?? "";
    return note === "homepage" || note === "website";
  });
  return nonEmpty((preferred ?? links[0])?.url);
}

/** Pick the first office phone number Open States lists. */
function pickPhone(person: OpenStatesPerson): string | undefined {
  const office = person.offices?.find((o) => Boolean(o.voice));
  return nonEmpty(office?.voice);
}

/**
 * Turn the candidate's links into social-channel records. We surface every
 * link except the one already used as the website so the UI can show socials.
 */
function buildChannels(
  person: OpenStatesPerson,
  website: string | undefined,
): CandidateChannel[] | undefined {
  const links = person.links;
  if (!links || links.length === 0) return undefined;
  const channels: CandidateChannel[] = [];
  for (const link of links) {
    if (!link.url || link.url === website) continue;
    channels.push({ type: "social", id: link.url });
  }
  return channels.length > 0 ? channels : undefined;
}

/**
 * Enrich one candidate from Open States.
 *
 * @param candidateName Candidate name from Google Civic.
 * @param ctx           Contest + enrichment context (office, district, roles,
 *                      level, stateAbbrev).
 * @returns Source data when a current state legislator matches by name AND
 *          district, otherwise null.
 */
export async function enrichCandidateFromOpenStates(
  candidateName: string,
  ctx: CandidateEnrichmentContext,
): Promise<CandidateSourceData | null> {
  // Scope gate: state-level legislators only.
  const isStateLevel = ctx.level?.includes("administrativeArea1") ?? false;
  const orgClassification = orgClassificationFromRoles(ctx.roles);
  if (!isStateLevel || !orgClassification) return null;

  const district = extractDistrict(ctx.district);

  try {
    const result = await getLegislators({
      stateCode: ctx.stateAbbrev,
      district: district ?? undefined,
      name: candidateName,
      orgClassification,
    });

    const people = result.results;
    if (people.length === 0) return null;

    // Require BOTH a current_role (active incumbent) AND a name match. When a
    // numeric district was provided, Open States already filtered to it; the
    // name check defends against multi-member or fuzzy district queries.
    let best: { person: OpenStatesPerson; score: number } | null = null;
    for (const person of people) {
      if (!person.current_role) continue;
      const score = candidateNameSimilarity(candidateName, person.name);
      if (score < NAME_MATCH_THRESHOLD) continue;
      if (!best || score > best.score) best = { person, score };
    }
    if (!best) return null;

    const person = best.person;
    const sourceUrl = `https://openstates.org/person/${person.id}/`;
    const website = pickWebsite(person);
    const phone = pickPhone(person);
    const channels = buildChannels(person, website);

    return {
      tier: "vote_smart",
      sourceName: SOURCE_NAME,
      sourceUrl,
      official: false,
      matchedName: person.name,
      // A present current_role means they currently hold the seat.
      incumbent: true,
      photoUrl: nonEmpty(person.image),
      email: nonEmpty(person.email),
      phone,
      website,
      channels,
    };
  } catch {
    // getLegislators throws when OPEN_STATES_API_KEY is unset, and on any
    // network/API error. Degrade gracefully — candidates render without Open
    // States data rather than breaking enrichment.
    return null;
  }
}
