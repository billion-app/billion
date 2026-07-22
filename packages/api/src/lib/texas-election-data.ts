/**
 * Deterministic parsers and reader types for the Texas SOS/TLC current-cycle
 * election handoff. SOS result facts and TLC explanatory text deliberately use
 * distinct records and citations all the way to the API response.
 */

import { and, desc, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { ElectionSourceSnapshot } from "@acme/db/schema";

export const TEXAS_SOS_PROVIDER = "texas-sos";
export const TEXAS_TLC_PROVIDER = "texas-tlc";
export const TEXAS_CURRENT_SCOPE = "current";
export const TEXAS_RESULTS_URL =
  "https://goelect.txelections.civixapps.com/ivis-enr-ui/races";
export const TEXAS_TLC_PUBLICATIONS_URL = "https://tlc.texas.gov/publications";

export interface SourceCitation {
  sourceName: string;
  sourceUrl: string;
  official: true;
  provider: typeof TEXAS_SOS_PROVIDER | typeof TEXAS_TLC_PROVIDER;
  page?: number;
}

export interface TexasElectionDefinition {
  id: number;
  name: string;
  year: number;
  type: string;
  category?: string;
  official: boolean;
}

export interface TexasSosDiscovery {
  cycleYear: number;
  elections: TexasElectionDefinition[];
  electionsByYear: Record<number, TexasElectionDefinition[]>;
}

export interface TexasResultChoice {
  id?: number;
  name: string;
  party?: string;
  incumbent: boolean;
  votes: number;
  earlyVotes?: number;
  percent: number;
  winner: boolean;
}

export interface TexasCountyResult {
  countyId: number;
  county: string;
  registeredVoters?: number;
  ballotsCast?: number;
  turnoutPercent?: number;
  reportingPercent?: number;
  choices: TexasResultChoice[];
}

export interface TexasElectionContest {
  id: string;
  sourceContestId: number;
  type: "candidate" | "referendum";
  title: string;
  officeType?: string;
  propositionNumber?: number;
  resolution?: string;
  totalVotes: number;
  choices: TexasResultChoice[];
  counties: TexasCountyResult[];
  outcome?: "adopted" | "rejected";
  citation: SourceCitation;
}

export interface TexasElectionReporting {
  countiesReporting?: number;
  countiesTotal?: number;
  precinctsReporting?: number;
  precinctsTotal?: number;
  pollingPlacesReporting?: number;
  pollingPlacesTotal?: number;
  percentReporting?: number;
}

export interface TexasElectionTurnout {
  registeredVoters?: number;
  ballotsCast?: number;
  turnoutPercent?: number;
}

export interface TexasSosElection {
  id: number;
  name: string;
  date?: string;
  year: number;
  electionType: string;
  status: "upcoming" | "reporting" | "complete" | "official";
  official: boolean;
  lastUpdated?: string;
  sourceVersion: string;
  reporting: TexasElectionReporting;
  turnout?: TexasElectionTurnout;
  contests: TexasElectionContest[];
  citation: SourceCitation;
}

export interface TexasSosSnapshotData {
  cycleYear: number;
  elections: TexasSosElection[];
}

export interface TlcTextPage {
  page: number;
  text: string;
}

export interface TexasTlcMeasure {
  propositionNumber: number;
  resolution?: string;
  ballotLanguage?: string;
  summaryAnalysis?: string;
  background?: string;
  supporterArguments: string[];
  opponentArguments: string[];
  fiscalImplications: string[];
  pageStart: number;
  pageEnd: number;
  citations: {
    ballotLanguage?: SourceCitation;
    summaryAnalysis?: SourceCitation;
    background?: SourceCitation;
    supporterArguments?: SourceCitation;
    opponentArguments?: SourceCitation;
    fiscalImplications?: SourceCitation;
  };
  diagnostics: string[];
}

export interface TexasTlcSnapshotData {
  cycleYear: number;
  electionDate?: string;
  publicationTitle?: string;
  sourceUrl: string;
  measures: TexasTlcMeasure[];
}

export interface TexasCurrentElectionData {
  jurisdiction: "TX";
  cycleYear: number;
  elections: TexasSosElection[];
  constitutionalAmendments?: {
    cycleYear: number;
    electionDate?: string;
    publicationTitle?: string;
    measures: (TexasTlcMeasure & {
      result?: Pick<
        TexasElectionContest,
        "outcome" | "totalVotes" | "choices" | "citation"
      > & {
        status: TexasSosElection["status"];
        asOf?: string;
      };
    })[];
    citation: SourceCitation;
  };
  diagnostics: string[];
  fetchedAt: string;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function decodeJson(value: unknown): unknown {
  if (typeof value !== "string" || !value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function unwrapUpload(value: unknown): unknown {
  const envelope = object(value);
  return envelope && "upload" in envelope ? decodeJson(envelope.upload) : value;
}

/** Parse the SOS discovery envelope and return only structured definitions. */
export function parseTexasSosDiscovery(raw: unknown): TexasSosDiscovery {
  const decoded = object(unwrapUpload(raw));
  const years = object(decoded?.electionInfo);
  if (!years)
    throw new Error("Texas SOS discovery payload has no electionInfo");

  const electionsByYear: Record<number, TexasElectionDefinition[]> = {};
  for (const [yearKey, groupsValue] of Object.entries(years)) {
    const year = Number.parseInt(yearKey, 10);
    const groups = object(groupsValue);
    if (!Number.isInteger(year) || !groups) continue;
    const definitions: TexasElectionDefinition[] = [];
    for (const group of Object.values(groups)) {
      const entries = object(group);
      if (!entries) continue;
      for (const candidate of Object.values(entries)) {
        const item = object(candidate);
        const id = numberValue(item?.ID);
        const name = stringValue(item?.N);
        if (id === undefined || !name) continue;
        definitions.push({
          id,
          name: name.replace(/\s+/g, " "),
          year,
          type: stringValue(item?.ET) ?? "unknown",
          category: stringValue(item?.EC),
          official: item?.O === "Y",
        });
      }
    }
    electionsByYear[year] = definitions.sort((a, b) => a.id - b.id);
  }
  const cycleYear = Math.max(...Object.keys(electionsByYear).map(Number));
  if (!Number.isFinite(cycleYear)) {
    throw new Error("Texas SOS discovery payload contains no election years");
  }
  return {
    cycleYear,
    elections: electionsByYear[cycleYear] ?? [],
    electionsByYear,
  };
}

function cleanCandidateName(name: string): {
  name: string;
  incumbent: boolean;
} {
  return {
    name: name.replace(/\s*\(I\)\s*$/i, "").trim(),
    incumbent: /\(I\)\s*$/i.test(name),
  };
}

function parseChoice(value: unknown): TexasResultChoice | null {
  const item = object(value);
  const rawName = stringValue(item?.N);
  if (!item || !rawName) return null;
  const cleaned = cleanCandidateName(rawName);
  return {
    id: numberValue(item.ID ?? item.id),
    name: cleaned.name,
    party: stringValue(item.P),
    incumbent: cleaned.incumbent,
    votes: numberValue(item.V) ?? 0,
    earlyVotes: numberValue(item.EV),
    percent: numberValue(item.PE) ?? 0,
    winner: false,
  };
}

function propositionIdentity(title: string): {
  number?: number;
  resolution?: string;
} {
  const number = /\bproposition\s+(\d+)\b/i.exec(title)?.[1];
  const resolution = /\(([SH]\.?\s*J\.?\s*R\.?)\s*(\d+)\)/i.exec(title);
  return {
    number: number ? Number.parseInt(number, 10) : undefined,
    resolution: resolution
      ? `${(resolution[1] ?? "").replace(/\s|\./g, "").toUpperCase()} ${resolution[2]}`
      : undefined,
  };
}

interface RaceSeed {
  id: number;
  title: string;
  officeType?: string;
  totalVotes: number;
  choices: TexasResultChoice[];
}

function raceSeeds(raw: JsonObject): RaceSeed[] {
  const groups: unknown[] = [];
  const raceRoot = object(decodeJson(raw.Race));
  const officeTypes: unknown[] = Array.isArray(raceRoot?.OfficeTypes)
    ? (raceRoot.OfficeTypes as unknown[])
    : [];
  groups.push(...officeTypes);
  for (const key of ["StateWide", "StateWideQ", "Districted", "Federal"]) {
    const section = object(decodeJson(raw[key]));
    if (section) groups.push(section);
  }

  const byId = new Map<number, RaceSeed>();
  for (const groupValue of groups) {
    const group = object(groupValue);
    if (!group) continue;
    const races = Array.isArray(group.Races) ? group.Races : [];
    for (const raceValue of races) {
      const race = object(raceValue);
      if (!race) continue;
      const id = numberValue(race.id ?? race.OID);
      const title = stringValue(race.N);
      if (id === undefined || !title || byId.has(id)) continue;
      const choices = (
        Array.isArray(race.Candidates)
          ? race.Candidates
          : Object.values(object(race.C) ?? {})
      )
        .map(parseChoice)
        .filter((choice): choice is TexasResultChoice => choice !== null)
        .sort((a, b) => b.votes - a.votes);
      const maxVotes = choices[0]?.votes ?? 0;
      for (const choice of choices)
        choice.winner = maxVotes > 0 && choice.votes === maxVotes;
      byId.set(id, {
        id,
        title: title.replace(/\s+/g, " ").trim(),
        officeType: stringValue(group.OfficeType ?? race.OT),
        totalVotes:
          numberValue(race.T) ??
          choices.reduce((sum, choice) => sum + choice.votes, 0),
        choices,
      });
    }
  }
  return [...byId.values()];
}

function reportingPercent(
  reporting: TexasElectionReporting,
): number | undefined {
  const pairs: [number | undefined, number | undefined][] = [
    [reporting.pollingPlacesReporting, reporting.pollingPlacesTotal],
    [reporting.countiesReporting, reporting.countiesTotal],
    [reporting.precinctsReporting, reporting.precinctsTotal],
  ];
  for (const [done, total] of pairs) {
    if (done !== undefined && total !== undefined && total > 0) {
      return Math.min(100, Math.round((done / total) * 10_000) / 100);
    }
  }
  return undefined;
}

function isoDate(mmddyyyy: string | undefined): string | undefined {
  if (!mmddyyyy || !/^\d{8}$/.test(mmddyyyy)) return undefined;
  return `${mmddyyyy.slice(4)}-${mmddyyyy.slice(0, 2)}-${mmddyyyy.slice(2, 4)}`;
}

function parseCountyResults(
  raw: unknown,
): Map<
  number,
  { totals: TexasElectionTurnout; results: Map<number, TexasCountyResult[]> }
> {
  const decoded = object(unwrapUpload(raw));
  const result = new Map<
    number,
    { totals: TexasElectionTurnout; results: Map<number, TexasCountyResult[]> }
  >();
  if (!decoded) return result;

  for (const [countyIdKey, countyValue] of Object.entries(decoded)) {
    const county = object(countyValue);
    const countyId = Number.parseInt(countyIdKey, 10);
    const name = stringValue(county?.N);
    if (!county || !Number.isInteger(countyId) || !name) continue;
    const summary = object(county.Summary);
    const registeredVoters = numberValue(county.TV ?? summary?.RV);
    const ballotsCast = numberValue(summary?.VC);
    const turnoutPercent =
      numberValue(summary?.VT) ??
      (registeredVoters && ballotsCast !== undefined
        ? Math.round((ballotsCast / registeredVoters) * 10_000) / 100
        : undefined);
    const byRace = new Map<number, TexasCountyResult[]>();
    const races = object(county.Races) ?? {};
    for (const raceValue of Object.values(races)) {
      const race = object(raceValue);
      const raceId = numberValue(race?.OID);
      if (!race || raceId === undefined) continue;
      const choices = Object.values(object(race.C) ?? {})
        .map(parseChoice)
        .filter((choice): choice is TexasResultChoice => choice !== null)
        .sort((a, b) => b.votes - a.votes);
      const maxVotes = choices[0]?.votes ?? 0;
      for (const choice of choices)
        choice.winner = maxVotes > 0 && choice.votes === maxVotes;
      const precinctsReporting = numberValue(race.PR);
      const precinctsTotal = numberValue(race.TP);
      byRace.set(raceId, [
        {
          countyId,
          county: name,
          registeredVoters,
          ballotsCast,
          turnoutPercent,
          reportingPercent:
            precinctsReporting !== undefined && precinctsTotal
              ? Math.min(
                  100,
                  Math.round((precinctsReporting / precinctsTotal) * 10_000) /
                    100,
                )
              : undefined,
          choices,
        },
      ]);
    }
    result.set(countyId, {
      totals: { registeredVoters, ballotsCast, turnoutPercent },
      results: byRace,
    });
  }
  return result;
}

/** Normalize one SOS election payload, optionally including county totals. */
export function parseTexasSosElection(
  raw: unknown,
  definition: TexasElectionDefinition,
  countyRaw?: unknown,
  today = new Date(),
): TexasSosElection {
  const root = object(raw);
  if (!root)
    throw new Error(`Texas SOS election ${definition.id} is not an object`);
  const home = object(decodeJson(root.Home)) ?? {};
  const reporting: TexasElectionReporting = {
    countiesReporting: numberValue(object(home.CountiesReporting)?.CR),
    countiesTotal: numberValue(object(home.CountiesReporting)?.CT),
    precinctsReporting: numberValue(object(home.PrecinctsReporting)?.PR),
    precinctsTotal: numberValue(object(home.PrecinctsReporting)?.PT),
    pollingPlacesReporting: numberValue(object(home.PollingReporting)?.PLR),
    pollingPlacesTotal: numberValue(object(home.PollingReporting)?.PLT),
  };
  reporting.percentReporting = reportingPercent(reporting);
  const date = isoDate(stringValue(home.ElecDate));
  const counties = parseCountyResults(countyRaw);
  const countyRows = [...counties.values()];
  const registeredVoters = countyRows.reduce(
    (sum, row) => sum + (row.totals.registeredVoters ?? 0),
    0,
  );
  const ballotsCast = countyRows.reduce(
    (sum, row) => sum + (row.totals.ballotsCast ?? 0),
    0,
  );
  const citation: SourceCitation = {
    sourceName: "Texas Secretary of State",
    sourceUrl: TEXAS_RESULTS_URL,
    official: true,
    provider: TEXAS_SOS_PROVIDER,
  };
  const contests = raceSeeds(root).map((race): TexasElectionContest => {
    const identity = propositionIdentity(race.title);
    const type = identity.number === undefined ? "candidate" : "referendum";
    const contestCounties: TexasCountyResult[] = [];
    for (const county of counties.values()) {
      contestCounties.push(...(county.results.get(race.id) ?? []));
    }
    const forChoice = race.choices.find((choice) => /^for$/i.test(choice.name));
    const againstChoice = race.choices.find((choice) =>
      /^against$/i.test(choice.name),
    );
    return {
      id: `tx-sos:${definition.id}:${race.id}`,
      sourceContestId: race.id,
      type,
      title: race.title,
      officeType: race.officeType,
      propositionNumber: identity.number,
      resolution: identity.resolution,
      totalVotes: race.totalVotes,
      choices: race.choices,
      counties: contestCounties,
      outcome:
        forChoice && againstChoice && race.totalVotes > 0
          ? forChoice.votes > againstChoice.votes
            ? "adopted"
            : "rejected"
          : undefined,
      citation,
    };
  });
  const totalVotes = contests.reduce(
    (sum, contest) => sum + contest.totalVotes,
    0,
  );
  const electionDate = date ? new Date(`${date}T23:59:59Z`) : undefined;
  const complete = (reporting.percentReporting ?? 0) >= 100;
  const status = definition.official
    ? "official"
    : electionDate && electionDate > today && totalVotes === 0
      ? "upcoming"
      : complete
        ? "complete"
        : totalVotes > 0
          ? "reporting"
          : "upcoming";
  return {
    id: definition.id,
    name: definition.name,
    date,
    year: definition.year,
    electionType: definition.type,
    status,
    official: definition.official,
    lastUpdated: stringValue(home.LastUpdatedTime),
    sourceVersion: stringValue(root.Version) ?? `election/${definition.id}`,
    reporting,
    turnout:
      registeredVoters > 0
        ? {
            registeredVoters,
            ballotsCast,
            turnoutPercent:
              Math.round((ballotsCast / registeredVoters) * 10_000) / 100,
          }
        : undefined,
    contests,
    citation,
  };
}

function compactText(value: string): string {
  return value
    .replace(/\u00ad/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function section(
  text: string,
  start: RegExp,
  ends: RegExp[],
): string | undefined {
  const match = start.exec(text);
  if (!match) return undefined;
  const tail = text.slice(match.index + match[0].length);
  let end = tail.length;
  for (const pattern of ends) {
    const next = pattern.exec(tail);
    if (next && next.index < end) end = next.index;
  }
  const value = compactText(tail.slice(0, end));
  return value || undefined;
}

function argumentList(text: string | undefined): string[] {
  if (!text) return [];
  const pieces = text.includes("•") ? text.split("•") : text.split(/\n\s*[-–]/);
  return pieces.map(compactText).filter((item) => item.length >= 15);
}

function fiscalSentences(...texts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const text of texts) {
    for (const sentence of (text ?? "").split(/(?<=[.!?])\s+/)) {
      const value = compactText(sentence);
      if (
        value.length >= 30 &&
        /\b(?:fiscal|tax|revenue|fund(?:ing)?|appropriat|cost|dollars?|\$)\b/i.test(
          value,
        ) &&
        !seen.has(value.toLowerCase())
      ) {
        seen.add(value.toLowerCase());
        output.push(value);
      }
      if (output.length >= 8) return output;
    }
  }
  return output;
}

function tlcCitation(sourceUrl: string, page: number): SourceCitation {
  return {
    sourceName: "Texas Legislative Council",
    sourceUrl: `${sourceUrl}#page=${page}`,
    official: true,
    provider: TEXAS_TLC_PROVIDER,
    page,
  };
}

/** Parse text-layer pages from either the 2023 or 2025 TLC report layout. */
export function parseTexasTlcAnalysis(
  pages: TlcTextPage[],
  sourceUrl: string,
): TexasTlcSnapshotData {
  const cover = compactText(
    pages
      .slice(0, 8)
      .map((page) => page.text)
      .join(" "),
  );
  const year = Number.parseInt(
    /(?:19|20)\d{2}/.exec(cover)?.[0] ?? String(new Date().getFullYear()),
    10,
  );
  const electionDate =
    /\b(November|May|September)\s+\d{1,2},\s+(?:19|20)\d{2}\b/i.exec(
      cover,
    )?.[0];
  const starts: { index: number; propositionNumber: number }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!page) continue;
    const text = page.text;
    // The ballot language between the heading and SUMMARY ANALYSIS ranges from
    // one short line to several wrapped lines (notably Props. 7, 12, 14, 17 in
    // the 2025 layout). Keep the bound finite so table-of-contents pages cannot
    // accidentally bridge into an unrelated heading.
    const match =
      /\bProposition\s+(\d+)\b[\s\S]{0,1200}\bSUMMARY\s+ANALYSIS\b/i.exec(text);
    if (match?.[1])
      starts.push({ index: i, propositionNumber: Number(match[1]) });
  }

  const measures = starts.map((start, position): TexasTlcMeasure => {
    const endIndex = (starts[position + 1]?.index ?? pages.length) - 1;
    const text = pages
      .slice(start.index, endIndex + 1)
      .map((page) => page.text)
      .join("\n");
    const heading =
      /\bProposition\s+(\d+)\s*\(([SH]\.?\s*J\.?\s*R\.?)\s*(\d+)\)\s*/i.exec(
        text,
      );
    const afterHeading = heading
      ? text.slice(heading.index + heading[0].length)
      : text;
    const ballotLanguage = compactText(
      afterHeading.split(/\bSUMMARY\s+ANALYSIS\b/i)[0] ?? "",
    );
    const summaryAnalysis = section(text, /\bSUMMARY\s+ANALYSIS\b/i, [
      /\bBACKGROUND(?:\s+AND\s+DETAILED\s+ANALYSIS)?\b/i,
      /\bSUMMARY\s+OF\s+COMMENTS\b/i,
    ]);
    const background = section(
      text,
      /\bBACKGROUND(?:\s+AND\s+DETAILED\s+ANALYSIS)?\b/i,
      [/\bSUMMARY\s+OF\s+COMMENTS\b/i, /\bCOMMENTS\s+BY\s+SUPPORTERS\b/i],
    );
    const supporters = section(text, /\bComments\s+by\s+Supporters\s*:?/i, [
      /\bComments\s+by\s+Opponents\s*:?/i,
      /\bText\s+of\s+[SH]\.?\s*J\.?\s*R\.?/i,
    ]);
    const opponents = section(text, /\bComments\s+by\s+Opponents\s*:?/i, [
      /\bText\s+of\s+[SH]\.?\s*J\.?\s*R\.?/i,
    ]);
    const startPage = pages[start.index];
    const endPage = pages[Math.max(start.index, endIndex)];
    if (!startPage || !endPage) {
      throw new Error("TLC proposition page bounds are invalid");
    }
    const pageStart = startPage.page;
    const pageEnd = endPage.page;
    const citation = tlcCitation(sourceUrl, pageStart);
    const supporterArguments = argumentList(supporters);
    const opponentArguments = argumentList(opponents);
    const fiscalImplications = fiscalSentences(summaryAnalysis, background);
    const diagnostics: string[] = [];
    if (!ballotLanguage) diagnostics.push("missing ballot language");
    if (!summaryAnalysis) diagnostics.push("missing summary analysis");
    if (!background) diagnostics.push("missing background analysis");
    if (!supporterArguments.length)
      diagnostics.push("missing supporter comments");
    if (!opponentArguments.length)
      diagnostics.push("missing opponent comments");
    return {
      propositionNumber: start.propositionNumber,
      resolution: heading
        ? `${(heading[2] ?? "").replace(/\s|\./g, "").toUpperCase()} ${heading[3]}`
        : undefined,
      ballotLanguage: ballotLanguage || undefined,
      summaryAnalysis,
      background,
      supporterArguments,
      opponentArguments,
      fiscalImplications,
      pageStart,
      pageEnd,
      citations: {
        ballotLanguage: ballotLanguage ? citation : undefined,
        summaryAnalysis: summaryAnalysis ? citation : undefined,
        background: background ? citation : undefined,
        supporterArguments: supporterArguments.length ? citation : undefined,
        opponentArguments: opponentArguments.length ? citation : undefined,
        fiscalImplications: fiscalImplications.length ? citation : undefined,
      },
      diagnostics,
    };
  });

  return {
    cycleYear: year,
    electionDate,
    publicationTitle: `Analyses of Proposed Constitutional Amendments (${year})`,
    sourceUrl,
    measures,
  };
}

function asSosData(
  value: Record<string, unknown>,
): TexasSosSnapshotData | null {
  return typeof value.cycleYear === "number" && Array.isArray(value.elections)
    ? (value as unknown as TexasSosSnapshotData)
    : null;
}

function asTlcData(
  value: Record<string, unknown>,
): TexasTlcSnapshotData | null {
  return typeof value.cycleYear === "number" && Array.isArray(value.measures)
    ? (value as unknown as TexasTlcSnapshotData)
    : null;
}

/** Read and join only the current SOS cycle plus the latest TLC amendment cycle. */
export async function getTexasCurrentElectionData(): Promise<TexasCurrentElectionData | null> {
  const rows = await db
    .select()
    .from(ElectionSourceSnapshot)
    .where(
      and(
        eq(ElectionSourceSnapshot.jurisdiction, "TX"),
        eq(ElectionSourceSnapshot.scope, TEXAS_CURRENT_SCOPE),
      ),
    )
    .orderBy(desc(ElectionSourceSnapshot.cycleYear));
  const sosRows = rows.filter((row) => row.provider === TEXAS_SOS_PROVIDER);
  const tlcRow = rows.find((row) => row.provider === TEXAS_TLC_PROVIDER);
  const tlc = tlcRow ? asTlcData(tlcRow.data) : null;
  const currentSos = sosRows.map((row) => asSosData(row.data)).find(Boolean);
  if (!currentSos && !tlc) return null;
  const amendmentSos = tlc
    ? sosRows
        .map((row) => asSosData(row.data))
        .find((data) => data?.cycleYear === tlc.cycleYear)
    : null;
  const amendmentElection = amendmentSos?.elections.find((election) =>
    election.contests.some((contest) => contest.type === "referendum"),
  );
  const byProposition = new Map(
    amendmentElection?.contests.flatMap((contest) =>
      contest.propositionNumber === undefined
        ? []
        : ([[contest.propositionNumber, contest]] as const),
    ) ?? [],
  );
  const fetchedAt = rows.reduce(
    (latest, row) => (row.fetchedAt > latest ? row.fetchedAt : latest),
    new Date(0),
  );
  return {
    jurisdiction: "TX",
    cycleYear: currentSos?.cycleYear ?? tlc?.cycleYear ?? 0,
    elections: currentSos?.elections ?? [],
    constitutionalAmendments: tlc
      ? {
          cycleYear: tlc.cycleYear,
          electionDate: tlc.electionDate,
          publicationTitle: tlc.publicationTitle,
          measures: tlc.measures.map((measure) => {
            const contest = byProposition.get(measure.propositionNumber);
            return {
              ...measure,
              result:
                contest && amendmentElection
                  ? {
                      outcome: contest.outcome,
                      totalVotes: contest.totalVotes,
                      choices: contest.choices,
                      citation: contest.citation,
                      status: amendmentElection.status,
                      asOf: amendmentElection.lastUpdated,
                    }
                  : undefined,
            };
          }),
          citation: tlcCitation(tlc.sourceUrl, 1),
        }
      : undefined,
    diagnostics: rows.flatMap((row) => row.diagnostics),
    fetchedAt: fetchedAt.toISOString(),
  };
}
