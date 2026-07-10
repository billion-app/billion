/**
 * Address-scoped elected officials.
 *
 * Google Civic's retired Representatives API used to combine district lookup
 * and office-holder data. Its supported `divisionsByAddress` endpoint still
 * resolves an address to OCD division IDs, so we pair those IDs with Open
 * States' keyless, nightly legislator CSV exports for current federal and state
 * lawmakers.
 */

import type { Address, DivisionByAddressResponse } from "./civic";
import { getDivisionsByAddress } from "./civic";

const PEOPLE_BASE = "https://data.openstates.org/people/current";
const PEOPLE_SOURCE = "https://open.pluralpolicy.com/data/legislator-csv/";
const PEOPLE_CACHE_MS = 6 * 60 * 60 * 1000;

export type OfficialLevel = "country" | "administrativeArea1";
export type OfficialChamber = "upper" | "lower";

export interface ElectedOfficial {
  id: string;
  name: string;
  party?: string;
  office: string;
  level: OfficialLevel;
  chamber: OfficialChamber;
  district?: string;
  image?: string;
  email?: string;
  phone?: string;
  address?: string;
  url?: string;
}

export interface ElectedOfficialsResponse {
  normalizedInput: Address;
  officials: ElectedOfficial[];
  source: {
    name: string;
    url: string;
    updated: string;
  };
}

interface PeopleRow {
  id: string;
  name: string;
  current_party: string;
  current_district: string;
  current_chamber: string;
  image: string;
  email: string;
  links: string;
  capitol_address: string;
  capitol_voice: string;
  district_address: string;
  district_voice: string;
}

interface Districts {
  stateCode: string;
  stateName: string;
  congressional?: string;
  stateUpper?: string;
  stateLower?: string;
}

interface CachedPeople {
  expiresAt: number;
  rows: PeopleRow[];
}

const peopleCache = new Map<string, CachedPeople>();

/** RFC 4180-compatible CSV parser, including commas/newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === undefined) continue;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function parsePeopleCsv(text: string): PeopleRow[] {
  const [headers, ...records] = parseCsv(text);
  if (!headers) return [];
  return records
    .filter((record) => record.some(Boolean))
    .map((record) =>
      Object.fromEntries(headers.map((header, i) => [header, record[i] ?? ""])),
    ) as unknown as PeopleRow[];
}

async function getPeople(code: string): Promise<PeopleRow[]> {
  const cacheKey = code.toLowerCase();
  const cached = peopleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const response = await fetch(`${PEOPLE_BASE}/${cacheKey}.csv`, {
    headers: {
      Accept: "text/csv",
      "User-Agent": "BillionCivicBot/1.0 (+https://billion-news.app)",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Open States people export error for ${cacheKey} (${response.status})`,
    );
  }
  const rows = parsePeopleCsv(await response.text());
  peopleCache.set(cacheKey, {
    rows,
    expiresAt: Date.now() + PEOPLE_CACHE_MS,
  });
  return rows;
}

function segment(ocdId: string, name: string): string | undefined {
  return new RegExp(`(?:^|/)${name}:([^/]+)`).exec(ocdId)?.[1];
}

/** Extract the legislative districts needed to join against people exports. */
export function extractDistricts(
  response: DivisionByAddressResponse,
): Districts {
  const ids = Object.keys(response.divisions);
  const stateId = ids.find((id) => segment(id, "state"));
  const stateCode = stateId ? segment(stateId, "state") : undefined;
  if (!stateCode) {
    throw new Error("Google Civic did not return a state for this address");
  }

  const stateDivision =
    response.divisions[`ocd-division/country:us/state:${stateCode}`];
  return {
    stateCode: stateCode.toUpperCase(),
    stateName: stateDivision?.name ?? response.normalizedInput.state,
    congressional: ids
      .map((id) => segment(id, "cd"))
      .find((value) => value !== undefined),
    stateUpper: ids
      .map((id) => segment(id, "sldu"))
      .find((value) => value !== undefined),
    stateLower: ids
      .map((id) => segment(id, "sldl"))
      .find((value) => value !== undefined),
  };
}

function first(value: string): string | undefined {
  return value
    .split(";")
    .map((item) => item.trim())
    .find(Boolean);
}

function normalizeOfficial(
  row: PeopleRow,
  office: string,
  level: OfficialLevel,
  district?: string,
): ElectedOfficial {
  const email = row.email.includes("@") ? row.email : undefined;
  return {
    id: row.id,
    name: row.name,
    party: row.current_party || undefined,
    office,
    level,
    chamber: row.current_chamber as OfficialChamber,
    district,
    image: row.image || undefined,
    email,
    phone: row.capitol_voice || row.district_voice || undefined,
    address: row.capitol_address || row.district_address || undefined,
    url: first(row.links),
  };
}

export function selectOfficials(
  federalRows: PeopleRow[],
  stateRows: PeopleRow[],
  districts: Districts,
): ElectedOfficial[] {
  const officials: ElectedOfficial[] = [];

  for (const row of federalRows) {
    if (
      row.current_chamber === "upper" &&
      row.current_district.toLowerCase() === districts.stateName.toLowerCase()
    ) {
      officials.push(normalizeOfficial(row, "U.S. Senator", "country"));
    }
  }

  if (districts.congressional) {
    const district = `${districts.stateCode}-${districts.congressional}`;
    const row = federalRows.find(
      (person) =>
        person.current_chamber === "lower" &&
        person.current_district.toUpperCase() === district,
    );
    if (row) {
      officials.push(
        normalizeOfficial(
          row,
          `U.S. Representative · District ${districts.congressional}`,
          "country",
          districts.congressional,
        ),
      );
    }
  }

  const stateRefs: {
    chamber: OfficialChamber;
    district?: string;
    office: string;
  }[] = [
    {
      chamber: "upper",
      district: districts.stateUpper,
      office: "State Senate",
    },
    {
      chamber: "lower",
      district: districts.stateLower,
      office: districts.stateCode === "CA" ? "State Assembly" : "State House",
    },
  ];

  for (const ref of stateRefs) {
    if (!ref.district) continue;
    const row = stateRows.find(
      (person) =>
        person.current_chamber === ref.chamber &&
        person.current_district === ref.district,
    );
    if (row) {
      officials.push(
        normalizeOfficial(
          row,
          `${ref.office} · District ${ref.district}`,
          "administrativeArea1",
          ref.district,
        ),
      );
    }
  }

  return officials;
}

export async function getElectedOfficials(
  address: string,
): Promise<ElectedOfficialsResponse> {
  const divisions = await getDivisionsByAddress(address);
  const districtRefs = extractDistricts(divisions);
  const [federal, state] = await Promise.allSettled([
    getPeople("us"),
    getPeople(districtRefs.stateCode),
  ]);

  const officials = selectOfficials(
    federal.status === "fulfilled" ? federal.value : [],
    state.status === "fulfilled" ? state.value : [],
    districtRefs,
  );

  if (officials.length === 0) {
    throw new Error("No current elected officials found for this address");
  }

  return {
    normalizedInput: divisions.normalizedInput,
    officials,
    source: {
      name: "Open States legislator data",
      url: PEOPLE_SOURCE,
      updated: "nightly",
    },
  };
}
