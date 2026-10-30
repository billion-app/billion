import type { CandidateBriefIdentity } from "@acme/validators";
import { candidateBriefIdentitySchema } from "@acme/validators";

export function parseResearchIdentity(value: string | undefined) {
  if (!value || value.length > 18000) return undefined;
  try {
    const parsed = candidateBriefIdentitySchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function sameResearchIdentity(
  a: CandidateBriefIdentity,
  b: CandidateBriefIdentity,
) {
  return (
    a.candidateId === b.candidateId &&
    a.contestId === b.contestId &&
    a.jurisdiction === b.jurisdiction &&
    a.electionDate === b.electionDate
  );
}

export function researchCandidateRoute(candidate: {
  identity: CandidateBriefIdentity;
  name: string;
}) {
  return {
    pathname: "/candidate-detail" as const,
    params: {
      researchIdentity: JSON.stringify(candidate.identity),
      name: candidate.name,
    },
  };
}

export function currentResearch(
  expiresAt: string,
  now: number,
  updatedAt: number,
) {
  return Date.parse(expiresAt) > Math.max(now, updatedAt);
}
