/**
 * Cross-validation engine for candidates.
 *
 * Collects candidate data from every available source (Open States, Vote Smart,
 * Ballotpedia, Wikipedia), then merges them field-by-field by trust priority
 * into a single canonical record with full source attribution. This mirrors the
 * ballot-measure engine (see ./measure-crossvalidate.ts): sources are fetched
 * concurrently, each failure swallowed; sources are sorted by tier; the
 * highest-tier source holding a field wins and is cited.
 *
 * Guiding principle (shared with measures): higher-trust sources win and every
 * surfaced field carries a citation. Biographies are source-supplied only
 * (Ballotpedia / Wikipedia / Vote Smart) — there is no AI authoring of candidate
 * bios, so nothing here is ever a guess from a bare name.
 */

import type {
  CandidateChannel,
  CandidateCrossValidateContext,
  CandidateInput,
  CandidateSourceData,
  CanonicalCandidate,
  MeasureCitation,
} from "./candidate-sources/types";
import { enrichCandidateFromBallotpedia } from "./candidate-sources/ballotpedia";
import { enrichCandidateFromOpenStates } from "./candidate-sources/open-states";
import { byTierDesc, candidateCite } from "./candidate-sources/types";
import { enrichCandidateFromVoteSmart } from "./candidate-sources/votesmart";
import { enrichCandidateFromWikipedia } from "./candidate-sources/wikipedia";

/**
 * Collect from all candidate sources and merge into a canonical, source-
 * attributed candidate record. Sources are fetched concurrently; any that fail
 * (or whose API key is unset) are skipped. Only fields that were actually
 * surfaced get a citation.
 */
export async function crossValidateCandidate(
  input: CandidateInput,
  ctx: CandidateCrossValidateContext,
): Promise<CanonicalCandidate> {
  const [openStates, voteSmart, ballotpedia, wikipedia] = await Promise.all([
    enrichCandidateFromOpenStates(input.name, {
      office: input.office,
      district: input.district,
      roles: input.roles,
      level: input.level,
      stateAbbrev: ctx.stateAbbrev,
    }).catch(() => null),
    enrichCandidateFromVoteSmart(input.name, {
      office: input.office,
      stateAbbrev: ctx.stateAbbrev,
      electionYear: ctx.electionYear,
    }).catch(() => null),
    enrichCandidateFromBallotpedia(input.name, {
      office: input.office,
      county: ctx.county,
      stateAbbrev: ctx.stateAbbrev,
      electionYear: ctx.electionYear,
    }).catch(() => null),
    enrichCandidateFromWikipedia(input.name, {
      office: input.office,
      stateAbbrev: ctx.stateAbbrev,
      electionYear: ctx.electionYear,
    }).catch(() => null),
  ]);

  const sources: CandidateSourceData[] = [
    openStates,
    voteSmart,
    ballotpedia,
    wikipedia,
  ].filter((s): s is CandidateSourceData => s !== null);
  // Highest trust tier first; the first source holding a field wins it.
  sources.sort(byTierDesc);

  const citations: MeasureCitation[] = [];

  // --- incumbent: Open States (current_role) > Vote Smart > Google Civic. ---
  // Tier ordering already encodes this; take the highest-tier source that makes
  // a positive incumbency claim.
  let incumbent: boolean | undefined;
  for (const src of sources) {
    if (src.incumbent) {
      incumbent = true;
      citations.push(candidateCite("incumbent", src));
      break;
    }
  }

  // --- photoUrl: highest-tier source with one. ---
  let photoUrl: string | undefined;
  for (const src of sources) {
    if (src.photoUrl) {
      photoUrl = src.photoUrl;
      citations.push(candidateCite("photoUrl", src));
      break;
    }
  }

  // --- biography: highest-tier source with real prose (Ballotpedia >
  //     Wikipedia > Vote Smart). Source-supplied only; no AI authoring. ---
  let biography: string | undefined;
  for (const src of sources) {
    if (src.biography?.trim()) {
      biography = src.biography.trim();
      citations.push(candidateCite("biography", src));
      break;
    }
  }

  // --- contact fields: highest-tier source per field. ---
  // candidateUrl comes from a source `website`; phone / email likewise. Each is
  // picked independently so we can mix (e.g. Open States phone + Vote Smart web).
  let candidateUrl: string | undefined;
  for (const src of sources) {
    if (src.website) {
      candidateUrl = src.website;
      citations.push(candidateCite("candidateUrl", src));
      break;
    }
  }

  let email: string | undefined;
  for (const src of sources) {
    if (src.email) {
      email = src.email;
      citations.push(candidateCite("email", src));
      break;
    }
  }

  let phone: string | undefined;
  for (const src of sources) {
    if (src.phone) {
      phone = src.phone;
      citations.push(candidateCite("phone", src));
      break;
    }
  }

  // --- channels: highest-tier source with any (Open States socials). ---
  let channels: CandidateChannel[] | undefined;
  for (const src of sources) {
    if (src.channels?.length) {
      channels = src.channels;
      citations.push(candidateCite("channels", src));
      break;
    }
  }

  // No AI biography fallback: every source that fetches prose already yields a
  // real, attributed `biography`, so a "no source bio but we have grounding
  // text" case cannot occur. We surface only source-supplied bios (each cited),
  // and show the sparse UI fallback when no source had one — never a guess.

  return {
    name: input.name,
    party: input.party,
    biography,
    photoUrl,
    candidateUrl,
    email,
    phone,
    incumbent,
    channels,
    citations,
  };
}
