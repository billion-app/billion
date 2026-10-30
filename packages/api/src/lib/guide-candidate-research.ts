import type { CandidateBriefIdentity } from "@acme/validators";

import type { PublishedCandidateRace } from "./candidate-race-release";
import { CA_GENERAL_ELECTION_DATE } from "./official-guide-cache";

export const guideResearchOfficeIds = {
  governor: "020000000000",
  "lt-governor": "030000000000",
  sos: "040000000000",
  controller: "050000000000",
  treasurer: "060000000000",
  "attorney-general": "070000000000",
  "insurance-commissioner": "080000000000",
  superintendent: "160000000000",
} as const;

interface GuideCandidate {
  name: string;
  officeSlug: string;
}
interface Guide {
  electionDate: string;
  jurisdiction: "CA";
  candidates: readonly GuideCandidate[];
}
export type GuideCandidateResearchResolution =
  | {
      status: "published";
      identity: CandidateBriefIdentity;
      releaseId: string;
      race: PublishedCandidateRace;
    }
  | {
      status: "unavailable";
      reason: "not_published" | "identity_unresolved";
    };

const sourceName = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

export function resolveGuideCandidateResearch(
  guide: Guide | null,
  publishedRaces: readonly PublishedCandidateRace[],
  input: { name: string; officeSlug: keyof typeof guideResearchOfficeIds },
): GuideCandidateResearchResolution {
  if (guide?.electionDate !== CA_GENERAL_ELECTION_DATE)
    return { status: "unavailable", reason: "identity_unresolved" };
  const candidates = guide.candidates.filter(
    (candidate) =>
      candidate.officeSlug === input.officeSlug &&
      sourceName(candidate.name) === sourceName(input.name),
  );
  const [candidate] = candidates;
  if (!candidate || candidates.length !== 1)
    return { status: "unavailable", reason: "identity_unresolved" };
  const contestId = `ca-sos:${guide.electionDate}:${guideResearchOfficeIds[input.officeSlug]}`;
  const races = publishedRaces.filter(
    ({ manifest }) =>
      manifest.contestId === contestId &&
      manifest.electionDate === guide.electionDate &&
      manifest.jurisdiction === "ocd-division/country:us/state:ca",
  );
  const [race] = races;
  if (!race || races.length !== 1)
    return { status: "unavailable", reason: "not_published" };
  const members = race.manifest.members.filter(
    (member) => sourceName(member.name) === sourceName(candidate.name),
  );
  const [member] = members;
  if (!member || members.length !== 1)
    return { status: "unavailable", reason: "identity_unresolved" };
  const identity = {
    candidateId: member.candidateId,
    contestId,
    electionDate: race.manifest.electionDate,
    jurisdiction: race.manifest.jurisdiction,
  };
  return { status: "published", identity, releaseId: race.manifest.id, race };
}
