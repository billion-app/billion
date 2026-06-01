/**
 * Vote Smart candidate adapter — biography, photo, and contact info.
 *
 * Mirrors the measure-side Vote Smart enrichment (../votesmart.ts) but for
 * candidates: resolve a Vote Smart `candidateId` by name (optionally scoped to
 * a state), then pull the biographical prose (CandidateBio), an office address
 * (Address.getOffice → phone), and a campaign web address (Address.getOfficeWebAddress
 * → website / email). The headshot is only surfaced when the bio response
 * carries an explicit photo URL — we never speculate the canphoto convention.
 *
 * Best-effort like every adapter: gate on VOTE_SMART_API_KEY, never throw,
 * return `null` when no confident match is found. Every surfaced field is
 * attributed back to the candidate's Vote Smart page so the merge engine can
 * cite it.
 *
 * Vote Smart's JSON is famously inconsistent (single-object-or-array, numeric
 * strings, empty-string-as-absent), so every response shape is read
 * defensively with Array.isArray guards and truthiness checks.
 */

import type { CandidateSourceData } from "./types";
import { fetchVoteSmart, getApiKey, stateNameToAbbrev } from "../votesmart";
import { candidateNameSimilarity } from "./types";

const SOURCE_NAME = "Vote Smart";
const TIER = "vote_smart" as const;

/** Accept a Vote Smart candidate match at or above this name-similarity score. */
const NAME_MATCH_THRESHOLD = 0.7;

// ============================================================================
// Defensive Vote Smart response shapes
// ============================================================================

interface VoteSmartCandidate {
  candidateId: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  preferredName?: string;
  nickName?: string;
  suffix?: string;
  ballotName?: string;
  electionStateId?: string;
  electionYear?: string;
}

interface VoteSmartCandidatesResponse {
  candidateList?: {
    candidate?: VoteSmartCandidate | VoteSmartCandidate[];
  };
}

interface VoteSmartBioResponse {
  bio?: {
    candidate?: {
      candidateId?: string;
      firstName?: string;
      lastName?: string;
      photo?: string;
      profession?: string | string[];
      education?: string | string[];
      political?: string | string[];
      congMembership?: string | string[];
      orgMembership?: string | string[];
      birthPlace?: string;
      homeCity?: string;
      homeState?: string;
    };
    office?: {
      name?: string | string[];
      title?: string | string[];
    };
  };
}

interface VoteSmartOffice {
  name?: string;
  phone1?: string;
  phone2?: string;
  fax1?: string;
  fax2?: string;
  city?: string;
  state?: string;
}

interface VoteSmartAddressResponse {
  address?: {
    office?: VoteSmartOffice | VoteSmartOffice[];
  };
}

interface VoteSmartWebAddress {
  webAddressTypeId?: string;
  webAddress?: string;
}

