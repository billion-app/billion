import { inflateRawSync } from "node:zlib";

export const NCSBE_STRUCTURE_VERSION = "ncsbe-public-election-v1";

export interface NcsbeCandidateRecord {
  electionDate: string;
  county: string;
  contest: string;
  name: string;
  party: string | null;
  voteFor: number | null;
  termYears: number | null;
  hasPrimary: boolean | null;
  isPartisan: boolean | null;
}

export interface NcsbeReferendumRecord {
  electionDate: string;
  county: string;
  contest: string;
  choice: string;
  description: string | null;
}

export interface NcsbeResultRecord {
  electionDate: string;
  county: string;
  precinct: string;
  contestId: string | null;
  contestType: string | null;
  contest: string;
  choice: string;
  party: string | null;
  voteFor: number | null;
  electionDayVotes: number;
  earlyVotingVotes: number;
  absenteeMailVotes: number;
  provisionalVotes: number;
  totalVotes: number;
  realPrecinct: boolean | null;
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/^\uFEFF/, "").trim();
}

function nullable(value: string | undefined): string | null {
  const result = clean(value);
  return result ? result : null;
}

function integer(value: string | undefined): number | null {
  const normalized = clean(value).replace(/,/g, "");
  if (!normalized) return null;
  const result = Number(normalized);
  return Number.isSafeInteger(result) ? result : null;
}

