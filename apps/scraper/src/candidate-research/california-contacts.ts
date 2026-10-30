import { createHash } from "node:crypto";
import { isIP } from "node:net";

import type {
  CaliforniaRaceTarget,
  CaliforniaRosterSnapshot,
  CandidateBriefIdentity,
  ResearchSource,
} from "@acme/validators";

interface FilingRecord {
  contestId: string;
  ordinal: string;
  name: string;
  onBallot: boolean;
  header: string;
  block: string;
  start: number;
  end: number;
}
export interface OfficialCampaignWebsite {
  status:
    | "listed"
    | "missing"
    | "withheld"
    | "unsupported"
    | "identity_unresolved";
  url?: string;
  listedValue?: string;
  requestedCandidateIdentity: CandidateBriefIdentity;
  provenance: "archived_official_candidate_filing";
  officialSource?: {
    url: string;
    contentHash: string;
    fetchedAt: string;
    locator: string;
    excerpt: string;
    recordDigest: string;
    officialRecordName: string;
  };
}
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const sameIdentity = (a: CandidateBriefIdentity, b: CandidateBriefIdentity) =>
  a.candidateId === b.candidateId &&
  a.contestId === b.contestId &&
  a.electionDate === b.electionDate &&
  a.jurisdiction === b.jurisdiction;
const qualifiedPath = /\/qualified-list-of-local-candidates-[^/]+\.pdf$/;
const writeInPath = /\/writeincandidates_[^/]+\.pdf$/;

function archivedSource(
  sources: ResearchSource[],
  path: RegExp,
): ResearchSource | undefined {
  const matches = sources.filter((source) => {
    const url = new URL(source.url);
    return (
      url.protocol === "https:" &&
      url.hostname === "files.santaclaracounty.gov" &&
      path.test(url.pathname)
    );
  });
  if (matches.length !== 1) return undefined;
  const source = matches[0]!;
  if (hash(source.text) !== source.contentHash)
    throw new Error("Official contact archive hash mismatch");
  if (!/General Election\s*-\s*11\/3\/2026/.test(source.text))
    throw new Error("Official contact archive election mismatch");
  return source;
}

function parseCaliforniaOfficialContactRecords(text: string): FilingRecord[] {
  const contests = [
    ...text.matchAll(
      /^(\d{4}) (.+?) On Ballot: (Yes|No) Vote For: (\d+)\s*$/gm,
    ),
  ];
  const result: FilingRecord[] = [];
  const seen = new Set<string>();
  for (const [index, contest] of contests.entries()) {
    const end = contests[index + 1]?.index ?? text.length;
    const start = contest.index + contest[0].length;
    const candidates = [
      ...text
        .slice(start, end)
        .matchAll(
          /^Qualified (\d+) (.+?) Candidate Stmt Filed\? (?:Yes|No)[^\n]*$/gm,
        ),
    ];
    for (const [candidateIndex, candidate] of candidates.entries()) {
      const recordStart = start + candidate.index;
      const recordEnd = candidates[candidateIndex + 1]
        ? start + candidates[candidateIndex + 1]!.index
        : end;
      const key = `${contest[1]}:${candidate[1]}`;
      if (seen.has(key))
        throw new Error("Duplicate official contact record identity");
      seen.add(key);
      result.push({
        contestId: contest[1]!,
        ordinal: candidate[1]!,
        name: candidate[2]!,
        onBallot: contest[3] === "Yes",
        header: candidate[0],
        block: text.slice(recordStart, recordEnd),
        start: recordStart,
        end: recordEnd,
      });
    }
  }
  const websites = [...text.matchAll(/^Website:/gm)].length;
  if (
    result.reduce(
      (n, record) => n + [...record.block.matchAll(/^Website:/gm)].length,
      0,
    ) !== websites
  )
    throw new Error("Official Website field is outside a candidate record");
  return result;
}

export function inspectCaliforniaOfficialContactArchive(text: string) {
  const records = parseCaliforniaOfficialContactRecords(text);
  return {
    recordCount: records.length,
    contestCount: new Set(records.map((record) => record.contestId)).size,
    websiteFieldCount: [...text.matchAll(/^Website:/gm)].length,
  };
}

function writeInRecord(
  source: ResearchSource,
  contestId: string,
  candidateId: string,
): FilingRecord | undefined {
  const text = source.text;
  const records: FilingRecord[] = [];
  const heads = [...text.matchAll(/^Candidate\(s\): (.+?) \(Write-in\)\s*$/gm)];
  for (const [index, head] of heads.entries()) {
    const stop = /^Nonpartisan /m.exec(text.slice(head.index + head[0].length));
    const end = Math.min(
      heads[index + 1]?.index ?? text.length,
      stop ? head.index + head[0].length + stop.index : text.length,
    );
    const block = text.slice(head.index, end);
    const contest = [
      ...text.slice(0, head.index).matchAll(/^\s*(\d{4}) [A-Za-z][^\n]*$/gm),
    ].at(-1);
    const id = /Cand ID:\s*\n(\d{1,2}\/\d{1,2}\/\d{4})\s*\n\s*(\d+)\s*\n/.exec(
      block,
    );
    if (contest?.[1] === contestId && id?.[2] === candidateId)
      records.push({
        contestId,
        ordinal: `write-in:${candidateId}`,
        name: head[1]!,
        onBallot: true,
        header: head[0].trimEnd(),
        block,
        start: head.index,
        end,
      });
  }
  if (records.length > 1)
    throw new Error("Ambiguous official write-in contact record");
  return records[0];
}

