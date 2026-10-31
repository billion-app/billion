import { z } from "zod/v4";

export interface FecIdentityQuery {
  name: string;
  district: string;
  cycle: number;
  sourceCandidateId?: string;
}
export interface FecIndexCandidate {
  candidate_id: string;
  name: string;
  office: string;
  state: string;
  district: string | number;
  cycles: number[];
  election_years: number[];
  principal_committee_id?: string;
}
export interface FecIdentity {
  candidateId: string;
  name: string;
  office: "H";
  state: "CA";
  district: string;
  cycle: number;
}
function canonicalName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleUpperCase("en-US")
    .replace(/[.'’"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function fecName(value: string) {
  const pieces = value.split(",");
  if (pieces.length !== 2) return canonicalName(value);
  const [family = "", personal = ""] = pieces;
  const surname = canonicalName(family);
  const given = canonicalName(personal).replace(/ (?:MR|MRS|MS|MISS|DR)$/, "");
  return `${given} ${surname}`;
}
export function resolveFecCandidate<T extends FecIndexCandidate>(
  candidates: readonly T[],
  query: FecIdentityQuery,
): T | null {
  const matches = candidates.filter(
    (candidate) =>
      /^H[A-Z0-9]{8}$/.test(candidate.candidate_id) &&
      candidate.office === "H" &&
      candidate.state === "CA" &&
      Number(candidate.district) === Number(query.district) &&
      candidate.cycles.includes(query.cycle) &&
      candidate.election_years.includes(query.cycle) &&
      fecName(candidate.name) === canonicalName(query.name),
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
export function fecCandidateMasterUrl(cycle: number): string {
  if (
    !Number.isInteger(cycle) ||
    cycle < 2000 ||
    cycle > 2098 ||
    cycle % 2 !== 0
  )
    throw new Error("Unsupported FEC candidate master cycle");
  return `https://www.fec.gov/files/bulk-downloads/${cycle}/cn${String(cycle).slice(-2)}.zip`;
}
export function isOfficialFecCandidateMasterUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const match = /^\/files\/bulk-downloads\/(20\d{2})\/cn(\d{2})\.zip$/.exec(
      url.pathname,
    );
    return !!match && value === fecCandidateMasterUrl(Number(match[1]));
  } catch {
    return false;
  }
}
function validQuery(query: FecIdentityQuery) {
  return (
    /^\d{1,2}$/.test(query.district) &&
    Number(query.district) >= 1 &&
    Number(query.district) <= 52 &&
    canonicalName(query.name).length > 0 &&
    Number.isInteger(query.cycle) &&
    query.cycle >= 2000 &&
    query.cycle <= 2098 &&
    query.cycle % 2 === 0
  );
}
function apiRows(text: string): FecIndexCandidate[] {
  const parsed: unknown = JSON.parse(text);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("results" in parsed) ||
    !Array.isArray(parsed.results) ||
    parsed.results.length > 100
  )
    throw new Error("Invalid FEC candidate index page");
  const rows: FecIndexCandidate[] = [];
  const ids = new Set<string>();
  const values: unknown[] = parsed.results;
  for (const value of values) {
    if (!value || typeof value !== "object")
      throw new Error("Invalid FEC candidate index row");
    const row = value as Record<string, unknown>;
    if (
      typeof row.candidate_id !== "string" ||
      !/^H[A-Z0-9]{8}$/.test(row.candidate_id) ||
      ids.has(row.candidate_id) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      typeof row.office !== "string" ||
      typeof row.state !== "string" ||
      !(typeof row.district === "string" || typeof row.district === "number") ||
      !Array.isArray(row.cycles) ||
      !row.cycles.every(
        (cycle: unknown) =>
          typeof cycle === "number" && Number.isInteger(cycle),
      ) ||
      !Array.isArray(row.election_years) ||
      !row.election_years.every(
        (cycle: unknown) =>
          typeof cycle === "number" && Number.isInteger(cycle),
      )
    )
      throw new Error("Invalid or duplicate FEC candidate index row");
    ids.add(row.candidate_id);
    rows.push({
      candidate_id: row.candidate_id,
      name: row.name,
      office: row.office,
      state: row.state,
      district: row.district,
      cycles: row.cycles as number[],
      election_years: row.election_years as number[],
    });
  }
  return rows;
}
function masterRows(text: string, cycle: number): FecIndexCandidate[] {
  if (!text || text.length > 1_250_000)
    throw new Error("Invalid FEC candidate master size");
  const lines = text.split(/\r?\n/);
  while (lines.at(-1) === "") lines.pop();
  if (lines.length === 0 || lines.length > 20_000)
    throw new Error("Invalid FEC candidate master rows");
  const ids = new Set<string>();
  const rows: FecIndexCandidate[] = [];
  for (const line of lines) {
    const fields = line.split("|");
    const [id, name, , year, state, office, district] = fields;
    if (
      line.length > 4096 ||
      fields.length !== 15 ||
      !id ||
      !/^[HSP][A-Z0-9]{8}$/.test(id) ||
      ids.has(id) ||
      name === undefined ||
      !year ||
      !/^\d{4}$/.test(year) ||
      !state ||
      !office ||
      !/^[HSP]$/.test(office) ||
      district === undefined ||
      (district !== "" && !/^\d{2}$/.test(district))
    )
      throw new Error("Invalid or duplicate FEC candidate master row");
    ids.add(id);
    rows.push({
      candidate_id: id,
      name,
      office,
      state,
      district,
      cycles: [cycle],
      election_years: [Number(year)],
      principal_committee_id: fields[9],
    });
  }
  return rows;
}
export function resolveFecIdentityFromSource(
  source: { url: string; format: string; text: string },
  query: FecIdentityQuery,
  bridge?: FecIdentityBridge,
  sources: readonly FecIdentitySource[] = [],
): FecIdentity | null {
  if (!validQuery(query)) return null;
  const url = new URL(source.url);
  let rows: FecIndexCandidate[];
  if (
    source.format === "text" &&
    source.url === fecCandidateMasterUrl(query.cycle)
  )
    rows = masterRows(source.text, query.cycle);
  else if (
    source.format === "json" &&
    url.protocol === "https:" &&
    url.hostname === "api.open.fec.gov" &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.hash &&
    /^\/v1\/candidates\/(?:search\/)?$/.test(url.pathname)
  )
    rows = apiRows(source.text);
  else throw new Error("Unsupported official FEC candidate index source");
  const bridgedQuery = bridge
    ? bridgeQuery(rows, query, bridge, sources)
    : query;
  if (!bridgedQuery) return null;
  const matched = resolveFecCandidate(rows, bridgedQuery);
  return matched
    ? {
        candidateId: matched.candidate_id,
        name: matched.name,
        office: "H",
        state: "CA",
        district: query.district,
        cycle: query.cycle,
      }
    : null;
}