function boolean(value: string | undefined): boolean | null {
  const normalized = clean(value).toLowerCase();
  if (["true", "t", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
  return null;
}

export function normalizeElectionDate(value: string): string | null {
  const normalized = clean(value);
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized);
  if (slash) {
    return `${slash[3]}-${slash[1]!.padStart(2, "0")}-${slash[2]!.padStart(2, "0")}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

/** Small RFC 4180 parser; NCSBE files use commas, quoted fields and CRLF. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

function records(text: string, delimiter: string): Record<string, string>[] {
  const [rawHeaders, ...rows] = parseDelimited(text, delimiter);
  if (!rawHeaders) return [];
  const headers = rawHeaders.map((header) => clean(header).toLowerCase());
  return rows.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? ""]),
    ),
  );
}

function first(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return "";
}

export function parseCandidateCsv(text: string): NcsbeCandidateRecord[] {
  return records(text, ",").flatMap((row) => {
    const electionDate = normalizeElectionDate(
      first(row, "election_dt", "election_date"),
    );
    const county = clean(first(row, "county_name", "county"));
    const contest = clean(first(row, "contest_name", "contest"));
    const name = clean(
      first(row, "name_on_ballot", "candidate_name", "choice"),
    );
    if (!electionDate || !county || !contest || !name) return [];
    return [
      {
        electionDate,
        county,
        contest,
        name,
        party: nullable(
          first(row, "party_candidate", "candidate_party", "party"),
        ),
        voteFor: integer(first(row, "vote_for")),
        termYears: integer(first(row, "term", "term_years")),
        hasPrimary: boolean(first(row, "has_primary")),
        isPartisan: boolean(first(row, "is_partisan")),
      },
    ];
  });
}

export function parseResultsTsv(text: string): NcsbeResultRecord[] {
  return records(text, "\t").flatMap((row) => {
    const electionDate = normalizeElectionDate(
      first(row, "election date", "election_date"),
    );
    const county = clean(first(row, "county"));
    const precinct = clean(first(row, "precinct"));
    const contest = clean(first(row, "contest name", "contest_name"));
    const choice = clean(first(row, "choice", "candidate"));
    const totals = [
      integer(first(row, "election day", "election_day")),
      integer(first(row, "early voting", "early_voting")),
      integer(first(row, "absentee by mail", "absentee_by_mail")),
      integer(first(row, "provisional")),
      integer(first(row, "total votes", "total_votes")),
    ];
    if (
      !electionDate ||
      !county ||
      !precinct ||
      !contest ||
      !choice ||
      totals.some((n) => n === null)
    ) {
      return [];
    }
    return [
      {
        electionDate,
        county,
        precinct,
        contestId: nullable(first(row, "contest group id", "contest_group_id")),
        contestType: nullable(first(row, "contest type", "contest_type")),
        contest,
        choice,
        party: nullable(first(row, "choice party", "choice_party", "party")),
        voteFor: integer(first(row, "vote for", "vote_for")),
        electionDayVotes: totals[0]!,
        earlyVotingVotes: totals[1]!,
        absenteeMailVotes: totals[2]!,
        provisionalVotes: totals[3]!,
        totalVotes: totals[4]!,
        realPrecinct: boolean(first(row, "real precinct", "real_precinct")),
      },
    ];
  });
}

const NC_COUNTIES = new Set(
  `ALAMANCE ALEXANDER ALLEGHANY ANSON ASHE AVERY BEAUFORT BERTIE BLADEN BRUNSWICK BUNCOMBE BURKE CABARRUS CALDWELL CAMDEN CARTERET CASWELL CATAWBA CHATHAM CHEROKEE CHOWAN CLAY CLEVELAND COLUMBUS CRAVEN CUMBERLAND CURRITUCK DARE DAVIDSON DAVIE DUPLIN DURHAM EDGECOMBE FORSYTH FRANKLIN GASTON GATES GRAHAM GRANVILLE GREENE GUILFORD HALIFAX HARNETT HAYWOOD HENDERSON HERTFORD HOKE HYDE IREDELL JACKSON JOHNSTON JONES LEE LENOIR LINCOLN MACON MADISON MARTIN MCDOWELL MECKLENBURG MITCHELL MONTGOMERY MOORE NASH NEW HANOVER NORTHAMPTON ONSLOW ORANGE PAMLICO PASQUOTANK PENDER PERQUIMANS PERSON PITT POLK RANDOLPH RICHMOND ROBESON ROCKINGHAM ROWAN RUTHERFORD SAMPSON SCOTLAND STANLY STOKES SURRY SWAIN TRANSYLVANIA TYRRELL UNION VANCE WAKE WARREN WASHINGTON WATAUGA WAYNE WILKES WILSON YADKIN YANCEY`.split(
    " ",
  ),
);

/** Parse position-sorted PDF text lines from NCSBE referendum reports. */
export function parseReferendumLines(
  lines: readonly string[],
  sourceElectionDate?: string,
): NcsbeReferendumRecord[] {
  let electionDate = sourceElectionDate ?? null;
  let county: string | null = null;
  let contest: string | null = null;
  const output: NcsbeReferendumRecord[] = [];

  for (const raw of lines) {
    const line = clean(raw).replace(/\s+/g, " ");
    if (!line) continue;
    const criteriaDate = /Election:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(
      line,
    )?.[1];
    if (criteriaDate) electionDate = normalizeElectionDate(criteriaDate);
    const headerCounty = /^([A-Z ]+) BOARD OF ELECTIONS$/
      .exec(line)?.[1]
      ?.trim();
    if (headerCounty && NC_COUNTIES.has(headerCounty)) {
      county = headerCounty;
      contest = null;
      continue;
    }
    if (NC_COUNTIES.has(line)) {
      county = line;
      contest = null;
      continue;
    }
    if (
      /^(?:REFERENDUM CHOICES|CHOICE DESCRIPTION|CRITERIA:|Page \d+|\w{3} \d{1,2}, \d{4})/i.test(
        line,
      )
    ) {
      continue;
    }
    const choice = /^(For|Against|Yes|No)\b[\s:.-]*(.*)$/i.exec(line);
    if (choice && county && contest && electionDate) {
      output.push({
        electionDate,
        county,
        contest,
        choice:
          choice[1]![0]!.toUpperCase() + choice[1]!.slice(1).toLowerCase(),
        description: nullable(choice[2]),
      });
      continue;
    }
    if (county && /^[A-Z0-9][A-Z0-9 '&().,/%-]+$/.test(line)) contest = line;
  }
  return output;
}

/** Read the first text/CSV entry from a conventional NCSBE ZIP archive. */
export function extractFirstTextFileFromZip(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (
    let i = bytes.length - 22;
    i >= Math.max(0, bytes.length - 65_557);
    i--
  ) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0)
    throw new Error("ZIP end-of-central-directory record not found");
  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  for (let entry = 0; entry < entries; entry++) {
    if (view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("Invalid ZIP central directory");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const fileName = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + fileNameLength),
    );
    offset += 46 + fileNameLength + extraLength + commentLength;
    if (!/\.(?:txt|csv|tsv)$/i.test(fileName)) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50)
      throw new Error("Invalid ZIP local header");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(start, start + compressedSize);
    const content =
      method === 0
        ? compressed
        : method === 8
          ? inflateRawSync(compressed)
          : null;
    if (!content)
      throw new Error(`Unsupported ZIP compression method ${method}`);
    return new TextDecoder().decode(content);
  }
  throw new Error("ZIP contains no text election-results file");
}

export function restrictToCycle<T extends { electionDate: string }>(
  rows: readonly T[],
  cycleYear: number,
): T[] {
  return rows.filter(
    (row) => Number(row.electionDate.slice(0, 4)) === cycleYear,
  );
}
