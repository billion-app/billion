import type {
  CaliforniaOfficeFamily,
  CaliforniaRosterSnapshot,
  CandidateBriefIdentity,
  CandidateRaceManifest,
} from "@acme/validators";

export interface CatalogPublishedRace {
  manifest: Pick<
    CandidateRaceManifest,
    "id" | "contestId" | "jurisdiction" | "electionDate" | "members"
  >;
}

export class CatalogCursorError extends Error {}

export interface CaliforniaCatalogInput {
  electionDate: string;
  query?: string;
  officeFamily?: CaliforniaOfficeFamily;
  cursor?: string;
  limit?: number;
}
export interface CaliforniaCatalogItem {
  identity: CandidateBriefIdentity;
  name: string;
  office: string;
  jurisdictionLabel: string;
  officeFamily: CaliforniaOfficeFamily;
  party?: string;
  status: "published" | "unavailable";
  ballotStatus: "on_ballot" | "withdrawn_on_ballot" | "qualified_write_in";
  releaseId?: string;
}
const familyLabels: Record<CaliforniaOfficeFamily, string> = {
  statewide: "Statewide offices",
  local: "Local offices",
  board_of_equalization: "Board of Equalization",
  us_house: "U.S. House",
  state_senate: "State Senate",
  state_assembly: "State Assembly",
  judicial_retention: "Judicial retention",
};
const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("en-US").trim();
const key = (item: CaliforniaCatalogItem) =>
  `${normalize(item.name)}\u0000${item.identity.contestId}\u0000${item.identity.candidateId}`;