const sourceDigest = z.string().regex(/^[a-f0-9]{64}$/);
export const fecIdentityBridgeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("sos_legal_name_v1"),
    sourceId: z.string().min(1),
    sourceHash: sourceDigest,
    sourceCandidateId: z.string().regex(/^\d+$/),
  }),
  z.object({
    kind: z.literal("official_domain_v1"),
    rosterSourceId: z.string().min(1),
    rosterSourceHash: sourceDigest,
    filingSourceId: z.string().min(1),
    filingSourceHash: sourceDigest,
    committeeId: z.string().regex(/^C\d{8}$/),
    domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
  }),
]);
export type FecIdentityBridge = z.infer<typeof fecIdentityBridgeSchema>;
export interface FecIdentitySource {
  id: string;
  contentHash: string;
  url: string;
  format: string;
  text: string;
}
const sanMateoRoster =
  "https://smcacre.gov/system/files/2026-03/51_candidateroster03272026.pdf";
function archivedSource(
  sources: readonly FecIdentitySource[],
  id: string,
  hash: string,
) {
  const matches = sources.filter(
    (source) => source.id === id && source.contentHash === hash,
  );
  return matches.length === 1 ? matches[0] : undefined;
}
function legalRosterName(source: FecIdentitySource, query: FecIdentityQuery) {
  if (
    source.url !== "https://media.sos.ca.gov/media/C26GG.txt" ||
    source.format !== "text" ||
    query.cycle !== 2026 ||
    !query.sourceCandidateId
  )
    return null;
  const rows = source.text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) =>
      /^\[[^[\]]+\]$/.test(line) ? line.slice(1, -1).split("|") : [],
    );
  const matches = rows.filter(
    (row) =>
      row.length === 12 &&
      row[0] === "C" &&
      row[1] === "CAS" &&
      row[4] === query.sourceCandidateId,
  );
  if (matches.length !== 1) return null;
  const row = matches[0];
  if (!row) return null;
  if (
    row[3] !== `110000${query.district.padStart(2, "0")}0000` ||
    canonicalName(row[10] ?? "") !== canonicalName(query.name) ||
    !row[7] ||
    !row[6]
  )
    return null;
  return [row[7], row[8], row[6]].filter(Boolean).join(" ");
}
function rosterDomain(source: FecIdentitySource, query: FecIdentityQuery) {
  if (
    source.url !== sanMateoRoster ||
    source.format !== "pdf" ||
    query.cycle !== 2026 ||
    !source.text.includes("JUNE 2, 2026") ||
    !source.text.includes("ROSTER OF CANDIDATES")
  )
    return null;
  const sections = [
    ...source.text.matchAll(
      /U\.S\. Representative, District (\d{1,2})(?=\d{4} On Ballot:)/g,
    ),
  ];
  const matches = sections.filter(
    (section) => Number(section[1]) === Number(query.district),
  );
  if (matches.length !== 1) return null;
  const section = matches[0];
  if (!section) return null;
  const block = source.text.slice(
    section.index + section[0].length,
    sections.find((next) => next.index > section.index)?.index,
  );
  const candidates = [
    ...block.matchAll(
      /^(.+?) (?:DEM|REP|NPP|LIB|GRN|AI|PF)Qualified: \d+ Candidate Stmt Filed\?/gm,
    ),
  ];
  const matching = candidates.filter(
    (row) => canonicalName(row[1] ?? "") === canonicalName(query.name),
  );
  if (matching.length !== 1) return null;
  const row = matching[0];
  if (!row) return null;
  const contact = block.slice(
    row.index + row[0].length,
    candidates.find((next) => next.index > row.index)?.index,
  );
  const websites = [
    ...contact.matchAll(
      /(?:^|\n)(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:\/)?Website:/g,
    ),
  ];
  return websites.length === 1
    ? (websites[0]?.[1]?.toLowerCase() ?? null)
    : null;
}
function formCandidate(
  source: FecIdentitySource,
  committeeId: string,
  domain: string,
) {
  if (
    source.format !== "text" ||
    !/^https:\/\/docquery\.fec\.gov\/dcdev\/posted\/\d+\.fec$/.test(
      source.url,
    ) ||
    source.text.length > 100_000
  )
    return null;
  const rows = source.text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("\u001c"));
  const header = rows[0];
  if (
    rows.length !== 2 ||
    header?.[0] !== "HDR" ||
    header[1] !== "FEC" ||
    !["8.4", "8.5"].includes(header[2] ?? "")
  )
    return null;
  const row = rows[1];
  if (!row) return null;
  if (
    row.length !== 101 ||
    !/^F1[AN]$/.test(row[0] ?? "") ||
    row[1] !== committeeId ||
    !/^H[A-Z0-9]{8}$/.test(row[22] ?? "") ||
    row[21] !== "A" ||
    row[28] !== "H" ||
    row[29] !== "CA" ||
    !/^\d{1,2}$/.test(row[30] ?? "") ||
    !/^\d{8}$/.test(row[14] ?? "")
  )
    return null;
  const websiteField = row[13] ?? "";
  let website: URL;
  try {
    website = new URL(
      /^https?:\/\//.test(websiteField)
        ? websiteField
        : `https://${websiteField}`,
    );
  } catch {
    return null;
  }
  if (
    website.hostname.replace(/^www\./, "") !== domain ||
    website.username ||
    website.password ||
    website.port ||
    website.pathname !== "/" ||
    website.search ||
    website.hash
  )
    return null;
  return {
    candidateId: row[22],
    name: [row[24], row[25], row[23], row[27]].filter(Boolean).join(" "),
    state: row[29],
    district: row[30],
  };
}
function bridgeQuery(
  rows: readonly FecIndexCandidate[],
  query: FecIdentityQuery,
  bridge: FecIdentityBridge,
  sources: readonly FecIdentitySource[],
): FecIdentityQuery | null {
  if (bridge.kind === "sos_legal_name_v1") {
    if (bridge.sourceCandidateId !== query.sourceCandidateId) return null;
    const source = archivedSource(sources, bridge.sourceId, bridge.sourceHash);
    const name = source && legalRosterName(source, query);
    return name ? { ...query, name } : null;
  }
  const roster = archivedSource(
    sources,
    bridge.rosterSourceId,
    bridge.rosterSourceHash,
  );
  const filing = archivedSource(
    sources,
    bridge.filingSourceId,
    bridge.filingSourceHash,
  );
  if (!roster || !filing || rosterDomain(roster, query) !== bridge.domain)
    return null;
  const candidate = formCandidate(filing, bridge.committeeId, bridge.domain);
  if (!candidate) return null;
  if (
    candidate.state !== "CA" ||
    Number(candidate.district) !== Number(query.district)
  )
    return null;
  const matched = resolveFecCandidate(rows, { ...query, name: candidate.name });
  if (!matched) return null;
  if (
    matched.candidate_id !== candidate.candidateId ||
    matched.principal_committee_id !== bridge.committeeId
  )
    return null;
  return { ...query, name: candidate.name };
}
export function findFecIdentityBridge(
  index: { url: string; format: string; text: string },
  query: FecIdentityQuery,
  sources: readonly FecIdentitySource[],
): FecIdentityBridge | undefined {
  const proofs: FecIdentityBridge[] = [];
  for (const source of sources) {
    if (query.sourceCandidateId && legalRosterName(source, query))
      proofs.push({
        kind: "sos_legal_name_v1",
        sourceId: source.id,
        sourceHash: source.contentHash,
        sourceCandidateId: query.sourceCandidateId,
      });
    const domain = rosterDomain(source, query);
    if (!domain) continue;
    for (const filing of sources) {
      const committees = [...new Set(filing.text.match(/C\d{8}/g) ?? [])];
      for (const committeeId of committees)
        proofs.push({
          kind: "official_domain_v1",
          rosterSourceId: source.id,
          rosterSourceHash: source.contentHash,
          filingSourceId: filing.id,
          filingSourceHash: filing.contentHash,
          committeeId,
          domain,
        });
    }
  }
  const matches = proofs.filter((proof) =>
    resolveFecIdentityFromSource(index, query, proof, sources),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