function websiteValue(value: string): {
  status: OfficialCampaignWebsite["status"];
  url?: string;
} {
  if (!value.trim()) return { status: "missing" };
  if (/not\s+auth|do not release/i.test(value)) return { status: "withheld" };
  const candidate = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
    ? value
    : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
      /\s/.test(candidate)
    )
      return { status: "unsupported" };
    return { status: "listed", url: candidate };
  } catch {
    return { status: "unsupported" };
  }
}

export function resolveCaliforniaOfficialCampaignWebsite(input: {
  snapshot: Pick<
    CaliforniaRosterSnapshot,
    "races" | "localPrimary" | "localCrosswalk" | "historicalSources"
  >;
  race: CaliforniaRaceTarget;
  member: CaliforniaRaceTarget["members"][number];
}): OfficialCampaignWebsite {
  const { snapshot, race, member } = input;
  const base = {
    requestedCandidateIdentity: member.identity,
    provenance: "archived_official_candidate_filing" as const,
  };
  const unavailable = { ...base, status: "identity_unresolved" as const };
  const current = snapshot.races.filter(
    (target) =>
      target.contestId === race.contestId &&
      target.jurisdiction === race.jurisdiction &&
      target.electionDate === race.electionDate,
  );
  if (
    race.officeFamily !== "local" ||
    current.length !== 1 ||
    !current[0]!.members.some((candidate) =>
      sameIdentity(candidate.identity, member.identity),
    ) ||
    snapshot.localPrimary?.kind !== "scc_clarity"
  )
    return unavailable;
  const actual = current[0]!.members.find((candidate) =>
    sameIdentity(candidate.identity, member.identity),
  )!;
  if (
    actual.name !== member.name ||
    actual.candidateId !== member.candidateId ||
    actual.sourceCandidateId !== member.sourceCandidateId ||
    actual.ballotStatus !== member.ballotStatus
  )
    return unavailable;
  const match = /^ca-scc-clarity:2026-11-03:127570:(\d+):choice:(\d+)$/.exec(
    member.candidateId,
  );
  if (
    !match ||
    member.sourceCandidateId !== match[2] ||
    member.identity.contestId !== `ca-scc-clarity:2026-11-03:127570:${match[1]}`
  )
    return unavailable;
  const aliases = snapshot.localPrimary.identityCrosswalk.members.filter(
    (alias) =>
      alias.clarityContestKey === match[1] &&
      alias.sourceContestId === race.sourceContestId &&
      alias.name === member.name &&
      alias.status === member.ballotStatus,
  );
  if (aliases.length !== 1) return unavailable;
  const alias = aliases[0]!;
  const writeIn = alias.sourceOrdinal.startsWith("write-in:");
  if (writeIn !== (member.ballotStatus === "qualified_write_in"))
    return unavailable;
  const source = archivedSource(
    snapshot.historicalSources ?? [],
    writeIn ? writeInPath : qualifiedPath,
  );
  if (!source) return unavailable;
  const reviewedSource = writeIn
    ? snapshot.localCrosswalk?.entries
        .find((entry) => entry.sourceContestId === race.sourceContestId)
        ?.proofs.some(
          (proof) =>
            proof.role === "historical_qualification" &&
            proof.url === source.url &&
            proof.contentHash === source.contentHash,
        )
    : snapshot.localCrosswalk?.rosterSourceHash === source.contentHash;
  if (!reviewedSource) return unavailable;
  const record = writeIn
    ? writeInRecord(
        source,
        race.sourceContestId,
        alias.sourceOrdinal.slice("write-in:".length),
      )
    : parseCaliforniaOfficialContactRecords(source.text).find(
        (r) =>
          r.contestId === race.sourceContestId &&
          r.ordinal === alias.sourceOrdinal &&
          r.onBallot,
      );
  if (!record) return unavailable;
  if (writeIn && record.name !== member.name) return unavailable;
  const fields = [...record.block.matchAll(/^Website:([^\n]*)$/gm)];
  if (fields.length > 1)
    throw new Error("Ambiguous Website fields in official candidate record");
  const field = fields[0];
  const listedValue = field?.[1]?.trim();
  const result = websiteValue(listedValue ?? "");
  const lineStart = source.text.slice(0, record.start).split("\n").length;
  const fieldLine = field
    ? lineStart + record.block.slice(0, field.index).split("\n").length - 1
    : lineStart;
  return {
    ...base,
    ...result,
    ...(listedValue !== undefined && result.status !== "unsupported"
      ? { listedValue }
      : {}),
    officialSource: {
      url: source.url,
      contentHash: source.contentHash,
      fetchedAt: source.fetchedAt,
      locator: `Archived official filing; county contest ${race.sourceContestId}, source ordinal ${alias.sourceOrdinal}; extracted record lines ${lineStart}-${source.text.slice(0, record.end).split("\n").length}; ${field ? `Website line ${fieldLine}` : "no Website field"}`,
      excerpt:
        result.status === "unsupported"
          ? record.header
          : (field?.[0] ?? record.header),
      recordDigest: hash(record.block),
      officialRecordName: record.name,
    },
  };
}