function cursorValue(
  snapshotId: string,
  item: CaliforniaCatalogItem,
  input: CaliforniaCatalogInput,
) {
  return Buffer.from(
    JSON.stringify({
      snapshotId,
      key: key(item),
      query: normalize(input.query ?? ""),
      officeFamily: input.officeFamily ?? null,
    }),
  ).toString("base64url");
}
export function candidateInPublishedRace<T extends CatalogPublishedRace>(
  identity: CandidateBriefIdentity,
  races: readonly T[],
) {
  return races.find(
    ({ manifest }) =>
      manifest.contestId === identity.contestId &&
      manifest.jurisdiction === identity.jurisdiction &&
      manifest.electionDate === identity.electionDate &&
      manifest.members.some(
        (member) => member.candidateId === identity.candidateId,
      ),
  );
}
export function rosterPublishedRaces<T extends CatalogPublishedRace>(
  snapshot: CaliforniaRosterSnapshot,
  races: readonly T[],
) {
  return races.filter(({ manifest }) => {
    const target = snapshot.races.find(
      (target) =>
        target.contestId === manifest.contestId &&
        target.jurisdiction === manifest.jurisdiction &&
        target.electionDate === manifest.electionDate,
    );
    return (
      target?.members.length === manifest.members.length &&
      target.members.every((member) =>
        manifest.members.some(
          (published) => published.candidateId === member.candidateId,
        ),
      )
    );
  });
}
export function resolveRosterCandidate(
  snapshot: CaliforniaRosterSnapshot | null,
  input: {
    electionDate: string;
    name: string;
    office: string;
    jurisdiction: string;
    district?: string;
  },
) {
  if (snapshot?.electionDate !== input.electionDate) return null;
  const targets = snapshot.races.filter(
    (race) =>
      race.jurisdiction === input.jurisdiction &&
      normalize(race.office) === normalize(input.office) &&
      (input.district === undefined || race.district === input.district),
  );
  const members = targets.flatMap((race) =>
    race.members.filter(
      (member) => normalize(member.name) === normalize(input.name),
    ),
  );
  return members.length === 1 ? (members[0]?.identity ?? null) : null;
}
export function californiaCandidateCatalog(
  snapshot: CaliforniaRosterSnapshot | null,
  races: readonly CatalogPublishedRace[],
  input: CaliforniaCatalogInput,
) {
  const currentRaces = snapshot ? rosterPublishedRaces(snapshot, races) : [];
  const items: CaliforniaCatalogItem[] =
    snapshot?.races.flatMap((race) =>
      race.members.map((member) => {
        const published = candidateInPublishedRace(
          member.identity,
          currentRaces,
        );
        return {
          identity: member.identity,
          name: member.name,
          office: race.office,
          jurisdictionLabel: race.jurisdictionLabel,
          officeFamily: race.officeFamily,
          ballotStatus: member.ballotStatus,
          ...(member.party ? { party: member.party } : {}),
          status: published ? ("published" as const) : ("unavailable" as const),
          ...(published ? { releaseId: published.manifest.id } : {}),
        };
      }),
    ) ?? [];
  const query = normalize(input.query ?? "");
  const queried = items.filter(
    (item) =>
      !query ||
      normalize(
        `${item.name} ${item.office} ${item.jurisdictionLabel}`,
      ).includes(query),
  );
  const families = (Object.keys(familyLabels) as CaliforniaOfficeFamily[])
    .sort()
    .map((value) => ({
      value,
      label: familyLabels[value],
      count: queried.filter((item) => item.officeFamily === value).length,
    }));
  let after: string | null = null;
  if (input.cursor) {
    try {
      const decoded: unknown = JSON.parse(
        Buffer.from(input.cursor, "base64url").toString(),
      );
      if (
        typeof decoded !== "object" ||
        !decoded ||
        !("snapshotId" in decoded) ||
        decoded.snapshotId !== snapshot?.id ||
        !("key" in decoded) ||
        typeof decoded.key !== "string" ||
        !("query" in decoded) ||
        decoded.query !== query ||
        !("officeFamily" in decoded) ||
        decoded.officeFamily !== (input.officeFamily ?? null)
      )
        throw new Error();
      after = decoded.key;
    } catch {
      throw new CatalogCursorError(
        "Catalog cursor is invalid or belongs to a previous roster snapshot",
      );
    }
  }
  const filtered = queried
    .filter(
      (item) => !input.officeFamily || item.officeFamily === input.officeFamily,
    )
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const matching = filtered.filter((item) => !after || key(item) > after);
  const page = matching.slice(0, input.limit ?? 20);
  const last = page.at(-1);
  return {
    snapshotId: snapshot?.id ?? null,
    scopeLabel:
      snapshot?.scopeLabel ??
      "California state-certified roster has not been collected. County and city coverage is incomplete.",
    coverage: {
      sourceUrl: snapshot?.source.url ?? null,
      sourceName: "California Secretary of State certified candidate roster",
      fetchedAt: snapshot?.source.fetchedAt ?? null,
      electionDate: input.electionDate,
      localCoverage: snapshot?.localCoverage ?? null,
      expectedCandidates: items.length,
      expectedRaces: snapshot?.races.length ?? 0,
      publishedCandidates: items.filter((item) => item.status === "published")
        .length,
      countyCoverage: {
        verified: 0,
        total: 58 as const,
        status: snapshot ? ("incomplete" as const) : ("unverified" as const),
      },
    },
    families,
    items: page,
    totalMatches: filtered.length,
    nextCursor:
      snapshot && matching.length > page.length && last
        ? cursorValue(snapshot.id, last, input)
        : null,
  };
}

export function rosterCandidateMetadata(
  snapshot: CaliforniaRosterSnapshot | null,
  identity: CandidateBriefIdentity,
) {
  const target = snapshot?.races.find(
    (target) =>
      target.contestId === identity.contestId &&
      target.jurisdiction === identity.jurisdiction &&
      target.electionDate === identity.electionDate,
  );
  const member = target?.members.find(
    (member) => member.candidateId === identity.candidateId,
  );
  if (!snapshot || !target || !member) return null;
  return {
    identity: member.identity,
    name: member.name,
    office: target.office,
    jurisdictionLabel: target.jurisdictionLabel,
    officeFamily: target.officeFamily,
    ballotStatus: member.ballotStatus,
    ...(member.party ? { party: member.party } : {}),
    rosterSourceUrl:
      member.sourceProof?.url ?? target.rosterSourceUrl ?? snapshot.source.url,
  };
}
