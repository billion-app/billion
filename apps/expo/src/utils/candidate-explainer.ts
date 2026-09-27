/** Editorially checked, source-bound facts for the California guide. */
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

export const officeContext = {
  governor: {
    name: "Governor",
    description:
      "Leads most state agencies, proposes a budget, signs or vetoes bills, and directs the state response to emergencies.",
  },
  "lt-governor": {
    name: "Lieutenant Governor",
    description:
      "Takes over when the governor cannot serve, presides over the State Senate, and serves on state lands and higher education boards.",
  },
  sos: {
    name: "Secretary of State",
    description:
      "Oversees statewide elections, makes campaign finance records public, and maintains business filings and state archives.",
  },
  controller: {
    name: "Controller",
    description:
      "Tracks the state's money, audits public spending, and issues payments from the state treasury.",
  },
  treasurer: {
    name: "Treasurer",
    description:
      "Manages state investments and borrowing and helps finance public projects.",
  },
  "attorney-general": {
    name: "Attorney General",
    description:
      "Leads the state Department of Justice, represents California in court, and enforces state laws.",
  },
  "insurance-commissioner": {
    name: "Insurance Commissioner",
    description:
      "Regulates insurers in California, reviews rates, and enforces insurance laws.",
  },
  superintendent: {
    name: "Superintendent of Public Instruction",
    description:
      "Serves as California's elected voice for public education and sits on state education boards.",
  },
} as const;

export type OfficeSlug = keyof typeof officeContext;

export function isOfficeSlug(value: string): value is OfficeSlug {
  return Object.prototype.hasOwnProperty.call(officeContext, value);
}

export function statewideOfficeSlug(value: string): OfficeSlug | undefined {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^california /, "")
    .replace(/ of california$/, "");
  return (Object.keys(officeContext) as OfficeSlug[]).find(
    (slug) =>
      slug === normalized ||
      officeContext[slug].name.toLowerCase() === normalized,
  );
}

export function candidateKey(name: string, office: string): string {
  return `${office}:${name.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ")}`;
}

export function guideCandidateRoute(name: string, office: OfficeSlug) {
  return { pathname: "/candidate-detail" as const, params: { name, office } };
}

export interface RecordFact {
  text: string;
  says: string;
  sourceName: string;
  sourceUrl: string;
  checkedAt: string;
}

/** Exact identity and election gates keep these facts off namesakes and future cycles. */
const checkedRecords: Record<string, RecordFact> = {
  [candidateKey("Shirley N. Weber", "sos")]: {
    text: "Weber has served as California Secretary of State since January 2021.",
    says: "Weber says she would keep protecting access to voting and make sure eligible Californians can register and vote.",
    sourceName: "California Secretary of State, About Us",
    sourceUrl: "https://www.sos.ca.gov/administration",
    checkedAt: "2026-09-27",
  },
  [candidateKey("Donald P. (Don) Wagner", "sos")]: {
    text: "Wagner currently serves as Orange County's Third District supervisor. This is a different office from California Secretary of State.",
    says: "Wagner says he would focus on election trust and faster vote counting.",
    sourceName: "Orange County, Elected Officials",
    sourceUrl: "https://www.ocgov.com/about-county/info-oc/elected-officials",
    checkedAt: "2026-09-27",
  },
};

export function checkedCandidateRecord(
  name: string,
  office: string,
  electionDate: string,
): RecordFact | undefined {
  if (electionDate !== ELECTION_DATE) return undefined;
  return checkedRecords[candidateKey(name, office)];
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
    const optionalText = (key: string, limit: number) =>
      typeof candidate[key] === "string" &&
      (candidate[key] as string).length <= limit
        ? (candidate[key] as string)
        : undefined;
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
