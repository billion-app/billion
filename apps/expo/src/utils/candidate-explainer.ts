export const ELECTION_DATE = "2026-11-03";
const CA_STATEWIDE_DISTRICT = "ocd-division/country:us/state:ca";

export function canMatchCaliforniaGuide(
  state: string | undefined,
  electionDate: string | undefined,
  districtId: string | undefined,
): boolean {
  return (
    state === "CA" &&
    electionDate === ELECTION_DATE &&
    districtId === CA_STATEWIDE_DISTRICT
  );
}

const officeNames = {
  governor: "Governor",
  "lt-governor": "Lieutenant Governor",
  sos: "Secretary of State",
  controller: "Controller",
  treasurer: "Treasurer",
  "attorney-general": "Attorney General",
  "insurance-commissioner": "Insurance Commissioner",
  superintendent: "Superintendent of Public Instruction",
} as const;

export type OfficeSlug = keyof typeof officeNames;

export function isOfficeSlug(value: string): value is OfficeSlug {
  return Object.prototype.hasOwnProperty.call(officeNames, value);
}

export function statewideOfficeSlug(value: string): OfficeSlug | undefined {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^california /, "")
    .replace(/ of california$/, "");
  return (Object.keys(officeNames) as OfficeSlug[]).find(
    (slug) =>
      slug === normalized || officeNames[slug].toLowerCase() === normalized,
  );
}

export function candidateKey(name: string, office: string): string {
  return `${office}:${name.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ")}`;
}

export function guideCandidateRoute(name: string, office: OfficeSlug) {
  return { pathname: "/candidate-detail" as const, params: { name, office } };
}

export function findGuideCandidate<
  T extends { name: string; officeSlug: string },
>(candidates: readonly T[], name: string, office: string): T | undefined {
  const matches = candidates.filter(
    (candidate) =>
      candidateKey(candidate.name, candidate.officeSlug) ===
      candidateKey(name, office),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export interface BallotCandidateDetail {
  name: string;
  party?: string;
  statement?: string;
  biography?: string;
  photoUrl?: string;
  ballotStatus?: "onBallot" | "withdrewStillOnBallot";
  citations?: {
    field: string;
    sourceName: string;
    sourceUrl?: string;
    fetchedAt?: string;
  }[];
}

/** Route parameters are user-controlled; retain only known fields and safe sizes. */
export function parseBallotCandidate(
  value: string | undefined,
  expectedName: string | undefined,
): BallotCandidateDetail | undefined {
  if (!value || value.length > 80_000 || !expectedName) return undefined;
  try {
    const raw: unknown = JSON.parse(value);
    if (!raw || typeof raw !== "object") return undefined;
    const candidate = raw as Record<string, unknown>;
    if (
      typeof candidate.name !== "string" ||
      candidate.name.length > 200 ||
      candidate.name !== expectedName
    )
      return undefined;
    const optionalText = (key: string, limit: number) => {
      const value = candidate[key];
      return typeof value === "string" &&
        value.length > 0 &&
        value.length <= limit
        ? value
        : undefined;
    };
    const citations = Array.isArray(candidate.citations)
      ? candidate.citations.slice(0, 30).flatMap((value: unknown) => {
          if (!value || typeof value !== "object") return [];
          const citation = value as Record<string, unknown>;
          if (
            typeof citation.field !== "string" ||
            typeof citation.sourceName !== "string" ||
            citation.field.length > 100 ||
            citation.sourceName.length > 200
          )
            return [];
          return [
            {
              field: citation.field,
              sourceName: citation.sourceName,
              sourceUrl:
                typeof citation.sourceUrl === "string" &&
                citation.sourceUrl.length <= 2000
                  ? citation.sourceUrl
                  : undefined,
              fetchedAt:
                typeof citation.fetchedAt === "string" &&
                !Number.isNaN(Date.parse(citation.fetchedAt))
                  ? citation.fetchedAt
                  : undefined,
            },
          ];
        })
      : undefined;
    return {
      name: candidate.name,
      party: optionalText("party", 100),
      statement: optionalText("statement", 30_000),
      biography: optionalText("biography", 30_000),
      photoUrl: optionalText("photoUrl", 2_000),
      ballotStatus:
        candidate.ballotStatus === "onBallot" ||
        candidate.ballotStatus === "withdrewStillOnBallot"
          ? candidate.ballotStatus
          : undefined,
      citations,
    };
  } catch {
    return undefined;
  }
}
