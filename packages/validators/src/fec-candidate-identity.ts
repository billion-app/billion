export interface FecIdentityQuery {
  name: string;
  district: string;
  cycle: number;
}
export interface FecIndexCandidate {
  candidate_id: string;
  name: string;
  office: string;
  state: string;
  district: string | number;
  cycles: number[];
  election_years: number[];
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
    .normalize("NFKC")
    .toLocaleUpperCase("en-US")
    .replace(/[.'’"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
function fecName(value: string) {
  const pieces = value.split(",");
  return canonicalName(
    pieces.length === 2 ? `${pieces[1]} ${pieces[0]}` : value,
  );
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
    });
  }
  return rows;
}
export function resolveFecIdentityFromSource(
  source: { url: string; format: string; text: string },
  query: FecIdentityQuery,
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
  const matched = resolveFecCandidate(rows, query);
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