interface VoteSmartWebAddressResponse {
  webaddress?: {
    address?: VoteSmartWebAddress | VoteSmartWebAddress[];
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Normalize Vote Smart's "single-object-or-array-or-absent" into an array. */
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** First non-empty string in a single-or-array prose field. */
function firstProse(v: string | string[] | undefined): string | undefined {
  for (const s of asArray(v)) {
    const t = typeof s === "string" ? s.trim() : "";
    if (t) return t;
  }
  return undefined;
}

/** First non-empty trimmed string, treating Vote Smart's "" as absent. */
function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

/** Build a candidate's display name from Vote Smart name parts. */
function candidateName(c: VoteSmartCandidate): string {
  if (c.ballotName?.trim()) return c.ballotName.trim();
  const first = firstNonEmpty(c.preferredName, c.nickName, c.firstName);
  return [first, c.lastName?.trim(), c.suffix?.trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Last word of a name, used for the Candidates.getByLastname lookup. */
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[parts.length - 1] ?? name.trim()) : name.trim();
}

/** Two-letter state code from an abbreviation or a full state name. */
function toStateId(stateAbbrev?: string): string | null {
  if (!stateAbbrev) return null;
  return stateAbbrev.length === 2
    ? stateAbbrev.toUpperCase()
    : stateNameToAbbrev(stateAbbrev);
}

/** Assemble a short biography from Vote Smart's prose fields. */
function buildBiography(
  c: NonNullable<NonNullable<VoteSmartBioResponse["bio"]>["candidate"]>,
): string | undefined {
  const sentences: string[] = [];
  const profession = firstProse(c.profession);
  const education = firstProse(c.education);
  const political = firstProse(c.political);
  const cong = firstProse(c.congMembership);
  if (profession) sentences.push(`Profession: ${profession}`);
  if (education) sentences.push(`Education: ${education}`);
  if (political) sentences.push(`Political experience: ${political}`);
  if (cong) sentences.push(`Committee/membership: ${cong}`);
  const bio = sentences.join(". ").replace(/\s+/g, " ").trim();
  return bio ? bio : undefined;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s);
}

// ============================================================================
// Candidate resolution
// ============================================================================

/**
 * Resolve a Vote Smart candidate id by name. Tries a last-name lookup
 * (broadest coverage) and picks the best fuzzy full-name match, optionally
 * preferring the requested state and election year.
 */
async function resolveCandidate(
  name: string,
  stateId: string | null,
  electionYear?: number,
): Promise<VoteSmartCandidate | null> {
  let raw: VoteSmartCandidate | VoteSmartCandidate[] | undefined;
  try {
    const data = await fetchVoteSmart<VoteSmartCandidatesResponse>(
      "Candidates",
      "getByLastname",
      { lastName: lastName(name) },
    );
    raw = data.candidateList?.candidate;
  } catch {
    return null;
  }

  const candidates = asArray(raw).filter((c) => c.candidateId);
  if (!candidates.length) return null;

  let best: VoteSmartCandidate | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    let score = candidateNameSimilarity(name, candidateName(c));
    // Nudge toward the right state/cycle when Vote Smart gives us the hints.
    if (stateId && c.electionStateId?.toUpperCase() === stateId) score += 0.15;
    if (electionYear && c.electionYear === String(electionYear)) score += 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  // Compare the un-boosted name similarity against the threshold so the
  // state/year nudges only break ties, never manufacture a match.
  if (!best) return null;
  if (
    candidateNameSimilarity(name, candidateName(best)) < NAME_MATCH_THRESHOLD
  ) {
    return null;
  }
  return best;
}

// ============================================================================
// Field fetchers (each best-effort, never throws)
// ============================================================================

async function fetchBio(
  candidateId: string,
): Promise<{ biography?: string; photoFromBio?: string } | null> {
  try {
    const data = await fetchVoteSmart<VoteSmartBioResponse>(
      "CandidateBio",
      "getBio",
      { candidateId },
    );
    const c = data.bio?.candidate;
    if (!c) return null;
    const photo = c.photo?.trim();
    return {
      biography: buildBiography(c),
      photoFromBio: photo && isHttpUrl(photo) ? photo : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchPhone(candidateId: string): Promise<string | undefined> {
  try {
    const data = await fetchVoteSmart<VoteSmartAddressResponse>(
      "Address",
      "getOffice",
      { candidateId },
    );
    for (const office of asArray(data.address?.office)) {
      const phone = firstNonEmpty(office.phone1, office.phone2);
      if (phone) return phone;
    }
  } catch {
    /* best-effort */
  }
  return undefined;
}

async function fetchWeb(
  candidateId: string,
): Promise<{ website?: string; email?: string }> {
  try {
    const data = await fetchVoteSmart<VoteSmartWebAddressResponse>(
      "Address",
      "getOfficeWebAddress",
      { candidateId },
    );
    let website: string | undefined;
    let email: string | undefined;
    for (const entry of asArray(data.webaddress?.address)) {
      const value = entry.webAddress?.trim();
      if (!value) continue;
      if (!email && isEmail(value)) email = value;
      else if (!website && isHttpUrl(value)) website = value;
    }
    return { website, email };
  } catch {
    return {};
  }
}

// ============================================================================
// Public adapter
// ============================================================================

/**
 * Enrich a candidate from Vote Smart. Returns the fields Vote Smart can
 * supply, all attributed to the candidate's Vote Smart page, or `null` if the
 * API key is unset, no candidate matches, or no fields could be filled.
 *
 * Note: the biography returned here is Vote Smart's own (tier `vote_smart`)
 * prose, NOT an AI biography. The orchestrator owns the separate
 * `ai_generated` fallback grounded on fetched text.
 */
export async function enrichCandidateFromVoteSmart(
  name: string,
  ctx: {
    office?: string;
    stateAbbrev?: string;
    electionYear?: number;
  },
): Promise<CandidateSourceData | null> {
  if (!getApiKey()) return null;
  if (!name.trim()) return null;

  const stateId = toStateId(ctx.stateAbbrev);

  const candidate = await resolveCandidate(name, stateId, ctx.electionYear);
  if (!candidate) return null;

  const { candidateId } = candidate;
  const sourceUrl = `https://justfacts.votesmart.org/candidate/${candidateId}`;

  // Fan out the per-candidate lookups concurrently; each swallows its own
  // errors and returns undefined/null rather than rejecting.
  const [bio, phone, web] = await Promise.all([
    fetchBio(candidateId),
    fetchPhone(candidateId),
    fetchWeb(candidateId),
  ]);

  // Only surface a photo when the bio response gave us a real URL. The old
  // speculative canphoto convention (<id>.jpg) was set unconditionally and
  // cited as confirmed even when no headshot existed — a likely 404 with a
  // misleading citation — so we leave photoUrl undefined otherwise.
  const photoUrl = bio?.photoFromBio;

  const data: CandidateSourceData = {
    tier: TIER,
    sourceName: SOURCE_NAME,
    sourceUrl,
    official: false,
    matchedName: candidateName(candidate) || undefined,
    biography: bio?.biography,
    photoUrl,
    website: web.website,
    email: web.email,
    phone,
  };

  // Only surface the source if it actually contributed a real field. Without a
  // confirmed photo, a bare match with no bio/website/email/phone is nothing.
  const contributed = Boolean(
    data.biography ?? data.website ?? data.email ?? data.phone ?? data.photoUrl,
  );
  if (!contributed) return null;

  return data;
}
